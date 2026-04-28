import io
import re
import datetime
import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from PyPDF2 import PdfReader
from fastapi import HTTPException, UploadFile

# Try to use pdfplumber for better table extraction if available
try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from pdf2image import convert_from_bytes
except ImportError:
    convert_from_bytes = None

try:
    import pytesseract
    from pytesseract import TesseractNotFoundError
except ImportError:
    pytesseract = None
    TesseractNotFoundError = RuntimeError

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None
    ImageOps = None

try:
    import numpy as np
except ImportError:
    np = None

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    RapidOCR = None

_RAPIDOCR_ENGINE = None

# ── Constants ─────────────────────────────────────────────────────────────

DEFAULT_CALENDAR = {
    "semester": "Spring 2026",
    "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "events": [],
    "notes": "PES EC Campus schedule — update each semester with holidays, exams, and working-day notes.",
}

ALLOWED_CALENDAR_EVENT_TYPES = {"Holiday", "Exam", "Cultural", "Sports_Day", "Workshop", "Other", "Festival"}

# Backward-compat alias used by main.py settings endpoint
DEFAULT_SETTINGS = {
    "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "open_time": "09:00",
    "close_time": "17:00",
    "breaks": [],
    "calendar": DEFAULT_CALENDAR,
}


def normalize_calendar(payload: dict) -> dict:
    """Normalize a calendar payload to ensure consistent keys."""
    if not payload or not isinstance(payload, dict):
        return DEFAULT_CALENDAR.copy()
    return {
        "semester": payload.get("semester", DEFAULT_CALENDAR["semester"]),
        "working_days": payload.get("working_days", DEFAULT_CALENDAR["working_days"]),
        "events": payload.get("events", []),
        "notes": payload.get("notes", DEFAULT_CALENDAR["notes"]),
    }

MONTH_MAP = {
    "jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
    "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12,
    "january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
    "july":7,"august":8,"september":9,"october":10,"november":11,"december":12
}

EVENT_KEYWORDS = [
    "class", "holiday", "exam", "isa", "ia", "esa", "ria", "ptm", "cultural",
    "commencement", "posting", "festival", "vacation", "internal assessment",
    "bakrid", "christmas", "independence", "republic", "rajyotsava", "naraka",
    "jayanti", "muharram", "ramzan", "meelad", "fest", "sports", "results",
    "lamp lighting", "course registration", "clinical posting", "lwd", "study holiday"
]

MONTH_NAME_PATTERN = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)

EVENT_CODE_REGEX = re.compile(
    r"\b(IA-R|ISA|IA|RIA|PTM|CCM|FAM|FAP|ESA|FE|LWD|SCA|SH|RC|H)\b",
    re.IGNORECASE,
)

EVENT_CODE_LABELS = {
    "H": "Holiday",
    "IA": "Internal Assessment",
    "IA-R": "Internal Assessment Results",
    "ISA": "In-Semester Assessment",
    "RIA": "Remedial Internal Assessment",
    "ESA": "End-Semester Assessment",
    "FE": "Final Examination",
    "PTM": "Parent Teacher Meeting",
    "CCM": "Class Committee Meeting",
    "FAM": "Faculty Advisor Meeting",
    "FAP": "Faculty Advisor Program",
    "LWD": "Last Working Day",
    "SCA": "Sports and Cultural Activities",
    "SH": "Study Holiday",
    "RC": "Remedial Classes",
}

HEADER_MARKERS = [
    "academic calender of events",
    "academic calendar of events",
    "week",
    "working days",
    "activities/events",
    "mon tue",
    "program:",
    "session:",
]

# ── Normalization Helpers ──────────────────────────────────────────────────

def normalize_event_type(value: Optional[str], default: str = "Festival") -> str:
    if not value:
        return default
    candidate = str(value).strip().lower()
    
    if "sport" in candidate: return "Sports_Day"
    if any(x in candidate for x in ["exam", "isa", "ia", "assessment", "esa", "fe", "ria", "test", "quiz"]): return "Exam"
    if any(x in candidate for x in ["holiday", "closed", "vacation"]): return "Holiday"
    if any(x in candidate for x in ["cultural", "fest", "celebration", "maatru"]): return "Cultural"
    if any(x in candidate for x in ["workshop", "seminar", "symposium"]): return "Workshop"
    if any(x in candidate for x in ["ptm", "meeting", "parent", "commencement", "posting", "registration", "results", "lwd", "last working day", "study holiday", "remedial"]): return "Other"
    
    # Check if it matches exactly after capitalization
    cap = candidate.capitalize()
    if cap in ALLOWED_CALENDAR_EVENT_TYPES:
        return cap
        
    return default


def normalize_event_date(value: Optional[str]) -> Optional[str]:
    if not value: return None
    raw = str(value).strip()
    if not raw: return None

    # Remove ordinal suffixes and normalize separators.
    raw = re.sub(r"(\d{1,2})(st|nd|rd|th)", r"\1", raw, flags=re.IGNORECASE)
    raw = re.sub(r"[–—]", "-", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    
    # Try common formats
    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y",
        "%d %B %Y", "%d %b %Y", "%d-%b-%Y", "%d-%B-%y",
        "%Y/%m/%d", "%d %B, %Y", "%d %b, %Y"
    ]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
            
    # Heuristic for partial strings like "15 Aug" -> assume current/next year
    try:
        # Regex for "Day Month"
        match = re.search(r'(\d{1,2})\s+([A-Za-z]{3,})', raw)
        if match:
            d, m = match.groups()
            month_num = MONTH_MAP.get(m.lower()[:3])
            if month_num:
                year = datetime.date.today().year
                # If target month < current month, assume next year
                if month_num < datetime.date.today().month - 1:
                    year += 1
                return datetime.date(year, month_num, int(d)).isoformat()
    except: pass

    try: return datetime.date.fromisoformat(raw).isoformat()
    except ValueError: return None


def _month_from_token(token: Optional[str]) -> Optional[int]:
    if not token:
        return None
    key = token.strip().lower().replace("sept", "sep")
    return MONTH_MAP.get(key) or MONTH_MAP.get(key[:3])


def _coerce_year_token(token: Optional[str]) -> Optional[int]:
    if not token:
        return None
    try:
        year = int(token)
    except ValueError:
        return None

    if year < 100:
        year += 2000
    if 2000 <= year <= 2100:
        return year
    return None


def _extract_session_context(text: str) -> Dict[str, Optional[int]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    session_line = next((line for line in lines if "session" in line.lower()), "")

    month_tokens = re.findall(MONTH_NAME_PATTERN, session_line, flags=re.IGNORECASE)
    months = [_month_from_token(token) for token in month_tokens]
    months = [m for m in months if m]

    year_tokens = re.findall(r"\b(20\d{2}|\d{2})\b", session_line)
    years = [_coerce_year_token(token) for token in year_tokens]
    years = [y for y in years if y]

    if not years:
        # Collect all 4-digit years from the document in order of appearance.
        full_years_raw = [int(y) for y in re.findall(r"\b20\d{2}\b", text)]
        if full_years_raw:
            # Use the FIRST year encountered as the dominant/start year so that
            # events earlier in the document don't get assigned the final year.
            years = sorted(set(full_years_raw))
        else:
            years = [datetime.date.today().year]

    start_year = years[0]
    end_year = years[-1]
    if len(years) == 1:
        end_year = start_year

    start_month = months[0] if months else None
    end_month = months[-1] if months else None

    # Session like "Oct 2025 - Sep 2026" spans two calendar years.
    if start_month and end_month and start_month > end_month and start_year == end_year:
        end_year = start_year + 1

    # Use start_year as default — ambiguous month-only dates are more likely
    # to belong to the beginning of the session than the end.
    default_year = start_year
    return {
        "start_month": start_month,
        "end_month": end_month,
        "start_year": start_year,
        "end_year": end_year,
        "default_year": default_year,
    }


def _resolve_year_for_month(month: int, session_ctx: Dict[str, Optional[int]]) -> int:
    start_month = session_ctx.get("start_month")
    end_month = session_ctx.get("end_month")
    start_year = session_ctx.get("start_year")
    end_year = session_ctx.get("end_year")
    default_year = session_ctx.get("default_year") or datetime.date.today().year

    if not start_month or not end_month or not start_year or not end_year:
        return default_year

    if start_year == end_year:
        return start_year

    # Cross-year session window, e.g. Oct -> Sep.
    if start_month > end_month:
        if month >= start_month:
            return start_year
        if month <= end_month:
            return end_year
        return default_year

    if start_month <= month <= end_month:
        return start_year
    return default_year


def _extract_month_mentions(line: str) -> List[int]:
    tokens = re.findall(MONTH_NAME_PATTERN, line, flags=re.IGNORECASE)
    months = [_month_from_token(token) for token in tokens]
    return [m for m in months if m]


def _is_probable_header_line(line: str) -> bool:
    lower = line.lower()
    if any(marker in lower for marker in HEADER_MARKERS):
        return True
    code_hits = EVENT_CODE_REGEX.findall(line)
    if ":" in line and len(code_hits) >= 2:
        return True
    return False


def _has_event_signal(line: str) -> bool:
    lower = line.lower()
    if EVENT_CODE_REGEX.search(line):
        return True
    return any(keyword in lower for keyword in EVENT_KEYWORDS)


def _clean_event_name(raw: str) -> str:
    text = re.sub(r"\s+", " ", raw).strip()
    text = re.sub(r"^[0-9]+\.?\s*", "", text)
    text = re.sub(r"[–—]", "-", text)

    # Remove table/date fragments while preserving semantic text.
    text = re.sub(fr"\b{MONTH_NAME_PATTERN}\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b[0-3]?\d(?:st|nd|rd|th)?\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(?:st|nd|rd|th)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(IA-R|ISA[\w-]*|IA[\w-]*|RIA|PTM|CCM|FAM|FAP|ESA[\w-]*|FE|LWD|SCA|SH|RC|H)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s{2,}", " ", text).strip(" -:;,/")
    return text


def _fallback_event_name(line: str) -> str:
    code_match = EVENT_CODE_REGEX.search(line)
    if code_match:
        code = code_match.group(1).upper()
        return EVENT_CODE_LABELS.get(code, "Academic Event")
    return "Academic Event"


def _build_event_name(line: str, next_line: str) -> str:
    merged = line
    if next_line and len(next_line) <= 90 and not _extract_month_mentions(next_line) and not re.match(r"^\d+\.?", next_line):
        merged = f"{line} {next_line}"

    lower = merged.lower()

    holiday_labels = [
        ("ambedkar jayanti", "Ambedkar Jayanti"),
        ("kannada rajyotsava", "Kannada Rajyotsava"),
        ("naraka chatur", "Naraka Chaturdashi"),
        ("republic day", "Republic Day"),
        ("independence day", "Independence Day"),
        ("christmas", "Christmas"),
        ("bakrid", "Bakrid"),
        ("muharram", "Muharram"),
        ("id-meelad", "Id-Meelad"),
        ("ramzan", "Ramzan"),
        ("may day", "May Day"),
        ("makara sankranti", "Makara Sankranti"),
    ]
    for needle, label in holiday_labels:
        if needle in lower:
            return label

    canonical_patterns = [
        (r"commencement of (?:the )?(?:next semester|class(?:es)?)", "Commencement of Classes"),
        (r"course registration", "Course Registration"),
        (r"lamp lighting", "Lamp Lighting Ceremony"),
        (r"clinical posting", "Clinical Posting"),
        (r"\besa[\w-]*\b|end semester assessment|end-semester assessment", "End-Semester Assessment"),
        (r"\bisa[\w-]*\b|internal assessment|\bia[\w-]*\b|\bia-r\b|\bria\b", "Internal Assessment"),
        (r"final exam|final examination|\bfe\b", "Final Examination"),
        (r"parent teacher|\bptm\b", "Parent Teacher Meeting"),
        (r"class committee|\bccm\b", "Class Committee Meeting"),
        (r"faculty advisor|\bfam\b", "Faculty Advisor Meeting"),
        (r"last working day|\blwd\b", "Last Working Day"),
        (r"announcement[s]? of results|results of university", "Announcement of Results"),
        (r"sports\s*&?\s*cultural|\bsca\b", "Sports and Cultural Activities"),
        (r"study holiday|\bsh\b", "Study Holiday"),
        (r"vacation", "Vacation"),
    ]
    for pattern, label in canonical_patterns:
        if re.search(pattern, lower, flags=re.IGNORECASE):
            return label

    named_match = re.search(
        r"\b\d{1,2}(?:st|nd|rd|th)?\s*(?:-|–)?\s*([A-Za-z][A-Za-z0-9&()/',\-\s]{2,})",
        merged,
        flags=re.IGNORECASE,
    )
    if named_match:
        named = named_match.group(1).strip(" -:;,")
        named = re.split(r"\s{2,}", named)[0].strip()
        if any(keyword in named.lower() for keyword in EVENT_KEYWORDS) and not re.search(r"\d", named):
            return named[:120]

    cleaned = _clean_event_name(merged)
    if len(cleaned) >= 4:
        return cleaned[:120]

    return _fallback_event_name(merged)


def _add_date_candidate(candidates: List[Dict[str, Any]], day: int, month: Optional[int], year: Optional[int], pos: int, session_ctx: Dict[str, Optional[int]]) -> None:
    if day < 1 or day > 31:
        return
    if not month:
        return

    final_year = year or _resolve_year_for_month(month, session_ctx)
    try:
        date_obj = datetime.date(final_year, month, day)
    except ValueError:
        return

    if date_obj.year < 2020 or date_obj.year > 2100:
        return

    candidates.append({"event_date": date_obj.isoformat(), "pos": pos})


def _extract_line_date_candidates(line: str, default_month: Optional[int], session_ctx: Dict[str, Optional[int]]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []

    # ESA ranges like "ESA:May04-30" or "ESA: May 04-30" should mark every day in the exam window.
    for match in re.finditer(
        fr"\bESA\b[^A-Za-z0-9]*(?:({MONTH_NAME_PATTERN})\s*)?([0-3]?\d)\s*[-–]\s*(?:({MONTH_NAME_PATTERN})\s*)?([0-3]?\d)\b",
        line,
        flags=re.IGNORECASE,
    ):
        start_month = _month_from_token(match.group(1)) if match.group(1) else default_month
        end_month = _month_from_token(match.group(3)) if match.group(3) else start_month
        if not start_month or not end_month:
            continue

        start_day = int(match.group(2))
        end_day = int(match.group(4))
        start_year = _resolve_year_for_month(start_month, session_ctx)
        end_year = _resolve_year_for_month(end_month, session_ctx)

        try:
            start_date = datetime.date(start_year, start_month, start_day)
            end_date = datetime.date(end_year, end_month, end_day)
        except ValueError:
            continue

        if end_date < start_date:
            continue

        span_days = (end_date - start_date).days
        if span_days > 60:
            continue

        for offset in range(span_days + 1):
            dt = start_date + datetime.timedelta(days=offset)
            candidates.append({"event_date": dt.isoformat(), "pos": match.start()})

    def parse_inline_year(year_token: Optional[str]) -> Optional[int]:
        if not year_token:
            return None
        if len(year_token) == 4:
            return _coerce_year_token(year_token)
        return None

    for match in re.finditer(r"\b([0-3]?\d)[-/.]([01]?\d)[-/.](\d{4})\b", line):
        day = int(match.group(1))
        month = int(match.group(2))
        year = parse_inline_year(match.group(3))
        _add_date_candidate(candidates, day, month, year, match.start(), session_ctx)

    for match in re.finditer(
        fr"\b([0-3]?\d)(?:st|nd|rd|th)?\s*(?:[-/.,]\s*)?({MONTH_NAME_PATTERN})(?:\s*[-/.,]?\s*(\d{{2,4}}))?\b",
        line,
        flags=re.IGNORECASE,
    ):
        day = int(match.group(1))
        month = _month_from_token(match.group(2))
        year = parse_inline_year(match.group(3)) if match.group(3) else None
        _add_date_candidate(candidates, day, month, year, match.start(), session_ctx)

    for match in re.finditer(
        fr"\b({MONTH_NAME_PATTERN})\s*([0-3]?\d)(?:st|nd|rd|th)?(?:\s*[-/.,]?\s*(\d{{2,4}}))?\b",
        line,
        flags=re.IGNORECASE,
    ):
        month = _month_from_token(match.group(1))
        day = int(match.group(2))
        year = parse_inline_year(match.group(3)) if match.group(3) else None
        _add_date_candidate(candidates, day, month, year, match.start(), session_ctx)

    for match in re.finditer(r"\b([0-3]?\d)(st|nd|rd|th)\b", line, flags=re.IGNORECASE):
        if default_month:
            day = int(match.group(1))
            _add_date_candidate(candidates, day, default_month, None, match.start(), session_ctx)

    for match in re.finditer(
        r"\b(?:H|IA-R|ISA|IA|RIA|PTM|CCM|FAM|FAP|ESA|FE|LWD|SCA|SH|RC)(?:-[A-Za-z]+)?\s*[A-Za-z]{0,3}\s*([0-3]?\d)\b",
        line,
        flags=re.IGNORECASE,
    ):
        if default_month:
            day = int(match.group(1))
            _add_date_candidate(candidates, day, default_month, None, match.start(), session_ctx)

    if not candidates and default_month and _has_event_signal(line):
        numeric_matches = list(re.finditer(r"\b([0-3]?\d)\b", line))
        if 0 < len(numeric_matches) <= 2:
            for match in numeric_matches:
                day = int(match.group(1))
                _add_date_candidate(candidates, day, default_month, None, match.start(), session_ctx)

    dedup: Dict[str, Dict[str, Any]] = {}
    for candidate in candidates:
        key = candidate["event_date"]
        if key not in dedup or candidate["pos"] < dedup[key]["pos"]:
            dedup[key] = candidate

    return list(dedup.values())


def _extract_stream_from_filename(filename: Optional[str]) -> str:
    stream = "General"
    if not filename:
        return stream

    lower = filename.lower()
    if "mbbs" in lower:
        return "MBBS"
    if "btech" in lower or "b.tech" in lower:
        return "B.Tech"
    if "nursing" in lower:
        return "Nursing"
    return stream


# ── Extraction Logic ───────────────────────────────────────────────────────

def _get_rapidocr_engine():
    global _RAPIDOCR_ENGINE
    if not RapidOCR:
        return None
    if _RAPIDOCR_ENGINE is None:
        try:
            _RAPIDOCR_ENGINE = RapidOCR()
        except Exception as e:
            print(f"RapidOCR init error: {e}")
            _RAPIDOCR_ENGINE = False
    return _RAPIDOCR_ENGINE if _RAPIDOCR_ENGINE is not False else None


def _extract_text_from_rapidocr_image(img) -> str:
    if not img or np is None:
        return ""

    engine = _get_rapidocr_engine()
    if not engine:
        return ""

    try:
        ocr_result, _ = engine(np.array(img))
    except Exception as e:
        print(f"RapidOCR run error: {e}")
        return ""

    if not ocr_result:
        return ""

    lines = []
    for entry in ocr_result:
        if len(entry) < 2:
            continue
        line = str(entry[1]).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _configure_tesseract_from_common_paths() -> bool:
    if not pytesseract:
        return False

    common_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\Users\asus\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
    ]
    for path_str in common_paths:
        if Path(path_str).exists():
            pytesseract.pytesseract.tesseract_cmd = path_str
            return True
    return False

def _is_tesseract_ready() -> bool:
    if not pytesseract:
        return False
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        if _configure_tesseract_from_common_paths():
            try:
                pytesseract.get_tesseract_version()
                return True
            except Exception:
                return False
        return False

def extract_text_comprehensive(file_bytes: bytes) -> str:
    """Smart text extraction using PDF text layer plus image OCR fallback."""
    text_chunks: List[str] = []

    # 1) pdfplumber: best quality for line-preserving text and tables.
    if pdfplumber:
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text(x_tolerance=2, y_tolerance=2) or page.extract_text(layout=True)
                    if page_text and page_text.strip():
                        text_chunks.append(page_text)

                    tables = page.extract_tables(
                        table_settings={
                            "vertical_strategy": "lines",
                            "horizontal_strategy": "lines",
                        }
                    )
                    for table in tables or []:
                        for row in table:
                            cells = [str(cell).strip() for cell in (row or []) if cell and str(cell).strip()]
                            if cells:
                                text_chunks.append(" | ".join(cells))
        except Exception as e:
            print(f"pdfplumber error: {e}")

    current_text = "\n".join(text_chunks)

    # 2) PyPDF2 fallback for PDFs where plumber misses text objects.
    if len(current_text.strip()) < 80:
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text_chunks.append(page_text)
        except Exception as e:
            print(f"PyPDF2 error: {e}")

    current_text = "\n".join(text_chunks)

    ocr_ready = _is_tesseract_ready()
    rapidocr_ready = Image is not None and np is not None and _get_rapidocr_engine() is not None

    # A scanned/image PDF will have very little real text even after pdfplumber.
    # We use a generous threshold (500 chars) so that junk metadata or artifact
    # text emitted by plumber doesn't prevent OCR from triggering.
    _OCR_TEXT_THRESHOLD = 500

    if len(current_text.strip()) < _OCR_TEXT_THRESHOLD and not ocr_ready and not rapidocr_ready:
        print("OCR skipped: no available OCR engine (install Tesseract or rapidocr-onnxruntime).")

    # 3) OCR from embedded page images (works even when poppler is missing).
    if len(current_text.strip()) < _OCR_TEXT_THRESHOLD and Image and (ocr_ready or rapidocr_ready):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            embedded_ocr_chunks: List[str] = []
            for page in reader.pages:
                for image_file in getattr(page, "images", []):
                    try:
                        img = Image.open(io.BytesIO(image_file.data))
                        img = ImageOps.grayscale(img)
                        img = ImageOps.autocontrast(img)
                        img = img.resize((img.width * 2, img.height * 2))

                        if ocr_ready:
                            ocr_text = pytesseract.image_to_string(img, config="--psm 6")
                        else:
                            ocr_text = _extract_text_from_rapidocr_image(img)

                        if ocr_text and ocr_text.strip():
                            embedded_ocr_chunks.append(ocr_text)
                    except Exception:
                        continue
            if embedded_ocr_chunks:
                # Replace (not append) text with OCR output for image-based PDFs
                # so that the garbled pdfplumber text doesn't corrupt parsing.
                text_chunks = embedded_ocr_chunks
        except Exception as e:
            print(f"Embedded image OCR error: {e}")

    current_text = "\n".join(text_chunks)

    # 4) Last OCR fallback via rasterization (requires poppler + tesseract).
    # Threshold matches step 3 so that one image-bearing PDF doesn't skip step 4.
    if len(current_text.strip()) < _OCR_TEXT_THRESHOLD and convert_from_bytes and (ocr_ready or rapidocr_ready):
        try:
            images = convert_from_bytes(file_bytes, dpi=300)
            raster_chunks: List[str] = []
            for img in images:
                if ocr_ready:
                    ocr_text = pytesseract.image_to_string(img, config="--psm 6")
                else:
                    ocr_text = _extract_text_from_rapidocr_image(img)

                if ocr_text and ocr_text.strip():
                    raster_chunks.append(ocr_text)
            if raster_chunks:
                text_chunks = raster_chunks
        except Exception as e:
            print(f"OCR error: {e}")

    return "\n".join(text_chunks)


def parse_calendar_v2(text: str, stream: str) -> List[Dict]:
    """Session-aware parser tuned for academic calendar table PDFs."""
    events: List[Dict[str, str]] = []
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return []

    session_ctx = _extract_session_context(text)
    current_month = session_ctx.get("start_month")

    for index, line in enumerate(lines):
        month_mentions = _extract_month_mentions(line)
        if month_mentions:
            current_month = month_mentions[-1]
        default_month = month_mentions[-1] if month_mentions else current_month

        if _is_probable_header_line(line):
            continue
        if not _has_event_signal(line):
            continue

        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        date_candidates = _extract_line_date_candidates(line, default_month, session_ctx)
        line_for_name = line

        if not date_candidates and next_line:
            combined = f"{line} {next_line}"
            date_candidates = _extract_line_date_candidates(combined, default_month, session_ctx)
            line_for_name = combined

        if not date_candidates:
            continue

        event_name = _build_event_name(line_for_name, next_line)
        event_type = normalize_event_type(event_name)

        # Domain rule: ISA-marked dates and ESA weeks/ranges are exams.
        if re.search(r"\bISA[\w-]*\b|\bESA[\w-]*\b", line_for_name, flags=re.IGNORECASE):
            event_type = "Exam"
            if re.search(r"\bESA[\w-]*\b", line_for_name, flags=re.IGNORECASE):
                if re.search(r"week|[-–]", line_for_name, flags=re.IGNORECASE):
                    event_name = "End-Semester Assessment Week"
                elif "assessment" not in event_name.lower():
                    event_name = "End-Semester Assessment"
            elif "assessment" not in event_name.lower():
                event_name = "In-Semester Assessment"

        anchor_match = EVENT_CODE_REGEX.search(line_for_name)
        anchor_pos = anchor_match.start() if anchor_match else 0
        sorted_candidates = sorted(date_candidates, key=lambda item: abs(item["pos"] - anchor_pos))

        # Exam lines can legitimately carry more than one date in the same row.
        if re.search(r"\bESA[\w-]*\b", line_for_name, flags=re.IGNORECASE) and re.search(r"[-–]", line_for_name):
            max_dates = min(len(sorted_candidates), 62)
        elif re.search(r"\b(ISA|IA|RIA|ESA|FE)\b", line_for_name, flags=re.IGNORECASE):
            max_dates = 5
        else:
            max_dates = 1

        for candidate in sorted_candidates[:max_dates]:
            events.append(
                {
                    "event_name": event_name,
                    "event_date": candidate["event_date"],
                    "event_type": event_type,
                    "stream_type": stream,
                }
            )

    unique: Dict[Any, Dict[str, str]] = {}
    for event in events:
        key = (event["event_date"], event["event_name"].lower(), event["event_type"])
        if key not in unique:
            unique[key] = event

    return sorted(unique.values(), key=lambda item: (item["event_date"], item["event_name"]))


def parse_calendar_pdf(file_bytes: bytes, filename: str = "calendar.pdf") -> List[Dict]:
    """Compatibility helper for local scripts that parse a PDF directly."""
    stream = _extract_stream_from_filename(filename)
    text = extract_text_comprehensive(file_bytes)
    return parse_calendar_v2(text, stream)


# ── Database Operations (Centralized) ──────────────────────────────────────

def get_active_calendars(admin_id: str, client) -> list:
    """Fetch all active calendar assets for an admin."""
    try:
        resp = client.table('calendar_assets').select("*").eq("admin_id", admin_id).execute()
        return resp.data or []
    except Exception as e:
        print(f"Error loading calendars: {e}")
        return []

def get_calendar_events(admin_id: str, client) -> list:
    """Fetch all extracted events for an admin."""
    try:
        resp = client.table('college_events').select("*").eq("admin_id", admin_id).order("event_date").execute()
        return resp.data or []
    except Exception as e:
        print(f"Fetch events error: {e}")
        return []

async def process_calendar_upload(admin_id: str, client, file_bytes: bytes, filename: str):
    """
    The orchestrator for the 'Better Alternative' parsing.
    1. Extract Text robustly.
    2. Parse with high-accuracy heuristics.
    3. Persist to Supabase.
    """
    text = extract_text_comprehensive(file_bytes)
    stream = _extract_stream_from_filename(filename)
    
    events = parse_calendar_v2(text, stream)
    
    if not events:
        # If heuristics failed, try a very simple fallback to parsing lines with dates
        pass

    # Clear old events for this stream to avoid duplicates
    try:
        client.table('college_events').delete().eq("admin_id", admin_id).eq("stream_type", stream).execute()
    except: pass

    # Prepare for bulk insert
    objs = []
    for ev in events:
        objs.append({
            "admin_id": admin_id,
            "event_name": ev["event_name"],
            "event_date": ev["event_date"],
            "event_type": ev["event_type"],
            "stream_type": ev["stream_type"]
        })
    
    if objs:
        client.table('college_events').insert(objs).execute()
        
    # Track the uploaded asset with columns that exist in Supabase schema.
    safe_filename = Path(filename or "calendar.pdf").name or "calendar.pdf"
    safe_stream = re.sub(r"[^a-zA-Z0-9_-]+", "_", (stream or "general").strip().lower()) or "general"
    stamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    storage_path = f"{admin_id}/{safe_stream}/{stamp}_{safe_filename}"

    public_url = None
    try:
        from services.supabase_service import CALENDAR_BUCKET, upload_calendar_file, get_public_storage_url

        upload_calendar_file(storage_path, file_bytes, "application/pdf")
        public_url = get_public_storage_url(CALENDAR_BUCKET, storage_path)
    except Exception as e:
        # Do not fail calendar parsing if storage upload is unavailable.
        print(f"Calendar storage upload warning: {e}")

    asset = {
        "admin_id": admin_id,
        "file_name": safe_filename,
        "storage_path": storage_path,
        "public_url": public_url,
        "stream_type": stream,
    }
    client.table('calendar_assets').insert(asset).execute()
    
    return {
        "stream": stream,
        "events_found": len(objs),
        "status": "success"
    }

def add_manual_event(admin_id: str, client, payload: dict):
    """Add a single event manually."""
    date_val = normalize_event_date(payload.get("event_date"))
    if not date_val:
        raise HTTPException(status_code=400, detail="Invalid date format")
        
    obj = {
        "admin_id": admin_id,
        "event_name": payload.get("event_name", "Manual Event"),
        "event_date": date_val,
        "event_type": normalize_event_type(payload.get("event_type", "Other")),
        "stream_type": payload.get("stream_type", "General")
    }
    return client.table('college_events').insert(obj).execute()