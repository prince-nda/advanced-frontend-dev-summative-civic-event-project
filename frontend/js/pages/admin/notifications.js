$(function () {
    const user = Auth.requireAdmin();
    if (!user) return;
    Layout.mount('notifications');
    Ui.showFlash();

    let items = [];
    const $list = $('#list');

    function related(n) {
        const m = n.metadata || {};
        if (m.event_id) return ['../event-detail.html?id=' + encodeURIComponent(m.event_id), 'Open event'];
        if (m.promo_id) return ['../promo-detail.html?id=' + encodeURIComponent(m.promo_id), 'Open promo'];
        if (m.announcement_id) return ['../announcement-detail.html?id=' + encodeURIComponent(m.announcement_id), 'Open announcement'];
        return null;
    }

    function showMessage(title, text, retry) {
        $('#result-count').text('');
        $list.removeAttr('aria-busy').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p class="text-lg font-extrabold">${Ui.esc(title)}</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
            ${retry ? '<button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}</div>`);
    }

    function render() {
        const type = $('#f-type').val();
        const shown = items.filter((n) => !type || n.type === type);
        $list.removeAttr('aria-busy');
        if (!shown.length) return showMessage('No notifications', type ? 'No notifications of this type.' : 'Notifications appear here when events, promos or announcements are added.');
        $('#result-count').text(`${shown.length} notification${shown.length === 1 ? '' : 's'}`);
        $list.html(shown.map((n) => {
            const link = related(n);
            return `<article class="rounded-2xl border border-line bg-white p-5 shadow-card" data-card="${Ui.esc(n.id)}">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="rounded-full bg-tint px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-action-dark">${Ui.esc(n.type)}</span>
                            <span class="text-xs text-muted">${Ui.esc(n.recipient_id ? 'Sent to one user' : 'Broadcast to everyone')} · ${Ui.esc(Ui.timeAgo(n.created_at))}</span>
                        </div>
                        <h2 class="mt-2 text-lg font-extrabold">${Ui.esc(n.title)}</h2>
                        <p class="mt-1 text-sm leading-relaxed text-muted">${Ui.esc(n.message)}</p>
                    </div>
                    <div class="flex gap-2">
                        ${link ? `<a href="${link[0]}" class="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface">${link[1]}</a>` : ''}
                        <button type="button" data-delete="${Ui.esc(n.id)}" class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">Delete<span class="sr-only">: ${Ui.esc(n.title)}</span></button>
                    </div>
                </div></article>`;
        }).join(''));
    }

    async function load() {
        $('#result-count').text('Loading notifications…');
        $list.attr('aria-busy', 'true').html(Array(4).fill('<div class="skeleton h-28"></div>').join(''));
        try {
            const res = await Api.notifications.list();
            items = res.data || [];
            const types = [...new Set(items.map((n) => n.type))].sort();
            $('#f-type').html('<option value="">All types</option>' + types.map((t) => `<option value="${Ui.esc(t)}">${Ui.esc(t)}</option>`).join(''));
            render();
        } catch (err) {
            showMessage('We could not load notifications', err.message, true);
        }
    }

    $list.on('click', '#retry', load);
    $('#f-type').on('change', render);

    // Delete with confirmation; remove from the screen immediately and restore if the server refuses
    $list.on('click', '[data-delete]', async function () {
        const id = $(this).data('delete');
        const n = items.find((x) => x.id === id);
        const ok = await Ui.confirm({ title: 'Delete this notification?', message: `"${n.title}" will be removed for every user.`, confirmText: 'Delete' });
        if (!ok) return;
        const before = items;
        items = items.filter((x) => x.id !== id);
        render();
        try {
            await Api.notifications.remove(id);
            Ui.toast('success', 'Notification deleted.');
        } catch (err) {
            items = before;
            render();
            Ui.toast('error', err.message);
        }
    });

    load();
});