/**
 * pages/promos.js
 * Promo videos: lazy-loaded thumbnails (first frame), server-side pagination, a short-lived cache
 * that is invalidated on every create/update/publish/delete, and admin management.
 *
 * ROLE GUARDS (UX only; the backend returns 403 for non-admins on these writes):
 *   - Normal users: published promos only.
 *   - Admins: all promos plus New / Edit / Publish / Unpublish / Delete.
 */
$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('promos');
    Ui.showFlash();

    const isAdmin = Auth.isAdmin();
    const PAGE_SIZE = 9;
    const CACHE_PREFIX = 'civic_promos_';
    const CACHE_MS = 60 * 1000;
    const $grid = $('#grid');
    const dlg = document.getElementById('promo-dialog');

    let page = 1;
    let result = { data: [], pagination: null };
    let editingId = null;

    if (isAdmin) $('#new-btn').removeClass('hidden');

    /* ---------- cache (invalidated whenever promos change) ---------- */
    function cacheGet(p) {
        try {
            const o = JSON.parse(sessionStorage.getItem(CACHE_PREFIX + p));
            return o && Date.now() - o.t < CACHE_MS ? o.v : null;
        } catch (e) { return null; }
    }
    function cacheSet(p, v) { try { sessionStorage.setItem(CACHE_PREFIX + p, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* ignore */ } }
    function cacheClear() {
        Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => sessionStorage.removeItem(k));
    }

    /* ---------- lazy thumbnails: only fetch a video's first frame when it scrolls near the viewport ---------- */
    const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => entries.forEach((en) => {
            if (en.isIntersecting) { en.target.src = en.target.dataset.src; observer.unobserve(en.target); }
        }), { rootMargin: '200px' })
        : null;

    /* ---------- render ---------- */
    function skeleton() {
        $('#state').addClass('hidden').empty();
        $('#pagination').empty();
        $('#result-count').text('Loading promos…');
        $grid.attr('aria-busy', 'true').html(Array(6).fill('<div class="overflow-hidden rounded-2xl border border-line"><div class="skeleton aspect-video rounded-none"></div><div class="space-y-3 p-5"><div class="skeleton h-5 w-3/4"></div><div class="skeleton h-4 w-full"></div></div></div>').join(''));
    }

    function showMessage(title, text, retry) {
        $grid.empty().removeAttr('aria-busy');
        $('#pagination').empty();
        $('#result-count').text('');
        $('#state').removeClass('hidden').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p class="text-lg font-extrabold">${Ui.esc(title)}</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
            ${retry ? '<button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}</div>`);
    }

    function card(p) {
        const href = 'promo-detail.html?id=' + encodeURIComponent(p.id);
        const adminRow = isAdmin ? `
            <div class="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <button type="button" data-edit="${Ui.esc(p.id)}" class="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface">Edit</button>
                <button type="button" data-toggle="${Ui.esc(p.id)}" class="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface">${p.published ? 'Unpublish' : 'Publish'}</button>
                <button type="button" data-delete="${Ui.esc(p.id)}" class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button>
            </div>` : '';
        return `
        <article class="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <a href="${href}" class="group relative block aspect-video bg-navy" aria-label="Watch ${Ui.esc(p.title)}">
                <video class="thumb h-full w-full object-cover" data-src="${Ui.esc(p.video_url)}#t=0.5" muted playsinline preload="metadata" tabindex="-1" aria-hidden="true"></video>
                <span class="pointer-events-none absolute inset-0 flex items-center justify-center bg-navy/30 transition group-hover:bg-navy/10" aria-hidden="true">
                    <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white text-action shadow-card"><svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
                </span>
                ${isAdmin && !p.published ? '<span class="absolute right-3 top-3 rounded-full bg-navy px-3 py-1 text-xs font-bold text-white">Unpublished</span>' : ''}
            </a>
            <div class="flex flex-1 flex-col p-5">
                <h2 class="text-lg font-extrabold leading-snug"><a href="${href}" class="hover:text-action">${Ui.esc(p.title)}</a></h2>
                <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">${Ui.esc(p.description || '')}</p>
                <div class="mt-4"><a href="${href}" class="inline-block rounded-xl bg-action px-4 py-2.5 text-sm font-bold text-white hover:bg-action-dark">▶ Play<span class="sr-only"> ${Ui.esc(p.title)}</span></a></div>
                ${adminRow}
            </div>
        </article>`;
    }

    function render() {
        const visible = result.data.filter((p) => isAdmin || p.published !== false);
        $grid.removeAttr('aria-busy');
        $('#state').addClass('hidden').empty();
        if (!visible.length) return showMessage('No promos yet', 'Promo videos will appear here as soon as they are published.');

        const total = result.pagination ? result.pagination.total : visible.length;
        $('#result-count').text(`${total} promo${total === 1 ? '' : 's'}`);
        $grid.html(visible.map(card).join(''));
        $grid.find('video.thumb').each(function () { if (observer) observer.observe(this); else this.src = this.dataset.src; });
        renderPagination();
    }

    function renderPagination() {
        const pages = result.pagination ? result.pagination.pages : 1;
        if (pages <= 1) { $('#pagination').empty(); return; }
        const btn = (label, p, o = {}) => `<button type="button" data-page="${p}" ${o.disabled ? 'disabled' : ''} ${o.current ? 'aria-current="page"' : ''} aria-label="${o.aria}"
            class="min-w-10 rounded-xl border px-3 py-2 text-sm font-bold ${o.current ? 'border-navy bg-navy text-white' : 'border-line hover:bg-surface'} disabled:cursor-not-allowed disabled:opacity-40">${label}</button>`;
        let html = btn('←', page - 1, { disabled: page === 1, aria: 'Previous page' });
        for (let p = 1; p <= pages; p++) html += btn(p, p, { current: p === page, aria: `Page ${p}` });
        html += btn('→', page + 1, { disabled: page === pages, aria: 'Next page' });
        $('#pagination').html(html);
    }

    /* ---------- load ---------- */
    async function load(p = 1) {
        page = p;
        const cached = cacheGet(p);
        if (cached) { result = cached; return render(); }
        skeleton();
        try {
            const res = await Api.promos.list(p, PAGE_SIZE);
            result = { data: res.data || [], pagination: res.pagination || null };
            cacheSet(p, result);
            render();
        } catch (err) {
            showMessage('We could not load promos', err.message, true);
        }
    }

    $('#state').on('click', '#retry', () => load(page));
    $('#pagination').on('click', 'button[data-page]', function () {
        load(Number($(this).data('page')));
        $('#main')[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /* ---------- admin: dialog ---------- */
    const fieldError = (id, msg) => {
        $('#' + id).attr('aria-invalid', msg ? 'true' : 'false').toggleClass('border-red-500', !!msg);
        $('#' + id + '-error').text(msg || '').toggleClass('hidden', !msg);
    };

    function openDialog(p) {
        editingId = p ? p.id : null;
        $('#promo-form')[0].reset();
        ['p-title', 'p-desc', 'p-caption', 'p-video'].forEach((f) => fieldError(f, ''));
        Ui.formError($('#form-error'), '');
        $('#progress-wrap').addClass('hidden');
        $('#dlg-h').text(p ? 'Edit promo' : 'New promo');
        $('#dlg-submit').text(p ? 'Save changes' : 'Create promo');
        $('#video-req').toggleClass('hidden', !!p);
        $('#video-keep').toggleClass('hidden', !p);
        if (p) { $('#p-title').val(p.title); $('#p-desc').val(p.description || ''); $('#p-caption').val(p.caption_text || ''); }
        dlg.showModal();
        $('#p-title').trigger('focus');
    }

    $('#new-btn').on('click', () => openDialog(null));
    $('#dlg-cancel').on('click', () => dlg.close());
    $grid.on('click', '[data-edit]', function () { openDialog(result.data.find((p) => p.id === $(this).data('edit'))); });

    $('#p-video').on('change', function () {
        const problem = validateUpload(this.files[0], 'video');
        fieldError('p-video', problem);
        if (problem) this.value = '';
    });

    function setProgress(f) {
        const pct = Math.round(f * 100);
        $('#progress-wrap').removeClass('hidden');
        $('#progress-fill').css('width', pct + '%');
        $('#progress-text').text(pct + '%');
        $('#progress-bar').attr('aria-valuenow', pct);
    }

    $('#promo-form').on('submit', async function (e) {
        e.preventDefault();
        Ui.formError($('#form-error'), '');
        const v = { title: $.trim($('#p-title').val()), description: $.trim($('#p-desc').val()), caption_text: $.trim($('#p-caption').val()) };
        const file = $('#p-video')[0].files[0];
        let ok = true;
        ['p-title', 'p-desc', 'p-caption', 'p-video'].forEach((f) => fieldError(f, ''));
        if (v.title.length < 3) { fieldError('p-title', 'Enter a title (at least 3 characters).'); ok = false; }
        if (!v.description) { fieldError('p-desc', 'Enter a short description.'); ok = false; }
        if (!v.caption_text) { fieldError('p-caption', 'Enter the caption text.'); ok = false; }
        if (!editingId && !file) { fieldError('p-video', 'Choose a video file.'); ok = false; }
        if (file) { const pr = validateUpload(file, 'video'); if (pr) { fieldError('p-video', pr); ok = false; } }
        if (!ok) { $('#promo-form').find('[aria-invalid="true"]').first().trigger('focus'); return; }

        const fd = new FormData();
        fd.append('title', v.title);
        fd.append('description', v.description);
        fd.append('caption_text', v.caption_text);
        if (file) fd.append('video', file); // field name expected by uploadPromoVideo.single('video')

        const $btn = $('#dlg-submit');
        Ui.setLoading($btn, true, 'Saving…');
        try {
            if (editingId) await Api.promos.update(editingId, fd, file ? setProgress : undefined);
            else await Api.promos.create(fd, setProgress);
            cacheClear(); // lists changed: invalidate
            dlg.close();
            Ui.toast('success', editingId ? 'Promo updated.' : 'Promo created. A notification was sent to all users.');
            load(editingId ? page : 1);
        } catch (err) {
            Ui.setLoading($btn, false);
            $('#progress-wrap').addClass('hidden');
            Ui.formError($('#form-error'), err.message);
        }
    });

    /* ---------- admin: publish / unpublish / delete ---------- */
    $grid.on('click', '[data-toggle]', async function () {
        const id = $(this).data('toggle');
        const p = result.data.find((x) => x.id === id);
        const $b = $(this).prop('disabled', true);
        try {
            const res = p.published ? await Api.promos.unpublish(id) : await Api.promos.publish(id);
            cacheClear();
            Ui.toast('success', res.data.published ? 'Promo published.' : 'Promo unpublished.');
            load(page);
        } catch (err) {
            $b.prop('disabled', false);
            Ui.toast('error', err.message);
        }
    });

    $grid.on('click', '[data-delete]', async function () {
        const id = $(this).data('delete');
        const p = result.data.find((x) => x.id === id);
        const ok = await Ui.confirm({ title: 'Delete this promo?', message: `"${p.title}" will be permanently removed.`, confirmText: 'Delete promo' });
        if (!ok) return;
        try {
            await Api.promos.remove(id);
            cacheClear();
            Ui.toast('success', 'Promo deleted.');
            load(result.data.length === 1 && page > 1 ? page - 1 : page);
        } catch (err) {
            Ui.toast('error', err.message);
        }
    });

    load(1);
});