$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    if (Auth.isAdmin()) { location.replace(Auth.url('admin/dashboard.html')); return; }
    Layout.mount('overview');
    Ui.showFlash();

    const first = (user.full_name || 'there').split(' ')[0];
    $('#greeting').text(`Welcome back, ${first}.`);
    $('#today').text(Ui.fmtToday());

    const n = (v) => Number(v) || 0;
    const endOf = (e) => new Date(e.ends_at || e.starts_at).getTime();

    const PATH = {
        calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
        ticket: '<path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v14" stroke-dasharray="2 3"/>',
        audio: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
        star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
        bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    };
    const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATH[name]}</svg>`;

    function thumb(e, cls) {
        const img = e && e.metadata && e.metadata.image_url;
        return img
            ? Ui.mediaImg(img, '', cls)
            : `<div class="${cls} flex items-center justify-center bg-navy-700 text-brand" aria-hidden="true">${icon('calendar')}</div>`;
    }

    function skeleton() {
        $('#state').addClass('hidden').empty();
        $('#stats').html(Array(4).fill('<div class="skeleton h-28"></div>').join(''));
        $('#next').html('<div class="skeleton h-32"></div>');
        $('#activity').html('<li class="py-3"><div class="skeleton h-12"></div></li>'.repeat(3));
        $('#explore').html('<div class="skeleton h-32"></div><div class="skeleton h-32"></div>');
    }

    function showError(message) {
        $('#stats, #next, #activity, #explore').empty();
        $('#state').removeClass('hidden').html(`<div class="mt-8 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p class="text-lg font-extrabold">We could not load your overview</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(message)}</p>
            <button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button></div>`);
    }

    function render(ev, mine, ann, me, nots) {
        const events = (ev && ev.data) || [];
        const regs = ((mine && mine.data) || []).filter((r) => r.status === 'registered');
        const upcomingRegs = regs.filter((r) => endOf(r) >= Date.now()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
        const published = ((ann && ann.data) || []).filter((a) => a.published !== false);
        const today = Ui.dayKey(new Date());
        const newToday = published.filter((a) => Ui.dayKey(a.created_at) === today).length;
        const feedbackCount = me && me.data ? n(me.data.feedbacks.total_feedbacks) : 0;

        // Stat cards
        const cards = [
            ['Upcoming events', upcomingRegs.length, upcomingRegs.length ? `Next: ${Ui.fmtDate(upcomingRegs[0].starts_at)}` : 'Nothing booked yet', 'calendar'],
            ['Total registrations', regs.length, 'Events you signed up for', 'ticket'],
            ['Announcements', published.length, newToday ? `${newToday} new today` : 'Audio updates to hear', 'audio'],
            ['Feedback given', feedbackCount, 'Thanks for sharing', 'star'],
        ];
        $('#stats').html(cards.map(([label, value, hint, ic]) => `
            <div class="flex items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint text-action" aria-hidden="true">${icon(ic)}</span>
                <div><p class="text-xs font-bold uppercase tracking-wide text-muted">${label}</p>
                <p class="mt-1 text-3xl font-extrabold">${String(value).padStart(2, '0')}</p>
                <p class="text-xs font-semibold text-action-dark">${Ui.esc(hint)}</p></div>
            </div>`).join(''));

        // Up next
        if (upcomingRegs.length) {
            const r = upcomingRegs[0];
            const full = events.find((e) => e.id === r.event_id);
            const href = 'event-detail.html?id=' + encodeURIComponent(r.event_id);
            $('#next').html(`
                <div class="flex items-center gap-5 rounded-2xl bg-navy p-4 text-white">
                    ${thumb(full, 'h-24 w-24 shrink-0 rounded-xl sm:h-28 sm:w-28')}
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-bold uppercase tracking-wide text-brand">${Ui.esc(Ui.fmtDateTime(r.starts_at))}</p>
                        <h3 class="mt-1 truncate text-xl font-extrabold sm:text-2xl"><a href="${href}" class="hover:underline">${Ui.esc(r.title)}</a></h3>
                        ${r.location ? `<p class="mt-1 truncate text-sm text-white/70">${Ui.esc(r.location)}</p>` : ''}
                        <p class="mt-2 text-xs font-bold text-brand">✓ You're registered</p>
                    </div>
                    <a href="${href}" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20" aria-label="Open ${Ui.esc(r.title)}">→</a>
                </div>`);
        } else {
            $('#next').html(`<div class="rounded-2xl bg-surface px-6 py-10 text-center"><p class="font-extrabold">You have nothing booked yet</p>
                <p class="mt-1 text-sm text-muted">Find an event you like and register in a tap.</p>
                <a href="events.html" class="mt-4 inline-block rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Browse events</a></div>`);
        }

        // Recent activity (notifications)
        const items = ((nots && nots.data) || []).slice(0, 4);
        $('#activity').html(items.length ? items.map((x) => `
            <li class="flex gap-3 py-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-action" aria-hidden="true">${icon('bell')}</span>
                <div class="min-w-0"><p class="truncate text-sm font-bold">${Ui.esc(x.title)}</p>
                <p class="line-clamp-1 text-xs text-muted">${Ui.esc(x.message)}</p>
                <p class="mt-0.5 text-xs text-muted">${Ui.esc(Ui.timeAgo(x.created_at))}</p></div>
            </li>`).join('') : '<li class="py-8 text-center text-sm text-muted">No activity yet. New events and announcements will show up here.</li>');

        // Keep exploring: upcoming published events the user has not registered for
        const regIds = new Set(regs.map((r) => r.event_id));
        const picks = events.filter((e) => e.published !== false && endOf(e) >= Date.now() && !regIds.has(e.id))
            .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 4);
        $('#explore').html(picks.length ? picks.map((e) => {
            const href = 'event-detail.html?id=' + encodeURIComponent(e.id);
            return `<article class="flex overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                ${thumb(e, 'h-auto min-h-[8rem] w-32 shrink-0 sm:w-40')}
                <div class="min-w-0 flex-1 p-4">
                    <p class="text-xs font-bold uppercase tracking-wide text-action">${Ui.esc(Ui.fmtDateTime(e.starts_at))}</p>
                    <h3 class="mt-1 text-lg font-extrabold leading-snug"><a href="${href}" class="hover:text-action">${Ui.esc(e.title)}</a></h3>
                    ${e.location ? `<p class="mt-1 truncate text-sm text-muted">${Ui.esc(e.location)}</p>` : ''}
                </div></article>`;
        }).join('') : '<p class="rounded-2xl bg-surface px-6 py-10 text-center text-sm text-muted md:col-span-2">No other upcoming events right now. Check back soon.</p>');
    }

    async function load() {
        skeleton();
        // Each call is independent: one failing does not hide the rest
        const [ev, mine, ann, me, nots] = await Promise.all([
            Api.events.list().catch(() => null),
            Api.registrations.mine().catch(() => null),
            Api.announcements.list().catch(() => null),
            Api.dashboard.me().catch(() => null),
            Api.notifications.list().catch(() => null),
        ]);
        if (!ev && !mine && !ann && !me && !nots) return showError('Check that the backend is running, then try again.');
        render(ev, mine, ann, me, nots);
    }

    $('#state').on('click', '#retry', load);
    $('#view-all-notifs').on('click', () => $('#bell-btn').trigger('click'));
    load();
});