# Bharat-MAS Dashboard Frontend

This is the Next.js frontend for the Bharat-MAS project.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
# Optional: configure backend endpoints (copy from .env.example)
# NEXT_PUBLIC_API_URL=http://127.0.0.1:5500
# NEXT_PUBLIC_WS_URL=ws://127.0.0.1:5500/ws/analyze

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the main dashboard.

## Admin Features & Auth

The admin portal is available at `/admin`. This allows managing the canteen inventory and application settings. (Menu management is currently disabled).

### Authentication

The application has been hardened with proper authentication for the admin panel:

- Default admin password is `admin123`.
- In production, set the environmental variable `ADMIN_PASSWORD` on the backend, or `NEXT_PUBLIC_ADMIN_PASSWORD` loosely on the frontend.
- The backend provides a file-backed token store to create session tokens.
- Protected routes include `/admin`, `/admin/inventory`, and `/admin/settings`. (/admin/menu is disabled).
- If a user is not authenticated, they will be forcibly redirected to `/admin` utilizing the `isAuthenticated()` helper.

### UI & Styling

The admin feature interfaces are built utilizing **Tailwind CSS**, designed with an attractive and futuristic dashboard style (`bg-slate-800`), dark mode aesthetics, and robust validations preventing empty names or negative quantities from being submitted to the APIs.

## Available Features

- **Overview**: AI-powered dashboard offering inventory advice and live API signals.
- **Inventory**: Full CRUD capabilities backed by our Python FastAPI application. (Menu is currently disabled).
- **Settings**: Control working hours and application variables.

See the `backend/` directory for FastAPI deployment and backend tests (`pytest`).
