const Layout = (() => {
    let activeKey = '';
    let notifs = [];
    let lastFocus = null;

    const u = (path) => Auth.url(path);
    const me = () => Auth.getUser() || {};

    /* ---------- read/unread (the API has no "mark as read" endpoint, so we track it per user in this browser) ---------- */
    const readKey = () => CONFIG.READ_KEY_PREFIX + me().id;
    function getRead() {
        try { return new Set(JSON.parse(localStorage.getItem(readKey()) || '[]')); } catch (e) { return new Set(); }
    }
    function saveRead(set) {
        try { localStorage.setItem(readKey(), JSON.stringify([...set])); } catch (e) { /* storage blocked */ }
    }
    const unreadCount = () => { const r = getRead(); return notifs.filter((n) => !r.has(n.id)).length; };

    /* ---------- icons ---------- */
    const ICON = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
        ticket: '<path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v14" stroke-dasharray="2 3"/>',
        audio: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
        video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
        users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6"/>',
        bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        help: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    };
    const svg = (name, cls = 'h-5 w-5') => `<svg aria-hidden="true" viewBox="0 0 24 24" class="${cls} shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

    /* ---------- sidebar ---------- */
    // [href (null = opens the notification drawer), label, key, icon]
    function navItems() {
        if (Auth.isAdmin()) {
            return [
                ['admin/dashboard.html', 'Overview', 'dashboard', 'grid'],
                ['events.html', 'Events management', 'events', 'calendar'],
                ['announcements.html', 'Announcements', 'announcements', 'audio'],
                ['promos.html', 'Promos management', 'promos', 'video'],
                ['admin/users.html', 'User management', 'users', 'users'],
                ['admin/notifications.html', 'Notifications', 'notifications', 'bell'],
                ['profile.html', 'My profile', 'profile', 'user'],
            ];
        }
        return [
            ['dashboard.html', 'Overview', 'overview', 'grid'],
            ['events.html', 'Explore events', 'events', 'search'],
            ['my-registrations.html', 'My registrations', 'registrations', 'ticket'],
            ['announcements.html', 'Announcements', 'announcements', 'audio'],
            ['promos.html', 'Promos', 'promos', 'video'],
            [null, 'Notifications', 'notifications', 'bell'],
            ['profile.html', 'My profile', 'profile', 'user'],
        ];
    }

    function sidebarHtml() {
        const links = navItems().map(([href, label, key, icon]) => {
            const on = key === activeKey;
            const cls = `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${on ? 'bg-action text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`;
            return href
                ? `<a href="${u(href)}" ${on ? 'aria-current="page"' : ''} class="${cls}">${svg(icon)}${label}</a>`
                : `<button type="button" class="nav-notifs ${cls}" aria-haspopup="dialog">${svg(icon)}${label}</button>`;
        }).join('');

        return `
        <div id="sidebar-overlay" class="fixed inset-0 z-40 hidden bg-navy/50 lg:hidden"></div>
        <aside id="sidebar" aria-label="Sidebar" class="fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col bg-navy text-white transition-transform duration-200 lg:translate-x-0">
            <div class="flex h-16 shrink-0 items-center gap-2.5 px-5">
                <a href="${u(Auth.isAdmin() ? 'admin/dashboard.html' : 'dashboard.html')}" class="flex items-center gap-2.5" aria-label="CivicEvents home">
                    <img src="${u('assets/civicevents-icon.svg')}" alt="" class="h-8 w-8 rounded-lg bg-white p-1">
                    <span class="text-lg font-bold">CivicEvents</span>
                </a>
                <button id="sidebar-close" type="button" class="ml-auto rounded-lg p-2 hover:bg-white/10 lg:hidden" aria-label="Close menu">✕</button>
            </div>
            <nav aria-label="Main" class="flex-1 space-y-1 overflow-y-auto px-3 py-4">${links}</nav>
            <div class="space-y-3 p-3">
                <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p class="flex items-center gap-2 text-sm font-bold"><span class="text-brand">${svg('help', 'h-5 w-5')}</span>Need a hand?</p>
                    <p class="mt-1 text-xs text-white/70">Our community team is here.</p>
                    <a href="${u('help.html')}" class="mt-2 inline-block text-xs font-bold underline underline-offset-2 hover:text-brand">Get help</a>
                </div>
                <button id="signout-btn" type="button" class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">${svg('logout')}Log out</button>
            </div>
        </aside>`;
    }

    /* ---------- top bar ---------- */
    function initials(name) {
        return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    }

    function topbarHtml() {
        const user = me();
        const role = Auth.isAdmin() ? 'Administrator' : 'Community member';
        return `
        <a href="#main" class="skip-link">Skip to main content</a>
        <header class="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
            <div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
                <button id="menu-btn" type="button" aria-controls="sidebar" aria-expanded="false" class="rounded-lg p-2 text-navy hover:bg-surface lg:hidden">
                    <span class="sr-only">Open menu</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>

                <form class="global-search relative min-w-0 max-w-md flex-1" role="search" action="${u('events.html')}">
                    <label for="global-q" class="sr-only">Search events</label>
                    <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">${svg('search', 'h-4 w-4')}</span>
                    <input id="global-q" name="q" type="search" placeholder="Search events…" autocomplete="off"
                           class="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-navy placeholder:text-muted outline-none focus:border-action focus:bg-white focus:ring-4 focus:ring-brand/20">
                </form>

                <div class="ml-auto flex items-center gap-2">
                    <button id="bell-btn" type="button" aria-haspopup="dialog" aria-controls="notif-drawer" aria-expanded="false"
                            class="relative rounded-full border border-line bg-white p-2.5 text-navy hover:bg-surface" aria-label="Notifications">
                        ${svg('bell')}
                        <span id="bell-badge" class="absolute -right-1 -top-1 hidden h-5 min-w-5 items-center justify-center rounded-full bg-action px-1 text-[11px] font-extrabold text-white" aria-hidden="true"></span>
                    </button>

                    <div class="relative">
                        <button id="profile-btn" type="button" aria-expanded="false" aria-controls="profile-menu" aria-haspopup="true"
                                class="flex items-center gap-2.5 rounded-full border border-line bg-white py-1 pl-1 pr-3 hover:bg-surface">
                            <span id="nav-initials" class="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-extrabold text-white" aria-hidden="true">${Ui.esc(initials(user.full_name))}</span>
                            <span class="hidden text-left leading-tight sm:block">
                                <span id="nav-name" class="block max-w-[9rem] truncate text-sm font-bold">${Ui.esc(user.full_name)}</span>
                                <span class="block text-xs text-muted">${role}</span>
                            </span>
                            <span class="sr-only">Account menu</span>
                        </button>
                        <div id="profile-menu" class="absolute right-0 mt-2 hidden w-64 rounded-xl bg-white p-2 text-navy shadow-card ring-1 ring-line">
                            <div class="px-3 py-2">
                                <p id="menu-name" class="truncate text-sm font-extrabold">${Ui.esc(user.full_name)}</p>
                                <p id="menu-email" class="truncate text-xs text-muted">${Ui.esc(user.email)}</p>
                                <p class="mt-1 inline-block rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-action-dark">${Ui.esc(user.role)}</p>
                            </div>
                            <hr class="my-1 border-line">
                            <a href="${u('profile.html')}" class="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface">My profile</a>
                            ${Auth.isAdmin() ? '' : `<a href="${u('my-registrations.html')}" class="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface">My registrations</a>`}
                            <a href="${u('help.html')}" class="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface">Help</a>
                            <button id="signout-menu" type="button" class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-action-dark hover:bg-surface">Sign out</button>
                        </div>
                    </div>
                </div>
            </div>
        </header>`;
    }

    /* ---------- footer (also used by the public pages) ---------- */
    function footerHtml() {
        return `
        <footer class="mt-20 bg-navy text-white">
            <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
                <div class="md:col-span-2">
                    <div class="flex items-center gap-2.5">
                        <img src="${u('assets/civicevents-icon.svg')}" alt="" class="h-8 w-8 rounded-lg bg-white p-1">
                        <span class="text-lg font-bold">CivicEvents</span>
                    </div>
                    <p class="mt-4 max-w-sm text-sm leading-relaxed text-white/70">Discover. Connect. Participate. A more accessible city starts with all of us.</p>
                </div>
                <div>
                    <h2 class="text-xs font-bold uppercase tracking-[0.16em] text-brand">Explore</h2>
                    <ul class="mt-4 space-y-2.5 text-sm text-white/80">
                        <li><a class="hover:text-white hover:underline" href="${u('events.html')}">Events</a></li>
                        <li><a class="hover:text-white hover:underline" href="${u('announcements.html')}">Announcements</a></li>
                        <li><a class="hover:text-white hover:underline" href="${u('promos.html')}">Promos</a></li>
                        <li><a class="hover:text-white hover:underline" href="${u('about.html')}">About</a></li>
                        <li><a class="hover:text-white hover:underline" href="${u('help.html')}">Help</a></li>
                    </ul>
                </div>
                <div>
                    <h2 class="text-xs font-bold uppercase tracking-[0.16em] text-brand">Help &amp; contact</h2>
                    <ul class="mt-4 space-y-2.5 text-sm text-white/80">
                        <li><a class="hover:text-white hover:underline" href="mailto:help@civicevents.com">help@civicevents.com</a></li>
                        <li>Mon to Fri, 8:00 to 17:00 (CAT)</li>
                        <li>Audio announcements and captioned videos are available throughout the site.</li>
                    </ul>
                </div>
            </div>
            <div class="border-t border-white/10 px-4 py-5 text-center text-xs text-white/60">© ${new Date().getFullYear()} CivicEvents. Built in Kigali, Rwanda, for the community.</div>
        </footer>`;
    }

    /* ---------- slim footer for the signed-in shell (white, no navy block) ---------- */
    function shellFooterHtml() {
        return `
        <footer class="mt-16 border-t border-line px-4 py-6 text-sm text-muted sm:px-6 lg:px-8">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>© ${new Date().getFullYear()} CivicEvents. Built in Kigali, Rwanda, for the community.</p>
                <ul class="flex flex-wrap items-center gap-x-5 gap-y-2 font-semibold">
                    <li><a class="hover:text-action hover:underline" href="${u('about.html')}">About</a></li>
                    <li><a class="hover:text-action hover:underline" href="${u('help.html')}">Help</a></li>
                    <li><a class="hover:text-action hover:underline" href="mailto:help@civicevents.com">help@civicevents.com</a></li>
                    <li class="font-normal">Mon to Fri, 8:00 to 17:00 (CAT)</li>
                </ul>
            </div>
        </footer>`;
    }

    /* ---------- notification drawer ---------- */
    function drawerHtml() {
        return `
        <div id="notif-overlay" class="fixed inset-0 z-[80] hidden bg-navy/50"></div>
        <aside id="notif-drawer" role="dialog" aria-modal="true" aria-labelledby="notif-title" tabindex="-1"
               class="fixed inset-y-0 right-0 z-[90] flex w-full max-w-md translate-x-full flex-col bg-white shadow-2xl transition-transform duration-200">
            <div class="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 id="notif-title" class="text-lg font-extrabold text-navy">Notifications</h2>
                <div class="flex items-center gap-2">
                    <button id="mark-all" type="button" class="rounded-lg px-2 py-1 text-xs font-bold text-action hover:underline">Mark all as read</button>
                    <button id="notif-close" type="button" class="rounded-lg p-2 text-navy hover:bg-surface" aria-label="Close notifications">✕</button>
                </div>
            </div>
            <div id="notif-body" class="flex-1 overflow-y-auto p-3" aria-live="polite"></div>
        </aside>`;
    }

    function relatedLink(n) {
        const m = n.metadata || {};
        if (m.event_id) return { href: u('event-detail.html?id=' + m.event_id), label: 'View event' };
        if (m.promo_id) return { href: u('promo-detail.html?id=' + m.promo_id), label: 'View promo' };
        if (m.announcement_id) return { href: u('announcement-detail.html?id=' + m.announcement_id), label: 'Listen to announcement' };
        return null;
    }

    function updateBadge() {
        const n = unreadCount();
        const $b = $('#bell-badge');
        $b.text(n > 9 ? '9+' : n).toggleClass('hidden', n === 0).toggleClass('flex', n > 0);
        $('#bell-btn').attr('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
    }

    function renderList() {
        const read = getRead();
        const $body = $('#notif-body');
        $('#mark-all').toggle(notifs.length > 0);
        if (!notifs.length) {
            $body.html('<div class="px-4 py-16 text-center"><p class="text-base font-extrabold text-navy">You are all caught up</p><p class="mt-1 text-sm text-muted">New event, promo and announcement alerts will show up here.</p></div>');
            return;
        }
        const items = notifs.map((n) => {
            const isRead = read.has(n.id);
            return `<li><button type="button" data-id="${Ui.esc(n.id)}" class="notif-item flex w-full gap-3 rounded-xl p-3 text-left hover:bg-surface">
                <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${isRead ? 'bg-transparent' : 'bg-action'}" aria-hidden="true"></span>
                <span class="min-w-0 flex-1">
                    ${isRead ? '' : '<span class="sr-only">Unread: </span>'}
                    <span class="block text-sm ${isRead ? 'font-semibold' : 'font-extrabold'} text-navy">${Ui.esc(n.title)}</span>
                    <span class="mt-0.5 line-clamp-2 block text-sm text-muted">${Ui.esc(n.message)}</span>
                    <span class="mt-1.5 flex items-center gap-2 text-xs text-muted">
                        <span class="rounded-full bg-tint px-2 py-0.5 font-bold uppercase tracking-wide text-action-dark">${Ui.esc(n.type)}</span>
                        <span>${Ui.timeAgo(n.created_at)}</span>
                    </span>
                </span></button></li>`;
        }).join('');
        $body.html(`<ul class="space-y-1">${items}</ul>`);
    }

    function renderDetail(n) {
        const link = relatedLink(n);
        const isAdmin = Auth.isAdmin();
        $('#notif-body').html(`
            <div class="p-3">
                <button type="button" id="notif-back" class="mb-4 text-sm font-bold text-action hover:underline">← Back to notifications</button>
                <span class="rounded-full bg-tint px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-action-dark">${Ui.esc(n.type)}</span>
                <h3 class="mt-3 text-xl font-extrabold text-navy">${Ui.esc(n.title)}</h3>
                <p class="mt-1 text-xs text-muted">${Ui.esc(Ui.fmtDateTime(n.created_at))}</p>
                <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-navy">${Ui.esc(n.message)}</p>
                <div class="mt-6 flex flex-wrap gap-3">
                    ${link ? `<a href="${link.href}" class="rounded-xl bg-action px-4 py-2.5 text-sm font-bold text-white hover:bg-action-dark">${link.label} →</a>` : ''}
                    ${isAdmin ? `<button type="button" id="notif-delete" data-id="${Ui.esc(n.id)}" class="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50">Delete notification</button>` : ''}
                </div>
            </div>`);
        $('#notif-back').trigger('focus');
    }

    async function loadNotifs(showSkeleton) {
        if (showSkeleton) {
            $('#notif-body').html('<div class="space-y-3 p-2" aria-busy="true"><div class="skeleton h-20"></div><div class="skeleton h-20"></div><div class="skeleton h-20"></div></div>');
        }
        try {
            const res = await Api.notifications.list();
            notifs = res.data || [];
            updateBadge();
            if ($('#notif-drawer').hasClass('is-open') && !$('#notif-back').length) renderList();
        } catch (err) {
            if (showSkeleton) {
                $('#notif-body').html(`<div class="px-4 py-12 text-center"><p class="text-sm font-semibold text-red-700">${Ui.esc(err.message)}</p>
                    <button type="button" id="notif-retry" class="mt-4 rounded-xl bg-action px-4 py-2.5 text-sm font-bold text-white hover:bg-action-dark">Try again</button></div>`);
            }
        }
    }

    function openDrawer() {
        lastFocus = document.activeElement;
        closeSidebar();
        $('#notif-overlay').removeClass('hidden');
        $('#notif-drawer').addClass('is-open').removeClass('translate-x-full');
        $('#bell-btn').attr('aria-expanded', 'true');
        $('#notif-close').trigger('focus');
        loadNotifs(!notifs.length);
        if (notifs.length) renderList();
    }

    function closeDrawer() {
        $('#notif-overlay').addClass('hidden');
        $('#notif-drawer').removeClass('is-open').addClass('translate-x-full');
        $('#bell-btn').attr('aria-expanded', 'false');
        if (lastFocus) lastFocus.focus();
    }

    /* ---------- mobile sidebar ---------- */
    function openSidebar() {
        $('#sidebar').removeClass('-translate-x-full');
        $('#sidebar-overlay').removeClass('hidden');
        $('#menu-btn').attr('aria-expanded', 'true');
    }
    function closeSidebar() {
        $('#sidebar').addClass('-translate-x-full');
        $('#sidebar-overlay').addClass('hidden');
        $('#menu-btn').attr('aria-expanded', 'false');
    }

    /* ---------- wiring ---------- */
    function bind() {
        // Sidebar (mobile)
        $('#menu-btn').on('click', openSidebar);
        $('#sidebar-close, #sidebar-overlay').on('click', closeSidebar);
        $('#sidebar a').on('click', closeSidebar);
        $('#sidebar .nav-notifs').on('click', openDrawer);
        $('#signout-btn, #signout-menu').on('click', () => Auth.logout('You have been signed out.', 'success'));

        // Profile dropdown
        $('#profile-btn').on('click', function (e) {
            e.stopPropagation();
            const open = $('#profile-menu').toggleClass('hidden').is(':visible');
            $(this).attr('aria-expanded', open);
        });
        $(document).on('click', (e) => {
            if (!$(e.target).closest('#profile-menu, #profile-btn').length) {
                $('#profile-menu').addClass('hidden');
                $('#profile-btn').attr('aria-expanded', 'false');
            }
        });

        // Notifications
        $('#bell-btn').on('click', openDrawer);
        $('#notif-close, #notif-overlay').on('click', closeDrawer);
        $(document).on('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if ($('#notif-drawer').hasClass('is-open')) closeDrawer();
            closeSidebar();
            $('#profile-menu').addClass('hidden');
        });

        $('#mark-all').on('click', () => {
            saveRead(new Set(notifs.map((n) => n.id)));
            updateBadge();
            renderList();
        });

        $('#notif-body').on('click', '.notif-item', function () {
            const id = $(this).data('id');
            const n = notifs.find((x) => x.id === id);
            if (!n) return;
            // Optimistic: mark read immediately (stored locally, nothing to fail)
            const read = getRead(); read.add(id); saveRead(read); updateBadge();
            renderDetail(n);
        });
        $('#notif-body').on('click', '#notif-back', () => { renderList(); $('#notif-close').trigger('focus'); });
        $('#notif-body').on('click', '#notif-retry', () => loadNotifs(true));

        // Admin only (the backend also enforces this with a 403)
        $('#notif-body').on('click', '#notif-delete', async function () {
            const id = $(this).data('id');
            const ok = await Ui.confirm({ title: 'Delete this notification?', message: 'It will be removed for every user.', confirmText: 'Delete' });
            if (!ok) return;
            try {
                await Api.notifications.remove(id);
                notifs = notifs.filter((n) => n.id !== id);
                updateBadge();
                renderList();
                Ui.toast('success', 'Notification deleted.');
            } catch (err) {
                Ui.toast('error', err.message);
            }
        });

        // Keep Tab inside the open drawer
        $('#notif-drawer').on('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const $f = $('#notif-drawer').find('button, a[href]').filter(':visible');
            if (!$f.length) return;
            const first = $f[0], last = $f[$f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    function mount(active) {
        activeKey = active || '';
        $('body').addClass('lg:pl-64'); // leave room for the fixed sidebar on desktop
        $('#app-header').html(topbarHtml());
        $('#app-footer').html(shellFooterHtml());
        $('body').append(sidebarHtml()).append(drawerHtml());
        bind();
        // Prefill the search box when arriving from a search
        const q = new URLSearchParams(location.search).get('q');
        if (q) $('.global-search input').val(q);
        loadNotifs(false); // fills the bell badge
    }

    // Update the name/email shown in the top bar after a profile edit (without re-mounting the whole layout)
    function refreshUser() {
        const user = me();
        $('#nav-initials').text(initials(user.full_name));
        $('#nav-name').text(user.full_name);
        $('#menu-name').text(user.full_name);
        $('#menu-email').text(user.email);
    }

    return { mount, refreshUser, footerHtml };
})();