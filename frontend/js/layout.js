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
    const BELL = '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
    const SEARCH = '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';

    /* ---------- header ---------- */
    function navLinks(mobile) {
        const items = [
            ['events.html', 'Events', 'events'],
            ['announcements.html', 'Announcements', 'announcements'],
            ['promos.html', 'Promos', 'promos'],
        ];
        // Admin-only links: not rendered at all for normal users
        if (Auth.isAdmin()) {
            items.push(['admin/dashboard.html', 'Dashboard', 'dashboard']);
            items.push(['admin/events.html', 'Admin', 'admin']);
        }
        return items.map(([href, label, key]) => {
            const on = key === activeKey;
            const base = mobile ? 'block rounded-lg px-3 py-3 text-base' : 'rounded-lg px-3 py-2 text-sm';
            return `<a href="${u(href)}" ${on ? 'aria-current="page"' : ''} class="${base} font-semibold ${on ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'}">${label}</a>`;
        }).join('');
    }

    function initials(name) {
        return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    }

    function headerHtml() {
        const user = me();
        const searchForm = (id) => `
            <form class="global-search relative w-full" role="search" action="${u('events.html')}">
                <label for="${id}" class="sr-only">Search events</label>
                <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60">${SEARCH}</span>
                <input id="${id}" name="q" type="search" placeholder="Search events…" autocomplete="off"
                       class="w-full rounded-full border border-white/15 bg-white/10 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/60 outline-none focus:border-brand focus:bg-white/15">
            </form>`;

        return `
        <a href="#main" class="skip-link">Skip to main content</a>
        <header class="sticky top-0 z-40 bg-navy text-white">
            <div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
                <a href="${u('events.html')}" class="flex shrink-0 items-center gap-2.5" aria-label="CivicEvents home">
                    <img src="${u('assets/civicevents-icon.svg')}" alt="" class="h-8 w-8 rounded-lg bg-white p-1">
                    <span class="hidden text-lg font-bold sm:inline">CivicEvents</span>
                </a>

                <nav aria-label="Main" class="ml-4 hidden items-center gap-1 lg:flex">${navLinks(false)}</nav>

                <div class="ml-auto hidden max-w-xs flex-1 md:block">${searchForm('global-q')}</div>

                <button id="bell-btn" type="button" aria-haspopup="dialog" aria-controls="notif-drawer" aria-expanded="false"
                        class="relative ml-auto rounded-full p-2.5 text-white hover:bg-white/10 md:ml-0" aria-label="Notifications">
                    ${BELL}
                    <span id="bell-badge" class="absolute -right-0.5 -top-0.5 hidden h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-extrabold text-navy" aria-hidden="true"></span>
                </button>

                <div class="relative">
                    <button id="profile-btn" type="button" aria-expanded="false" aria-controls="profile-menu" aria-haspopup="true"
                            class="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-white/10 sm:pr-3">
                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-navy" aria-hidden="true">${Ui.esc(initials(user.full_name))}</span>
                        <span class="hidden text-sm font-semibold sm:inline">${Ui.esc((user.full_name || '').split(' ')[0])}</span>
                        <span class="sr-only">Account menu</span>
                    </button>
                    <div id="profile-menu" class="absolute right-0 mt-2 hidden w-64 rounded-xl bg-white p-2 text-navy shadow-card ring-1 ring-line">
                        <div class="px-3 py-2">
                            <p class="truncate text-sm font-extrabold">${Ui.esc(user.full_name)}</p>
                            <p class="truncate text-xs text-muted">${Ui.esc(user.email)}</p>
                            <p class="mt-1 inline-block rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-action-dark">${Ui.esc(user.role)}</p>
                        </div>
                        <hr class="my-1 border-line">
                        <a href="${u('profile.html')}" class="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface">My profile</a>
                        ${Auth.isAdmin() ? '' : `<a href="${u('my-registrations.html')}" class="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface">My registrations</a>`}
                        <button id="signout-btn" type="button" class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-action-dark hover:bg-surface">Sign out</button>
                    </div>
                </div>

                <button id="menu-btn" type="button" aria-controls="mobile-nav" aria-expanded="false" class="rounded-lg p-2 hover:bg-white/10 lg:hidden">
                    <span class="sr-only">Open menu</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>

            <div id="mobile-nav" class="hidden border-t border-white/10 px-4 pb-4 pt-3 lg:hidden">
                <div class="mb-3 md:hidden">${searchForm('global-q-mobile')}</div>
                <nav aria-label="Mobile" class="space-y-1">${navLinks(true)}</nav>
            </div>
        </header>`;
    }

    /* ---------- footer ---------- */
    function footerHtml() {
        return `
        <footer class="mt-20 bg-navy text-white">
            <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
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
                        <li><a class="hover:text-white hover:underline" href="${u('profile.html')}">My profile</a></li>
                    </ul>
                </div>
                <div>
                    <h2 class="text-xs font-bold uppercase tracking-[0.16em] text-brand">Help &amp; contact</h2>
                    <ul class="mt-4 space-y-2.5 text-sm text-white/80">
                        <li><a class="hover:text-white hover:underline" href="mailto:help@civicevents.example">help@civicevents.example</a></li>
                        <li>Mon to Fri, 8:00 to 17:00</li>
                        <li>Audio announcements and captioned videos are available on every page that uses media.</li>
                    </ul>
                </div>
            </div>
            <div class="border-t border-white/10 px-4 py-5 text-center text-xs text-white/60">© ${new Date().getFullYear()} CivicEvents. Built for the community.</div>
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

    /* ---------- wiring ---------- */
    function bind() {
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
        $('#signout-btn').on('click', () => Auth.logout('You have been signed out.', 'success'));

        // Mobile menu
        $('#menu-btn').on('click', function () {
            const open = $('#mobile-nav').toggleClass('hidden').is(':visible');
            $(this).attr('aria-expanded', open);
        });

        // Notifications
        $('#bell-btn').on('click', openDrawer);
        $('#notif-close, #notif-overlay').on('click', closeDrawer);
        $(document).on('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if ($('#notif-drawer').hasClass('is-open')) closeDrawer();
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
        $('#app-header').html(headerHtml());
        $('#app-footer').html(footerHtml());
        $('body').append(drawerHtml());
        bind();
        // Prefill the search box when arriving from a search
        const q = new URLSearchParams(location.search).get('q');
        if (q) $('.global-search input').val(q);
        loadNotifs(false); // fills the bell badge
    }

    return { mount };
})();