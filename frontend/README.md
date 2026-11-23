# UI Implementation

# CivicEvents+ Frontend

An accessible, responsive city events and services portal. This is the **frontend only**. It consumes the
provided CivicEvents+ backend API (Node.js, Express, PostgreSQL), which is **not modified** in this repository.

**Tech:** HTML, Tailwind CSS (CDN) and jQuery only. No frameworks and no build step.

## Features

| Area | Normal user | Admin |
|---|---|---|
| Public pages | Home, About and Help (FAQ) are open to everyone | Same |
| Auth | Sign up (password strength meter, strong-password policy), log in, remember me, session expiry handling | Same |
| Events | Browse with search, date and location filters, pagination; view details; register and cancel; leave feedback (rating 1 to 5 and comment) | Create, edit and delete events with image upload (preview, type and size checks, progress bar); see attendees and all feedback with the average rating |
| Announcements | List, play audio, detail page with accessible player (time, skip, speed) | Upload audio, edit title, publish, unpublish, delete |
| Promos | List with lazy-loaded thumbnails, video detail page with captions and transcript | Upload video and caption text, edit, publish, unpublish, delete |
| Notifications | Bell with unread count, drawer, detail with link to the related item | Same, plus delete (drawer and admin page) |
| Profile | View profile, edit name and email (conflict message), activity summary, my registrations | Same profile page |
| Overview | Personal overview: numbers, next event, recent activity, events to explore | n/a |
| Dashboard | n/a | Stats, new-users-per-month chart, events overview, auto-refresh |
| Users | n/a | List, search, filter, view, enable and disable (roles cannot be changed from the UI) |

## Run it locally

### 1. Backend (provided, do not modify)

1. Install Node.js 18+, PostgreSQL 15+ and (optionally) pgAdmin.
2. Create the database: `CREATE DATABASE "civic-events-db";`
3. From the repository root, create the tables:
   ```bash
   cd backend
   psql -U <db-user> -d civic-events-db -h localhost -p 5432 -f ./migrations/001_create_tables.sql
   ```
4. Set the values in `backend/.env` (use your own, never commit real secrets):

   | Variable | Example | Purpose |
   |---|---|---|
   | `PORT` | `4000` | Port the API listens on |
   | `DB_USER` | `your_db_user` | PostgreSQL user |
   | `DB_PASS` | `your_db_password` | PostgreSQL password (leave empty if none) |
   | `DB_HOST` | `localhost` | Database host |
   | `DB_PORT` | `5432` | Database port |
   | `DB_NAME` | `civic-events-db` | Database name |
   | `JWT_SECRET` | `a_long_random_string` | Secret used to sign login tokens |

5. Start the API:
   ```bash
   npm install
   npm run dev
   ```
   You should see `CivicEvents+ backend listening on port 4000` and `Connected to PostgreSQL`.

### 2. Frontend

The frontend needs **no environment variables and no build step**. The backend address is set in one place,
[`js/config.js`](js/config.js):

```js
API_BASE_URL: 'http://localhost:4000'
```

Serve the `frontend/` folder with any static server (do not double-click the HTML files):

```bash
cd frontend
python3 -m http.server 5500
```

Then open <http://localhost:5500/login.html>. (VS Code "Live Server" also works.)
The backend allows requests from any origin (CORS is open), so any local port works.

### 3. Accounts for testing

Sign up through the UI (`signup.html`). New accounts are always normal users. To make an admin, promote one in the database:

```bash
psql -U <db-user> -d civic-events-db -h localhost -p 5432 \
  -c "UPDATE users SET role = 'admin' WHERE email = 'your-admin@example.com';"
```

Then sign in again so the new token carries the admin role.

## Project structure

```
frontend/
├── index.html                 public landing page (Home); about.html and help.html are public too
├── login.html, signup.html
├── dashboard.html             signed-in user's overview (admins go to admin/dashboard.html)
├── events.html, event-detail.html, event-form.html (admin)
├── announcements.html, announcement-detail.html
├── promos.html, promo-detail.html
├── my-registrations.html, profile.html
├── admin/                     dashboard.html, users.html, notifications.html (admin only)
├── assets/                    logos
├── css/styles.css             focus ring, spinner, skeleton loader, strength meter
└── js/
    ├── config.js              API base URL, storage keys, upload limits, password regex
    ├── auth.js                session storage, token expiry, ROLE GUARDS
    ├── api.js                 jQuery ajax wrapper and the full endpoint map
    ├── ui.js                  toasts, confirm dialog, formatting helpers
    ├── layout.js              signed-in shell: sidebar, top bar, footer, notification drawer
    ├── public-layout.js       navbar + footer for the public pages (index, about, help)
    ├── tailwind-config.js     brand colors (navy, pink) and the Manrope font
    └── pages/                 one script per page (admin pages in pages/admin/)
```

## Rwanda focus

- Event times are entered and shown in **Rwanda time (Central Africa Time, UTC+2, no daylight saving)**, whatever time zone the visitor's device uses. Dates are shown day-month-year.
- Copy and examples refer to Rwanda (for example the landing page greeting "Murakaza neza").

## Photos

- `assets/auth-bg.jpg`: background of the login and signup pages (shown under a navy overlay).
- `assets/hero.jpg`: the landing page hero photo. If it is missing, a plain navy panel is shown instead.

Photos were provided by the project author. Credit the photographers if you publish the site.

## Authentication and token storage

- The token and the user (`{ id, full_name, email, role }`) are stored by `js/auth.js`.
- **Remember me ticked:** `localStorage` (survives closing the browser). Trade-off: any script on the page can read it, so an XSS bug would expose the token. All API text is escaped before it is rendered.
- **Not ticked:** `sessionStorage` (cleared when the tab closes).
- Every protected request sends `Authorization: Bearer <token>` (added in `js/api.js`).
- Tokens last one hour. An expired or rejected token signs the user out and shows a "session expired" message on the login page (`401` handling in `api.js`).

## Role-based access guards (where they are)

These guards are for user experience only. **The backend is the real security**: it rejects unauthorised calls with `401` or `403`.

| Where | Guard | Effect |
|---|---|---|
| `js/auth.js` | `requireAuth()` | Any protected page: no valid token sends the visitor to login |
| `js/auth.js` | `requireAdmin()` | Admin pages: a normal user is sent to the events page with a message |
| `js/auth.js` | `redirectIfLoggedIn()` | Login and signup skip if already signed in |
| `js/auth.js` | `applyRoleUI()` | Removes elements marked `data-role="admin"` or `data-role="user"` from the page |
| `js/layout.js` | `Auth.isAdmin()` | The sidebar shows admin items (dashboard, user management, notifications page) to admins only, and notification delete renders for admins only |
| `js/pages/events.js` | `isAdmin` | Create, edit and delete buttons render for admins only; Register renders for normal users only |
| `js/pages/event-form.js`, `js/pages/admin/*.js` | `requireAdmin()` | Whole page is admin only |
| `js/pages/event-detail.js` | `isAdmin` | Attendees table and all feedback for admins; register, cancel and feedback form for users |
| `js/pages/announcements.js`, `promos.js` | `isAdmin` | Upload, edit, publish, unpublish and delete for admins only |
| `js/api.js` | `401` and `403` handling | `401` signs out; `403` shows a "no permission" message |

The signup form never sends a `role` field, and the profile form never sends `role` or `is_active`.

## Notes about the provided backend

The UI follows the API exactly as provided. A few behaviours shaped the design:

- **Every endpoint needs a login**, so there is no public page with live data. All content pages require sign-in.
- **No server-side event filters or pagination.** Search, date and location filters and pagination for events are done in the browser.
- **No `published` flag for events.** Every event is published, so the event form has no publish toggle.
- **Feedback per event is admin-only** in the API, so normal users see their own feedback and a form; admins see everyone's feedback and the average rating.
- **A cancelled registration cannot be re-created** (the API keeps the row and refuses a second registration), so the UI explains this.
- **Announcements:** no duration or transcript fields (the length is read from the audio file and the transcript section says none is provided); editing changes the title only.
- **Promos:** captions are stored as text (`caption_text`). Start the text with a language tag such as `[rw]` (Kinyarwanda), `[en]`, `[fr]` or `[sw]` to label the caption track (default English); paste a full WebVTT file for exact timing. The browser turns the text into a WebVTT track, spread evenly across the video length, so captions are evenly paced rather than frame-accurate.
- **No "mark notification as read" endpoint.** Read state is kept per user in `localStorage`. Notifications cannot be created by hand; the backend creates them when events, promos and announcements are added.
- **Disabled users can still log in at the API level.** The login page checks `is_active` right after sign-in and blocks disabled accounts.
- **Upload limits** (checked in the browser before uploading): images 2 MB (jpg, png, gif), video 8 MB (mp4, mov, avi, mkv), audio 5 MB (mp3, wav, m4a, ogg).

## Accessibility

Semantic HTML landmarks and skip links; labels on every input and file input; `aria-live` regions for toasts, results and errors;
visible keyboard focus; native `<dialog>` for confirmations; a notification drawer with focus handling and Escape to close;
captions and transcripts for video; audio with keyboard controls and a download fallback; `prefers-reduced-motion` respected;
text colours chosen for AA contrast (the bright pink `#FF3D8B` is used for decoration and on navy; `#D7297E` is used for text and buttons on white);
responsive from phone to desktop.

## Performance and UX

Skeleton loaders on every list, empty and error states with retry, lazy-loaded video thumbnails, a one-minute promo list cache that is cleared on every change,
optimistic updates (register, cancel, mark read) that revert on failure, toasts, confirmation dialogs, upload progress bars and instant client-side validation.