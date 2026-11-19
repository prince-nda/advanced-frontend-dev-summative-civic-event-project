const Auth = (() => {
    const { TOKEN_KEY, USER_KEY, FLASH_KEY } = CONFIG;

    /* ---------- storage helpers ---------- */

    // Which storage currently holds the session (null if logged out)
    function activeStore() {
        try {
            if (localStorage.getItem(TOKEN_KEY)) return localStorage;
            if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
        } catch (e) { /* storage blocked */ }
        return null;
    }

    function save(token, user, remember = false) {
        clear();
        const store = remember ? localStorage : sessionStorage;
        store.setItem(TOKEN_KEY, token);
        // Only keep what the UI needs: { id, full_name, email, role }
        store.setItem(USER_KEY, JSON.stringify({
            id: user.id, full_name: user.full_name, email: user.email, role: user.role,
        }));
    }

    function clear() {
        [localStorage, sessionStorage].forEach((s) => {
            try { s.removeItem(TOKEN_KEY); s.removeItem(USER_KEY); } catch (e) { /* ignore */ }
        });
    }

    function getToken() {
        const s = activeStore();
        return s ? s.getItem(TOKEN_KEY) : null;
    }

    function getUser() {
        const s = activeStore();
        if (!s) return null;
        try { return JSON.parse(s.getItem(USER_KEY)); } catch (e) { return null; }
    }

    // Update the cached user after a profile edit, keeping the same storage
    function updateUser(partial) {
        const s = activeStore();
        if (!s) return;
        s.setItem(USER_KEY, JSON.stringify({ ...getUser(), ...partial }));
    }

    /* ---------- token expiry ---------- */

    function decodeToken(token) {
        try {
            const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(b64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
            );
            return JSON.parse(json);
        } catch (e) { return null; }
    }

    function isTokenExpired(token = getToken()) {
        const payload = token && decodeToken(token);
        if (!payload || !payload.exp) return true;
        return payload.exp * 1000 <= Date.now();
    }

    const isLoggedIn = () => !!getToken() && !isTokenExpired();
    const isAdmin = () => isLoggedIn() && (getUser() || {}).role === 'admin';

    /* ---------- navigation helpers ---------- */

    // Pages inside /admin/ need '../' to reach shared pages
    function url(page) {
        return (location.pathname.includes('/admin/') ? '../' : '') + page;
    }
    const homeUrl = () => url(isAdmin() ? 'admin/dashboard.html' : 'events.html');

    /* ---------- one-shot messages across redirects ---------- */

    function setFlash(type, message) {
        try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message })); } catch (e) { /* ignore */ }
    }
    function takeFlash() {
        try {
            const raw = sessionStorage.getItem(FLASH_KEY);
            sessionStorage.removeItem(FLASH_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    /* ---------- sign out ---------- */

    function logout(message, type = 'info') {
        clear();
        if (message) setFlash(type, message);
        location.href = url('login.html');
    }

    /* =====================================================================
     * ROLE-BASED ACCESS GUARDS (UX layer; the backend is the real security)
     * ===================================================================== */

    /**
     * GUARD 1 - any signed-in user.
     * Call at the top of every protected page. A missing or expired token
     * sends the visitor to login (with an "expired" message when applicable).
     */
    function requireAuth() {
        const hadToken = !!getToken();
        if (!isLoggedIn()) {
            logout(hadToken ? 'Your session has expired. Please log in again.' : 'Please log in to continue.',
                hadToken ? 'error' : 'info');
            return null;
        }
        return getUser();
    }

    /**
     * GUARD 2 - admin only pages (dashboard, user management, event/promo/announcement forms).
     * A normal user who opens one of these URLs is bounced to the events page.
     * (If they bypass this guard, the backend still answers 403 Forbidden.)
     */
    function requireAdmin() {
        const user = requireAuth();
        if (!user) return null;
        if (user.role !== 'admin') {
            setFlash('error', 'You do not have permission to view that page.');
            location.href = url('events.html');
            return null;
        }
        return user;
    }

    /**
     * GUARD 3 - login/signup pages: skip them if already signed in.
     */
    function redirectIfLoggedIn() {
        if (isLoggedIn()) location.href = homeUrl();
    }

    /**
     * GUARD 4 - element-level visibility, driven by HTML attributes:
     *   <a data-role="admin">   shown to admins only (REMOVED from the DOM for others)
     *   <button data-role="user"> shown to normal users only (e.g. Register button)
     * Removing (not just hiding) keeps admin controls out of the page for normal users.
     * Call once after the navbar/page markup exists; call again after injecting new HTML.
     */
    function applyRoleUI(root = document) {
        const admin = isAdmin();
        $(root).find('[data-role="admin"]').each(function () { if (!admin) $(this).remove(); });
        $(root).find('[data-role="user"]').each(function () { if (admin) $(this).remove(); });
    }

    return {
        save, clear, getToken, getUser, updateUser,
        isLoggedIn, isAdmin, isTokenExpired, decodeToken,
        url, homeUrl, setFlash, takeFlash, logout,
        requireAuth, requireAdmin, redirectIfLoggedIn, applyRoleUI,
    };
})();