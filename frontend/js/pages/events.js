$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('events');
    Ui.showFlash();

    const isAdmin = Auth.isAdmin();
    const PAGE_SIZE = 9;

    let all = [];                 // every event the user may see
    let registered = new Set();   // event ids this user is currently registered for (normal users)
    let page = 1;

    const $grid = $('#events-grid');

    if (isAdmin) $('#create-event').removeClass('hidden');
    $('#f-q').val(new URLSearchParams(location.search).get('q') || '');

    /* ---------- states ---------- */
    function skeletons() {
        $('#state').addClass('hidden').empty();
        $('#pagination').empty();
        $('#result-count').text('Loading events…');
        $grid.attr('aria-busy', 'true').html(Array(6).fill(
            '<div class="overflow-hidden rounded-2xl border border-line"><div class="skeleton h-48 rounded-none"></div><div class="space-y-3 p-5"><div class="skeleton h-4 w-1/3"></div><div class="skeleton h-6 w-3/4"></div><div class="skeleton h-4 w-full"></div></div></div>'
        ).join(''));
    }

    function showState(title, text, retry) {
        $grid.empty().removeAttr('aria-busy');
        $('#pagination').empty();
        $('#result-count').text('');
        $('#state').removeClass('hidden').html(`
            <div class="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                <p class="text-lg font-extrabold">${Ui.esc(title)}</p>
                <p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
                ${retry ? '<button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}
            </div>`);
    }

    /* ---------- data ---------- */
    async function load() {
        skeletons();
        try {
            const eventsRes = await Api.events.list();
            let mine = null;
            if (!isAdmin) {
                // A failure here shouldn't hide the events; we just won't show "Registered" badges
                mine = await Api.registrations.mine().catch(() => null);
            }

            // Normal users only see published events; admins see everything
            all = (eventsRes.data || []).filter((e) => isAdmin || e.published !== false);
            registered = new Set(((mine && mine.data) || []).filter((r) => r.status === 'registered').map((r) => r.event_id));

            // Build the location filter from the data
            const places = [...new Set(all.map((e) => e.location).filter(Boolean))].sort();
            $('#f-location').html('<option value="">All locations</option>' +
                places.map((p) => `<option value="${Ui.esc(p)}">${Ui.esc(p)}</option>`).join(''));

            page = 1;
            render();
        } catch (err) {
            showState('We could not load events', err.message, true);
        }
    }

    /* ---------- filtering ---------- */
    function filtered() {
        const q = $.trim($('#f-q').val()).toLowerCase();
        const when = $('#f-when').val();
        const day = $('#f-date').val(); // yyyy-mm-dd
        const loc = $('#f-location').val();
        const now = Date.now();

        return all.filter((e) => {
            if (q && !((e.title || '') + ' ' + (e.description || '')).toLowerCase().includes(q)) return false;
            if (loc && e.location !== loc) return false;
            const end = new Date(e.ends_at || e.starts_at).getTime();
            if (day) return e.starts_at && new Date(e.starts_at).toLocaleDateString('en-CA') === day;
            if (when === 'upcoming' && end < now) return false;
            if (when === 'past' && end >= now) return false;
            return true;
        });
    }

    /* ---------- rendering ---------- */
    function card(e) {
        const start = e.starts_at ? new Date(e.starts_at) : null;
        const ended = new Date(e.ends_at || e.starts_at).getTime() < Date.now();
        const img = e.metadata && e.metadata.image_url;
        const isReg = registered.has(e.id);
        const href = 'event-detail.html?id=' + encodeURIComponent(e.id);

        const media = img
            ? `<img src="${Ui.esc(img)}" alt="Photo for ${Ui.esc(e.title)}" loading="lazy" class="event-img h-48 w-full object-cover">`
            : '<div class="flex h-48 w-full items-center justify-center bg-navy text-brand" aria-hidden="true"><svg viewBox="0 0 24 24" class="h-12 w-12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg></div>';

        const dateChip = start
            ? `<div class="absolute left-4 top-4 rounded-xl bg-white px-3 py-2 text-center shadow-card" aria-hidden="true">
                   <div class="text-[10px] font-extrabold uppercase tracking-wider text-action">${start.toLocaleString(undefined, { month: 'short' })}</div>
                   <div class="text-xl font-extrabold leading-none">${start.getDate()}</div></div>`
            : '';

        let action = '';
        if (isAdmin) {
            action = `<a href="event-form.html?id=${encodeURIComponent(e.id)}" class="rounded-xl border border-line px-4 py-2.5 text-sm font-bold hover:bg-surface">Edit<span class="sr-only"> ${Ui.esc(e.title)}</span></a>
                      <button type="button" data-delete="${Ui.esc(e.id)}" data-title="${Ui.esc(e.title)}" class="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50">Delete<span class="sr-only"> ${Ui.esc(e.title)}</span></button>`;
        } else if (isReg) {
            action = '<span class="rounded-xl bg-tint px-4 py-2.5 text-sm font-bold text-action-dark">✓ Registered</span>';
        } else if (!ended) {
            action = `<button type="button" data-register="${Ui.esc(e.id)}" class="rounded-xl bg-action px-4 py-2.5 text-sm font-bold text-white hover:bg-action-dark disabled:opacity-60">Register<span class="sr-only"> for ${Ui.esc(e.title)}</span></button>`;
        } else {
            action = '<span class="rounded-xl bg-surface px-4 py-2.5 text-sm font-bold text-muted">Ended</span>';
        }

        return `
        <article class="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card" data-card="${Ui.esc(e.id)}">
            <div class="relative">${media}${dateChip}
                ${isAdmin && e.published === false ? '<span class="absolute right-4 top-4 rounded-full bg-navy px-3 py-1 text-xs font-bold text-white">Unpublished</span>' : ''}
            </div>
            <div class="flex flex-1 flex-col p-5">
                <p class="text-xs font-bold uppercase tracking-wide text-muted">${Ui.esc(Ui.fmtDateTime(e.starts_at))}</p>
                <h2 class="mt-2 text-xl font-extrabold leading-snug"><a href="${href}" class="hover:text-action">${Ui.esc(e.title)}</a></h2>
                ${e.location ? `<p class="mt-2 flex items-center gap-1.5 text-sm text-muted"><svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${Ui.esc(e.location)}</p>` : ''}
                <p class="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">${Ui.esc(e.description || 'No description provided.')}</p>
                <div class="mt-5 flex flex-wrap items-center gap-2 pt-1">
                    <a href="${href}" class="rounded-xl border border-line px-4 py-2.5 text-sm font-bold hover:bg-surface">View<span class="sr-only"> ${Ui.esc(e.title)}</span></a>
                    ${action}
                </div>
            </div>
        </article>`;
    }

    function render() {
        const list = filtered();
        const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        if (page > pages) page = pages;

        $grid.removeAttr('aria-busy');
        $('#state').addClass('hidden').empty();

        if (!list.length) {
            const hasFilters = $.trim($('#f-q').val()) || $('#f-date').val() || $('#f-location').val() || $('#f-when').val() !== 'upcoming';
            showState(hasFilters ? 'No events match your filters' : 'No events yet',
                hasFilters ? 'Try a different search, date or location.' : 'Check back soon. New events appear here as soon as they are published.', false);
            return;
        }

        $('#result-count').text(`${list.length} event${list.length === 1 ? '' : 's'} found`);
        $grid.html(list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(card).join(''));
        renderPagination(pages);
    }

    function renderPagination(pages) {
        if (pages <= 1) { $('#pagination').empty(); return; }
        const btn = (label, p, opts = {}) =>
            `<button type="button" data-page="${p}" ${opts.disabled ? 'disabled' : ''} ${opts.current ? 'aria-current="page"' : ''}
                class="min-w-10 rounded-xl border px-3 py-2 text-sm font-bold ${opts.current ? 'border-navy bg-navy text-white' : 'border-line hover:bg-surface'} disabled:cursor-not-allowed disabled:opacity-40"
                ${opts.aria ? `aria-label="${opts.aria}"` : ''}>${label}</button>`;
        let html = btn('←', page - 1, { disabled: page === 1, aria: 'Previous page' });
        for (let p = 1; p <= pages; p++) html += btn(p, p, { current: p === page, aria: `Page ${p}` });
        html += btn('→', page + 1, { disabled: page === pages, aria: 'Next page' });
        $('#pagination').html(html);
    }

    /* ---------- events ---------- */
    let timer;
    $('#f-q').on('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; render(); }, 200); });
    $('#f-when, #f-date, #f-location').on('change', () => { page = 1; render(); });
    $('#filters').on('submit', (e) => e.preventDefault());
    $('#state').on('click', '#retry', load);

    $('#pagination').on('click', 'button[data-page]', function () {
        page = Number($(this).data('page'));
        render();
        $('#main')[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Register (normal users). Optimistic: the card flips to "Registered" immediately and reverts on failure.
    $grid.on('click', '[data-register]', async function () {
        const id = $(this).data('register');
        registered.add(id);
        render();
        try {
            await Api.registrations.register(id);
            Ui.toast('success', 'You are registered. See you there!');
        } catch (err) {
            registered.delete(id);
            render();
            if (err.status === 409) {
                // The API keeps a cancelled registration row and refuses to create a second one
                Ui.toast('error', 'You already have a registration for this event (it may have been cancelled earlier, and the server does not allow registering again).');
            } else {
                Ui.toast('error', err.message);
            }
        }
    });

    // Delete (admin only, backend also enforces this)
    $grid.on('click', '[data-delete]', async function () {
        const id = $(this).data('delete');
        const title = $(this).data('title');
        const ok = await Ui.confirm({ title: 'Delete this event?', message: `"${title}" will be permanently removed.`, confirmText: 'Delete event' });
        if (!ok) return;
        try {
            await Api.events.remove(id);
            all = all.filter((e) => e.id !== id);
            render();
            Ui.toast('success', 'Event deleted.');
        } catch (err) {
            Ui.toast('error', err.message);
        }
    });

    // Broken image -> fall back to the navy placeholder
    $grid.on('error', '.event-img', function () {
        $(this).replaceWith('<div class="flex h-48 w-full items-center justify-center bg-navy text-sm font-semibold text-white/70" aria-hidden="true">Image unavailable</div>');
    });
    // 'error' does not bubble: attach per image after each render via capture
    document.getElementById('events-grid').addEventListener('error', (ev) => {
        if (ev.target.classList && ev.target.classList.contains('event-img')) $(ev.target).trigger('error');
    }, true);

    load();
});