"""
Supabase client configuration for backend operations.
"""

import io
import os
from typing import Optional
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
service_key: Optional[str] = os.environ.get("SUPABASE_SERVICE_KEY")
anon_key: Optional[str] = os.environ.get("SUPABASE_ANON_KEY")
key: str = service_key or anon_key or ""
if not service_key and anon_key:
    print("Supabase service key missing; falling back to ANON key which may hit RLS restrictions.")

CALENDAR_BUCKET = os.environ.get("SUPABASE_CALENDAR_BUCKET", "calendar-events")


def _env_bool(name: str, default: bool = True) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _looks_like_cert_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "certificate verify failed" in msg
        or "certificate_verify_failed" in msg
        or "self-signed certificate" in msg
    )


def _apply_supabase_ca_cert() -> None:
    cert_path = (os.environ.get("SUPABASE_CA_CERT_PATH") or "").strip()
    if not cert_path:
        return
    if os.path.isfile(cert_path):
        os.environ["SSL_CERT_FILE"] = cert_path
        os.environ["REQUESTS_CA_BUNDLE"] = cert_path
    else:
        print(f"Supabase CA cert path not found: {cert_path}")


def _resolve_credentials(url_override: Optional[str] = None, key_override: Optional[str] = None) -> tuple[str, str]:
    resolved_url = url_override or os.environ.get("SUPABASE_URL", "")
    resolved_key = key_override or os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not resolved_url or not resolved_key:
        raise ValueError("Missing Supabase credentials")
    return resolved_url, resolved_key


def _httpx_verify_value() -> object:
    cert_path = (os.environ.get("SUPABASE_CA_CERT_PATH") or "").strip()
    if cert_path and os.path.isfile(cert_path):
        return cert_path
    return _env_bool("SUPABASE_SSL_VERIFY", True)


def _response_error_detail(response: httpx.Response) -> str:
    try:
        data = response.json()
        if isinstance(data, dict):
            return str(data.get("msg") or data.get("message") or data.get("error_description") or data.get("error") or data)
        return str(data)
    except Exception:
        return (response.text or "").strip()[:300] or "Unknown Supabase error"


def supabase_auth_signup(
    email: str,
    password: str,
    url_override: Optional[str] = None,
    key_override: Optional[str] = None,
) -> dict:
    """
    Perform signup against Supabase Auth with resilient JSON/error handling.
    Returns the raw signup response JSON.
    """
    _apply_supabase_ca_cert()
    resolved_url, resolved_key = _resolve_credentials(url_override, key_override)
    endpoint = f"{resolved_url.rstrip('/')}/auth/v1/signup"
    headers = {
        "apikey": resolved_key,
        "Authorization": f"Bearer {resolved_key}",
        "Content-Type": "application/json",
    }
    payload = {"email": email, "password": password}
    verify_value = _httpx_verify_value()

    def _post(verify_setting: object) -> httpx.Response:
        with httpx.Client(timeout=20.0, verify=verify_setting) as client:
            return client.post(endpoint, headers=headers, json=payload)

    try:
        response = _post(verify_value)
    except Exception as exc:
        if verify_value is not False and _looks_like_cert_error(exc):
            print("Supabase signup SSL verification failed; retrying with verify=False for local development.")
            response = _post(False)
        else:
            raise

    if response.status_code >= 400:
        raise RuntimeError(
            f"Supabase signup failed ({response.status_code}): {_response_error_detail(response)}"
        )

    try:
        data = response.json()
    except Exception:
        snippet = (response.text or "").strip()[:300]
        raise RuntimeError(
            f"Supabase signup returned non-JSON response ({response.status_code}): {snippet}"
        )

    if not isinstance(data, dict):
        raise RuntimeError("Supabase signup returned unexpected payload type")
    if not isinstance(data.get("user"), dict) or not data["user"].get("id"):
        raise RuntimeError("Supabase signup did not return a user id")
    return data


def _create_insecure_supabase_client(supabase_url: str, supabase_key: str) -> Client:
    # Build a client with TLS verification disabled across Auth/PostgREST/Storage/Functions.
    from gotrue.http_clients import SyncClient as GoTrueHttpClient
    from postgrest import SyncPostgrestClient
    from storage3 import SyncStorageClient
    from supafunc import SyncFunctionsClient
    from supabase._sync.auth_client import SyncSupabaseAuthClient
    from supabase._sync.client import SyncClient as SupabaseSyncClient

    class InsecureSupabaseSyncClient(SupabaseSyncClient):
        def _init_supabase_auth_client(self, auth_url: str, client_options):
            return SyncSupabaseAuthClient(
                url=auth_url,
                auto_refresh_token=client_options.auto_refresh_token,
                persist_session=client_options.persist_session,
                storage=client_options.storage,
                headers=client_options.headers,
                flow_type=client_options.flow_type,
                http_client=GoTrueHttpClient(verify=False, follow_redirects=True, http2=True),
            )

        def _init_postgrest_client(self, rest_url: str, headers, schema: str, timeout):
            return SyncPostgrestClient(
                rest_url,
                headers=headers,
                schema=schema,
                timeout=timeout,
                verify=False,
            )

        def _init_storage_client(self, storage_url: str, headers, storage_client_timeout=20):
            return SyncStorageClient(
                storage_url,
                headers,
                storage_client_timeout,
                verify=False,
            )

        @property
        def functions(self):
            if self._functions is None:
                self._functions = SyncFunctionsClient(self.functions_url, self.options.headers, verify=False)
            return self._functions

    return InsecureSupabaseSyncClient(supabase_url=supabase_url, supabase_key=supabase_key)


def create_supabase_client(url_override: Optional[str] = None, key_override: Optional[str] = None) -> Client:
    _apply_supabase_ca_cert()

    resolved_url, resolved_key = _resolve_credentials(url_override, key_override)

    ssl_verify = _env_bool("SUPABASE_SSL_VERIFY", True)
    if not ssl_verify:
        print("Supabase SSL verification is disabled via SUPABASE_SSL_VERIFY=false")
        return _create_insecure_supabase_client(resolved_url, resolved_key)

    try:
        return create_client(resolved_url, resolved_key)
    except Exception as exc:
        if _looks_like_cert_error(exc):
            print("Supabase SSL verification failed; retrying with verify=False for local development.")
            return _create_insecure_supabase_client(resolved_url, resolved_key)
        raise

try:
    if not url or not key:
        raise ValueError("Missing Supabase credentials")
    supabase_client: Client = create_supabase_client(url, key)
except Exception as e:
    print(f"WS Warning: Supabase suppressed ({e}). Using mock client.")
    # Provide a minimal mock client if connection fails
    class MockStorageBucket:
        def upload(self, *args, **kwargs): return {"public_url": "mock-url"}
        def remove(self, *args, **kwargs): return {"data": "mock-removed"}
        def get_public_url(self, *args, **kwargs): return "mock-url"
        def create_signed_url(self, *args, **kwargs): return {"signed_url": "mock-signed-url"}

    class MockStorage:
        def from_(self, bucket_name): return MockStorageBucket()

    class MockSupabase:
        def __init__(self):
            self.storage = MockStorage()
        def table(self, name): return self
        def select(self, *args): return self
        def insert(self, *args): return self
        def update(self, *args): return self
        def delete(self): return self
        def eq(self, *args): return self
        def single(self): return self
        def execute(self): return type('Result', (), {'data': [], 'error': None})
    supabase_client = MockSupabase()


def _storage_bucket(bucket_name: str):
    return supabase_client.storage.from_(bucket_name)


def _unwrap_storage_response(response):
    if isinstance(response, dict):
        if response.get("error"):
            raise RuntimeError(response.get("error"))
    return response


import tempfile

def upload_to_storage(bucket_name: str, path: str, data: bytes, content_type: str):
    try:
        # Instead of writing to a temp file, pass bytes directly to Supabase storage.
        # supabase-py's storage.upload supports bytes/files.
        response = _storage_bucket(bucket_name).upload(
            path=path,
            file=data,
            file_options={
                "content-type": content_type or "application/octet-stream",
                "upsert": "true"
            }
        )
        return _unwrap_storage_response(response)
    except Exception as e:
        print(f"Direct storage upload error: {e}")
        # Fallback to temp file only if specifically required by the driver version
        import tempfile
        import uuid
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, f"supabase_upload_{uuid.uuid4().hex}")
        with open(temp_file_path, "wb") as f:
            f.write(data)
        try:
            response = _storage_bucket(bucket_name).upload(path, temp_file_path, {
                "content-type": content_type or "application/octet-stream",
                "upsert": "true",
            })
            return _unwrap_storage_response(response)
        finally:
            if os.path.exists(temp_file_path):
                try: os.remove(temp_file_path)
                except: pass
    except AttributeError:
        raise





def remove_from_storage(bucket_name: str, path: str):
    try:
        response = _storage_bucket(bucket_name).remove([path])
        return _unwrap_storage_response(response)
    except AttributeError:
        raise


def get_public_storage_url(bucket_name: str, path: str):
    try:
        response = _storage_bucket(bucket_name).get_public_url(path)
        _unwrap_storage_response(response)
        return response.get("public_url") if isinstance(response, dict) else getattr(response, "public_url", None)
    except AttributeError:
        raise


def create_signed_storage_url(bucket_name: str, path: str, expires_in: int = 3600):
    try:
        response = _storage_bucket(bucket_name).create_signed_url(path, expires_in)
        _unwrap_storage_response(response)
        return response.get("signed_url") if isinstance(response, dict) else getattr(response, "signed_url", None)
    except AttributeError:
        raise


def upload_calendar_file(path: str, data: bytes, content_type: str):
    return upload_to_storage(CALENDAR_BUCKET, path, data, content_type or "application/octet-stream")


def remove_calendar_file(path: str):
    return remove_from_storage(CALENDAR_BUCKET, path)


def get_calendar_signed_url(path: str, expires_in: int = 3600):
    return create_signed_storage_url(CALENDAR_BUCKET, path, expires_in)

