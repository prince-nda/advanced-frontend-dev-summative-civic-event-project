/**
 * pages/my-registrations.js
 * The signed-in user's registrations (GET /event-registrations/my-registrations) in three tabs:
 * Upcoming, Past and Cancelled, with cancel (confirm, optimistic update, revert on failure).
 *
 * GUARD: signed-in users. Admins do not register for events, so they get an explanatory message.
 */
$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('registrations');
    Ui.showFlash();

    const $list = $('#list');
    let rows = [];
    let tab = 'upcoming';

    if (Auth.isAdmin()) {
        $('#result-count').text('');
        $('.tab').parent().addClass('hidden');
        $list.html('<div class="rounded-2xl border border-dashed border-line px-6 py-16 text-center"><p class="text-lg font-extrabold">Admins manage registrations differently</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">Open any event to see who has registered for it.</p><a href="events.html" class="mt-6 inline-block rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Go to events</a></div>');
        return;
    }

    const endTime = (r) => new Date(r.ends_at || r.starts_at).getTime();
    const bucket = (r) => (r.status === 'cancelled' ? 'cancelled' : endTime(r) < Date.now() ? 'past' : 'upcoming');

    function skeleton() {
        $('#result-count').text('Loading your registrations…');
        $list.attr('aria-busy', 'true').html(Array(3).fill('<div class="skeleton h-28"></div>').join(''));
    }

    function showMessage(title, text, retry) {
        $('#result-count').text('');
        $list.removeAttr('aria-busy').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p class="text-lg font-extrabold">${Ui.esc(title)}</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
            ${retry ? '<button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>'
                    : '<a href="events.html" class="mt-6 inline-block rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Browse events</a>'}</div>`);
    }

    function card(r) {
        const b = bucket(r);
        const href = 'event-detail.html?id=' + encodeURIComponent(r.event_id);
        const badge = b === 'cancelled' ? ['Cancelled', 'bg-surface text-muted'] : b === 'past' ? ['Event ended', 'bg-surface text-muted'] : ['Registered', 'bg-tint text-action-dark'];
        return `
        <article class="rounded-2xl border border-line bg-white p-5 shadow-card" data-card="${Ui.esc(r.event_id)}">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                    <h2 class="text-lg font-extrabold"><a href="${href}" class="hover:text-action">${Ui.esc(r.title)}</a></h2>
                    <p class="mt-1 text-sm text-muted">${Ui.esc(Ui.fmtDateTime(r.starts_at))}</p>
                    ${r.location ? `<p class="mt-0.5 text-sm text-muted">${Ui.esc(r.location)}</p>` : ''}
                </div>
                <span class="rounded-full px-3 py-1 text-xs font-bold ${badge[1]}">${badge[0]}</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
                <a href="${href}" class="rounded-xl border border-line px-4 py-2.5 text-sm font-bold hover:bg-surface">View event<span class="sr-only">: ${Ui.esc(r.title)}</span></a>
                ${b === 'upcoming' ? `<button type="button" data-cancel="${Ui.esc(r.event_id)}" class="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50">Cancel registration<span class="sr-only">: ${Ui.esc(r.title)}</span></button>` : ''}
            </div>
        </article>`;
    }

    function render() {
        $list.removeAttr('aria-busy');
        $('.tab').each(function () {
            const on = $(this).data('tab') === tab;
            $(this).attr('aria-pressed', on).toggleClass('border-navy bg-navy text-white', on).toggleClass('border-line hover:bg-surface', !on);
        });
        const shown = rows.filter((r) => bucket(r) === tab).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
        if (!shown.length) {
            const msgs = { upcoming: ['No upcoming registrations', 'Find an event you like and register.'], past: ['No past events yet', 'Events you registered for will show here once they end.'], cancelled: ['Nothing cancelled', 'Registrations you cancel will be listed here.'] };
            return showMessage(msgs[tab][0], msgs[tab][1], false);
        }
        $('#result-count').text(`${shown.length} registration${shown.length === 1 ? '' : 's'}`);
        $list.html(shown.map(card).join(''));
    }

    async function load() {
        skeleton();
        try {
            const res = await Api.registrations.mine();
            rows = res.data || [];
            render();
        } catch (err) {
            showMessage('We could not load your registrations', err.message, true);
        }
    }

    $('.tab').on('click', function () { tab = $(this).data('tab'); render(); });
    $list.on('click', '#retry', load);

    // Cancel: confirm, update the screen immediately, revert if the server says no
    $list.on('click', '[data-cancel]', async function () {
        const eventId = $(this).data('cancel');
        const row = rows.find((r) => r.event_id === eventId);
        const ok = await Ui.confirm({ title: 'Cancel your registration?', message: `You will not be able to register for "${row.title}" again.`, confirmText: 'Cancel registration' });
        if (!ok) return;
        const previous = row.status;
        row.status = 'cancelled';
        render();
        try {
            await Api.registrations.cancel(eventId);
            Ui.toast('success', 'Registration cancelled.');
        } catch (err) {
            row.status = previous;
            render();
            Ui.toast('error', err.message);
        }
    });

    load();
});