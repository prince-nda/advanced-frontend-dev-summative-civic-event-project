/**
 * Left sidebar for the admin pages (vertical navy card on desktop, scrollable pills on mobile).
 * Usage: AdminNav.mount('dashboard')  with <aside id="admin-nav"></aside> on the page.
 *
 * ROLE GUARD: this sidebar is only mounted by pages that already called Auth.requireAdmin().
 * Requires: jQuery, auth.js
 */
const AdminNav = (() => {
    const ICON = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
        audio: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
        video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
        users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6"/>',
        bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    };
    const ITEMS = [
        ['admin/dashboard.html', 'Overview', 'dashboard', 'grid'],
        ['events.html', 'Events management', 'events', 'calendar'],
        ['announcements.html', 'Announcements', 'announcements', 'audio'],
        ['promos.html', 'Promos management', 'promos', 'video'],
        ['admin/users.html', 'User management', 'users', 'users'],
        ['admin/notifications.html', 'Notifications', 'notifications', 'bell'],
    ];

    function mount(active) {
        const links = ITEMS.map(([href, label, key, icon]) => {
            const on = key === active;
            return `<a href="${Auth.url(href)}" ${on ? 'aria-current="page"' : ''}
                class="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold whitespace-nowrap ${on ? 'bg-action text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}">
                <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</svg>${label}</a>`;
        }).join('');
        $('#admin-nav').html(`<nav aria-label="Admin sections" class="flex gap-2 overflow-x-auto rounded-2xl bg-navy p-2 lg:flex-col lg:gap-1 lg:p-3">${links}</nav>`);
    }

    return { mount };
})();