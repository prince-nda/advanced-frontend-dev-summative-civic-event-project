/**
 * Admin dashboard from GET /dashboard/admin: stat cards, a new-users-per-month bar chart
 * (plain HTML + Tailwind, no chart library), and an events breakdown.
 * Updates when data changes: Refresh button plus an automatic refresh every minute.
 *
 * GUARD: Auth.requireAdmin() -> normal users are sent to the events page.
 *        The backend also answers 403 to non-admins on /dashboard/admin.
 */
$(function () {
    const user = Auth.requireAdmin();
    if (!user) return;
    Layout.mount('dashboard');
    AdminNav.mount('dashboard');
    Ui.showFlash();

    const n = (v) => Number(v) || 0; // Postgres COUNT() arrives as a string
    const fmt = new Intl.NumberFormat();
    let loadedOnce = false;

    // Greeting + date
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    $('#greeting').text(`Good ${part}, ${(user.full_name || 'Administrator').split(' ')[0]}`);
    $('#today').text(new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()));

    /* ---------- states ---------- */
    function skeleton() {
        $('#state').addClass('hidden').empty();
        $('#stats').html(Array(8).fill('<div class="skeleton h-28"></div>').join(''));
        $('#chart').html('<div class="skeleton h-56"></div>');
        $('#split').html('<div class="skeleton h-24"></div>');
    }

    function showError(message) {
        $('#stats, #chart, #split').empty();
        $('#state').removeClass('hidden').html(`<div class="mt-8 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p class="text-lg font-extrabold">We could not load the dashboard</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(message)}</p>
            <button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button></div>`);
    }

    /* ---------- render ---------- */
    function stats(d) {
        const cards = [
            ['Total events', n(d.events.total_events), `${n(d.events.upcoming_events)} upcoming`],
            ['Upcoming events', n(d.events.upcoming_events), `${n(d.events.past_events)} already past`],
            ['Total users', n(d.users.total_users), `${n(d.users.inactive_users)} disabled`],
            ['Active users', n(d.users.active_users), 'Can sign in'],
            ['Registrations', n(d.registrations.total_registrations), 'Across all events'],
            ['Feedback received', n(d.feedbacks.total_feedback), 'Ratings and comments'],
            ['Promos', n(d.promos.total_promos), 'Video promos'],
            ['Announcements', n(d.announcements.total_announcements), 'Audio announcements'],
        ];
        $('#stats').html(cards.map(([label, value, hint]) => `
            <div class="rounded-2xl border border-line bg-white p-5 shadow-card">
                <p class="text-xs font-bold uppercase tracking-wide text-muted">${label}</p>
                <p class="mt-2 text-3xl font-extrabold">${fmt.format(value)}</p>
                <p class="mt-1 text-xs font-semibold text-action-dark">${hint}</p>
            </div>`).join(''));
    }

    function chart(growth) {
        if (!growth.length) {
            $('#chart').html('<p class="rounded-xl bg-surface px-4 py-10 text-center text-sm text-muted">No new users in the last 6 months.</p>');
            return;
        }
        const rows = growth.map((g) => {
            const [y, m] = g.month.split('-').map(Number);
            return { label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(y, m - 1, 1)), full: g.month, value: n(g.new_users) };
        });
        const max = Math.max(...rows.map((r) => r.value), 1);
        const top = Math.max(...rows.map((r) => r.value));
        const summary = rows.map((r) => `${r.full}: ${r.value}`).join(', ');

        $('#chart').html(`
            <div role="img" aria-label="Bar chart of new users per month. ${Ui.esc(summary)}" class="flex h-56 items-end gap-3 border-b border-line px-1 sm:gap-5">
                ${rows.map((r) => `
                    <div class="flex h-full flex-1 flex-col items-center justify-end">
                        <span class="mb-1 text-xs font-extrabold" aria-hidden="true">${r.value}</span>
                        <div class="w-full max-w-14 rounded-t-lg transition-all duration-500 ${r.value === top ? 'bg-brand' : 'bg-navy'}" style="height:${Math.max(4, (r.value / max) * 85)}%"></div>
                    </div>`).join('')}
            </div>
            <div class="mt-2 flex gap-3 px-1 sm:gap-5" aria-hidden="true">${rows.map((r) => `<span class="flex-1 text-center text-xs font-semibold text-muted">${r.label}</span>`).join('')}</div>
            <table class="sr-only"><caption>New users per month</caption><thead><tr><th>Month</th><th>New users</th></tr></thead>
                <tbody>${rows.map((r) => `<tr><td>${r.full}</td><td>${r.value}</td></tr>`).join('')}</tbody></table>`);
    }

    function split(e) {
        const total = n(e.total_events), up = n(e.upcoming_events), past = n(e.past_events);
        const other = Math.max(0, total - up - past); // events with no dates or happening right now
        if (!total) { $('#split').html('<p class="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">No events yet.</p>'); return; }
        const pct = (v) => (v / total) * 100;
        $('#split').html(`
            <div class="flex h-4 overflow-hidden rounded-full bg-line" role="img" aria-label="${up} upcoming, ${past} past, ${other} in progress out of ${total} events">
                <div class="bg-brand" style="width:${pct(up)}%"></div><div class="bg-navy" style="width:${pct(past)}%"></div><div class="bg-navy-700/40" style="width:${pct(other)}%"></div>
            </div>
            <ul class="mt-4 space-y-2 text-sm">
                <li class="flex items-center justify-between"><span class="flex items-center gap-2"><span class="h-3 w-3 rounded-full bg-brand" aria-hidden="true"></span>Upcoming</span><strong>${up}</strong></li>
                <li class="flex items-center justify-between"><span class="flex items-center gap-2"><span class="h-3 w-3 rounded-full bg-navy" aria-hidden="true"></span>Past</span><strong>${past}</strong></li>
                <li class="flex items-center justify-between"><span class="flex items-center gap-2"><span class="h-3 w-3 rounded-full bg-navy-700/40" aria-hidden="true"></span>In progress</span><strong>${other}</strong></li>
            </ul>`);
    }

    /* ---------- load ---------- */
    async function load() {
        const $btn = $('#refresh').prop('disabled', true);
        if (!loadedOnce) skeleton();
        try {
            const res = await Api.dashboard.admin();
            const d = res.data;
            $('#state').addClass('hidden').empty();
            stats(d);
            chart(d.user_growth || []);
            split(d.events);
            loadedOnce = true;
            $('#updated').text('Updated ' + new Date().toLocaleTimeString());
        } catch (err) {
            if (!loadedOnce) showError(err.message);
            else Ui.toast('error', 'Could not refresh: ' + err.message);
        } finally {
            $btn.prop('disabled', false);
        }
    }

    $('#refresh').on('click', load);
    $('#state').on('click', '#retry', load);
    setInterval(() => { if (!document.hidden) load(); }, 60 * 1000); // keep numbers current
    load();
});