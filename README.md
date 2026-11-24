# CivicEvents+ (Advanced Frontend Development summative)

Accessible, responsive city events portal.

- **Frontend** (HTML, Tailwind CSS, jQuery): [`frontend/`](frontend/)
- **Backend** (provided, not modified): [`backend/`](backend/)

**Full instructions (setup, backend URL, environment variables, role guards, API notes):
[frontend/README.md](frontend/README.md)**

## Quick start

1. Set up the backend as described in [`backend/README.md`](backend/README.md) (database, migration, `.env`), then run `npm run dev` inside `backend/`. The API runs at `http://localhost:4000`.
2. Serve the frontend:
   ```bash
   cd frontend
   python3 -m http.server 5500
   ```
3. Open <http://localhost:5500/login.html>.

The backend address used by the frontend is set in [`frontend/js/config.js`](frontend/js/config.js) (`API_BASE_URL`).