$(function () {
    const me = Auth.requireAdmin();
    if (!me) return;
    Layout.mount('users');
    Ui.showFlash();

    const PAGE_SIZE = 10;
    let users = [];
    let page = 1;
    const dlg = document.getElementById('user-dialog');

    function skeleton() {
        $('#result-count').text('Loading users…');
        $('#pagination').empty();
        $('#table-wrap').html('<div class="space-y-3" aria-busy="true">' + Array(5).fill('<div class="skeleton h-14"></div>').join('') + '</div>');
    }

    function showMessage(title, text, retry) {
        $('#result-count').text('');
        $('#pagination').empty();
        $('#table-wrap').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p class="text-lg font-extrabold">${Ui.esc(title)}</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
            ${retry ? '<button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}</div>`);
    }

    function filtered() {
        const q = $.trim($('#f-q').val()).toLowerCase();
        const status = $('#f-status').val();
        return users.filter((u) => {
            if (q && !(u.full_name + ' ' + u.email).toLowerCase().includes(q)) return false;
            if (status === 'active' && !u.is_active) return false;
            if (status === 'disabled' && u.is_active) return false;
            return true;
        });
    }

    function render() {
        const list = filtered();
        const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        if (page > pages) page = pages;
        if (!list.length) return showMessage('No users found', 'Try a different search or status filter.', false);

        $('#result-count').text(`${list.length} user${list.length === 1 ? '' : 's'}`);
        const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u) => {
            const self = u.id === me.id;
            return `<tr>
                <td class="px-4 py-3"><p class="font-extrabold">${Ui.esc(u.full_name)}${self ? ' <span class="text-xs font-bold text-muted">(you)</span>' : ''}</p><p class="text-xs text-muted">${Ui.esc(u.email)}</p></td>
                <td class="px-4 py-3"><span class="rounded-full bg-tint px-2.5 py-1 text-xs font-bold capitalize text-action-dark">${Ui.esc(u.role)}</span></td>
                <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${u.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}">${u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td class="hidden px-4 py-3 text-muted md:table-cell">${Ui.esc(Ui.fmtDate(u.created_at))}</td>
                <td class="px-4 py-3"><div class="flex flex-wrap justify-end gap-2">
                    <button type="button" data-view="${Ui.esc(u.id)}" class="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface">View<span class="sr-only"> ${Ui.esc(u.full_name)}</span></button>
                    ${self ? '' : `<button type="button" data-toggle="${Ui.esc(u.id)}" class="rounded-lg border px-3 py-1.5 text-xs font-bold ${u.is_active ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'}">${u.is_active ? 'Disable' : 'Enable'}<span class="sr-only"> ${Ui.esc(u.full_name)}</span></button>`}
                </div></td></tr>`;
        }).join('');

        $('#table-wrap').html(`<div class="overflow-x-auto rounded-2xl border border-line"><table class="w-full text-left text-sm">
            <caption class="sr-only">Users</caption>
            <thead class="bg-surface text-xs uppercase tracking-wide text-muted"><tr>
                <th scope="col" class="px-4 py-3">User</th><th scope="col" class="px-4 py-3">Role</th><th scope="col" class="px-4 py-3">Status</th>
                <th scope="col" class="hidden px-4 py-3 md:table-cell">Joined</th><th scope="col" class="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody class="divide-y divide-line">${rows}</tbody></table></div>`);

        if (pages <= 1) { $('#pagination').empty(); return; }
        const btn = (label, p, o = {}) => `<button type="button" data-page="${p}" ${o.disabled ? 'disabled' : ''} ${o.current ? 'aria-current="page"' : ''} aria-label="${o.aria}"
            class="min-w-10 rounded-xl border px-3 py-2 text-sm font-bold ${o.current ? 'border-navy bg-navy text-white' : 'border-line hover:bg-surface'} disabled:cursor-not-allowed disabled:opacity-40">${label}</button>`;
        let html = btn('←', page - 1, { disabled: page === 1, aria: 'Previous page' });
        for (let p = 1; p <= pages; p++) html += btn(p, p, { current: p === page, aria: `Page ${p}` });
        html += btn('→', page + 1, { disabled: page === pages, aria: 'Next page' });
        $('#pagination').html(html);
    }

    async function load() {
        skeleton();
        try {
            const res = await Api.users.list(1, 200);
            users = res.data || [];
            render();
        } catch (err) {
            showMessage('We could not load users', err.message, true);
        }
    }

    $('#table-wrap').on('click', '#retry', load);
    $('#f-q').on('input', () => { page = 1; render(); });
    $('#f-status').on('change', () => { page = 1; render(); });
    $('#filters').on('submit', (e) => e.preventDefault());
    $('#pagination').on('click', 'button[data-page]', function () { page = Number($(this).data('page')); render(); });

    // Enable / disable with confirmation; update the row immediately and revert on failure
    $('#table-wrap').on('click', '[data-toggle]', async function () {
        const id = $(this).data('toggle');
        const u = users.find((x) => x.id === id);
        const disabling = u.is_active;
        const ok = await Ui.confirm({
            title: disabling ? `Disable ${u.full_name}?` : `Enable ${u.full_name}?`,
            message: disabling ? 'They will not be able to sign in until you enable the account again.' : 'They will be able to sign in again.',
            confirmText: disabling ? 'Disable account' : 'Enable account',
        });
        if (!ok) return;
        const previous = u.is_active;
        u.is_active = !previous; render();
        try {
            await (disabling ? Api.users.disable(id) : Api.users.enable(id));
            Ui.toast('success', `${u.full_name} was ${disabling ? 'disabled' : 'enabled'}.`);
        } catch (err) {
            u.is_active = previous; render();
            Ui.toast('error', err.message);
        }
    });

    // View one user (GET /users/:id)
    $('#table-wrap').on('click', '[data-view]', async function () {
        const id = $(this).data('view');
        $('#user-body').html('<div class="space-y-3" aria-busy="true"><div class="skeleton h-8 w-1/2"></div><div class="skeleton h-24"></div></div>');
        dlg.showModal();
        try {
            const u = (await Api.users.get(id)).data;
            const row = (k, v) => `<div class="flex justify-between gap-4 py-3"><dt class="text-sm text-muted">${k}</dt><dd class="text-right text-sm font-bold">${v}</dd></div>`;
            $('#user-body').html(`
                <h2 id="ud-h" class="text-xl font-extrabold">${Ui.esc(u.full_name)}</h2>
                <dl class="mt-4 divide-y divide-line">
                    ${row('Email', Ui.esc(u.email))}
                    ${row('Role', `<span class="capitalize">${Ui.esc(u.role)}</span>`)}
                    ${row('Status', u.is_active ? 'Active' : 'Disabled')}
                    ${row('Joined', Ui.esc(Ui.fmtDateTime(u.created_at)))}
                    ${row('Last updated', Ui.esc(Ui.fmtDateTime(u.updated_at)))}
                    ${row('User ID', `<span class="break-all font-mono text-xs">${Ui.esc(u.id)}</span>`)}
                </dl>
                <div class="mt-6 flex justify-end"><button type="button" id="ud-close" class="rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white hover:bg-navy-800">Close</button></div>`);
            $('#ud-close').trigger('focus');
        } catch (err) {
            $('#user-body').html(`<h2 id="ud-h" class="text-xl font-extrabold">Could not load user</h2><p class="mt-2 text-sm text-muted">${Ui.esc(err.message)}</p>
                <div class="mt-6 flex justify-end"><button type="button" id="ud-close" class="rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white">Close</button></div>`);
        }
    });
    $('#user-body').on('click', '#ud-close', () => dlg.close());

    load();
});