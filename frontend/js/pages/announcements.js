/**
 * pages/announcements.js
 * Audio announcements list with an inline play button, length, and date.
 *
 * ROLE GUARDS (UX only; the backend returns 403 for non-admins on these writes):
 *   - Normal users: see published announcements only, can listen.
 *   - Admins: see all, plus New / Edit / Publish / Unpublish / Delete.
 * API limits: the audio file cannot be replaced after upload (the update endpoint only changes the title).
 */
$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('announcements');
    Ui.showFlash();

    const isAdmin = Auth.isAdmin();
    const $list = $('#list');
    const dlg = document.getElementById('ann-dialog');
    let items = [];
    let editingId = null;

    // One shared audio element so only one announcement plays at a time
    const player = new Audio();
    let playingId = null;

    const PLAY = '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const PAUSE = '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

    if (isAdmin) $('#new-btn').removeClass('hidden');

    /* ---------- render ---------- */
    function skeleton() {
        $('#result-count').text('Loading announcements…');
        $list.attr('aria-busy', 'true').html(Array(4).fill('<div class="skeleton h-24"></div>').join(''));
    }

    function showMessage(title, text, retry) {
        $('#result-count').text('');
        $list.removeAttr('aria-busy').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p class="text-lg font-extrabold">${Ui.esc(title)}</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
            ${retry ? '<button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}</div>`);
    }

    function card(a) {
        const adminRow = isAdmin ? `
            <div class="flex w-full flex-wrap gap-2 border-t border-line pt-3 sm:justify-end">
                <button type="button" data-edit="${Ui.esc(a.id)}" class="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface">Edit title</button>
                <button type="button" data-toggle="${Ui.esc(a.id)}" class="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface">${a.published ? 'Unpublish' : 'Publish'}</button>
                <button type="button" data-delete="${Ui.esc(a.id)}" class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button>
            </div>` : '';
        return `
        <article class="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5" data-card="${Ui.esc(a.id)}">
            <div class="flex items-center gap-4">
                <button type="button" data-play="${Ui.esc(a.id)}" aria-label="Play ${Ui.esc(a.title)}"
                        class="play-btn flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action text-white shadow-glow hover:bg-action-dark">${PLAY}</button>
                <div class="min-w-0 flex-1">
                    <h2 class="truncate text-lg font-extrabold"><a href="announcement-detail.html?id=${encodeURIComponent(a.id)}" class="hover:text-action">${Ui.esc(a.title)}</a></h2>
                    <p class="mt-0.5 text-sm text-muted">
                        <time datetime="${Ui.esc(a.created_at)}">${Ui.esc(Ui.fmtDate(a.created_at))}</time>
                        <span aria-hidden="true"> · </span><span data-dur="${Ui.esc(a.id)}">Loading length…</span>
                        ${isAdmin ? `<span class="ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${a.published ? 'bg-tint text-action-dark' : 'bg-navy text-white'}">${a.published ? 'Published' : 'Unpublished'}</span>` : ''}
                    </p>
                </div>
                <a href="announcement-detail.html?id=${encodeURIComponent(a.id)}" class="hidden rounded-xl border border-line px-4 py-2.5 text-sm font-bold hover:bg-surface sm:inline-block">Details<span class="sr-only"> for ${Ui.esc(a.title)}</span></a>
            </div>
            ${adminRow}
        </article>`;
    }

    function render() {
        const visible = items.filter((a) => isAdmin || a.published !== false);
        $list.removeAttr('aria-busy');
        if (!visible.length) return showMessage('No announcements yet', 'Audio announcements will appear here as soon as they are published.');
        $('#result-count').text(`${visible.length} announcement${visible.length === 1 ? '' : 's'}`);
        $list.html(visible.map(card).join(''));
        loadDurations(visible);
        syncButtons();
    }

    // The API does not store the length, so read it from the audio file's metadata
    function loadDurations(visible) {
        visible.forEach((a) => {
            const probe = new Audio();
            probe.preload = 'metadata';
            probe.addEventListener('loadedmetadata', () => $(`[data-dur="${a.id}"]`).text(Ui.fmtDuration(probe.duration)));
            probe.addEventListener('error', () => $(`[data-dur="${a.id}"]`).text('Length unavailable'));
            probe.src = a.audio_url;
        });
    }

    /* ---------- playback ---------- */
    function syncButtons() {
        $('.play-btn').each(function () {
            const id = $(this).data('play');
            const on = id === playingId && !player.paused;
            const title = (items.find((a) => a.id === id) || {}).title || '';
            $(this).html(on ? PAUSE : PLAY).attr('aria-label', `${on ? 'Pause' : 'Play'} ${title}`);
        });
    }
    player.addEventListener('play', syncButtons);
    player.addEventListener('pause', syncButtons);
    player.addEventListener('ended', () => { playingId = null; syncButtons(); });
    player.addEventListener('error', () => { playingId = null; syncButtons(); Ui.toast('error', 'This audio could not be played.'); });

    $list.on('click', '[data-play]', function () {
        const id = $(this).data('play');
        const a = items.find((x) => x.id === id);
        if (!a) return;
        if (playingId === id) { player.paused ? player.play() : player.pause(); return; }
        playingId = id;
        player.src = a.audio_url;
        player.play().catch(() => Ui.toast('error', 'This audio could not be played.'));
    });

    /* ---------- load ---------- */
    async function load() {
        skeleton();
        try {
            const res = await Api.announcements.list();
            items = res.data || [];
            render();
        } catch (err) {
            showMessage('We could not load announcements', err.message, true);
        }
    }
    $list.on('click', '#retry', load);

    /* ---------- admin: dialog ---------- */
    function fieldError(id, message) {
        $('#' + id).attr('aria-invalid', message ? 'true' : 'false').toggleClass('border-red-500', !!message);
        $('#' + id + '-error').text(message || '').toggleClass('hidden', !message);
    }

    function openDialog(a) {
        editingId = a ? a.id : null;
        $('#ann-form')[0].reset();
        fieldError('a-title', ''); fieldError('a-audio', '');
        Ui.formError($('#form-error'), '');
        $('#progress-wrap').addClass('hidden');
        $('#dlg-h').text(a ? 'Edit announcement' : 'New announcement');
        $('#dlg-submit').text(a ? 'Save changes' : 'Create announcement');
        $('#audio-field, #published-field').toggleClass('hidden', !!a);
        $('#edit-note').toggleClass('hidden', !a);
        if (a) $('#a-title').val(a.title);
        dlg.showModal();
        $('#a-title').trigger('focus');
    }

    $('#new-btn').on('click', () => openDialog(null));
    $('#dlg-cancel').on('click', () => dlg.close());
    $list.on('click', '[data-edit]', function () { openDialog(items.find((a) => a.id === $(this).data('edit'))); });

    $('#a-audio').on('change', function () {
        const problem = validateUpload(this.files[0], 'audio');
        fieldError('a-audio', problem);
        if (problem) this.value = '';
    });

    function setProgress(f) {
        const pct = Math.round(f * 100);
        $('#progress-wrap').removeClass('hidden');
        $('#progress-fill').css('width', pct + '%');
        $('#progress-text').text(pct + '%');
        $('#progress-bar').attr('aria-valuenow', pct);
    }

    $('#ann-form').on('submit', async function (e) {
        e.preventDefault();
        Ui.formError($('#form-error'), '');
        const title = $.trim($('#a-title').val());
        const file = $('#a-audio')[0].files[0];
        let ok = true;
        fieldError('a-title', '');
        if (title.length < 3) { fieldError('a-title', 'Enter a title (at least 3 characters).'); ok = false; }
        if (!editingId) {
            fieldError('a-audio', '');
            if (!file) { fieldError('a-audio', 'Choose an audio file.'); ok = false; }
            else { const p = validateUpload(file, 'audio'); if (p) { fieldError('a-audio', p); ok = false; } }
        }
        if (!ok) { $('#ann-form').find('[aria-invalid="true"]').first().trigger('focus'); return; }

        const fd = new FormData();
        fd.append('title', title);
        const $btn = $('#dlg-submit');
        Ui.setLoading($btn, true, 'Saving…');
        try {
            if (editingId) {
                const res = await Api.announcements.update(editingId, fd);
                items = items.map((a) => (a.id === editingId ? { ...a, ...res.data } : a));
                Ui.toast('success', 'Announcement updated.');
            } else {
                fd.append('audio', file); // field name expected by uploadAudio.single('audio')
                fd.append('published', $('#a-published').is(':checked') ? 'true' : 'false');
                const res = await Api.announcements.create(fd, setProgress);
                items.unshift(res.data);
                Ui.toast('success', 'Announcement created. A notification was sent to all users.');
            }
            dlg.close();
            render();
        } catch (err) {
            Ui.setLoading($btn, false);
            $('#progress-wrap').addClass('hidden');
            Ui.formError($('#form-error'), err.message);
        }
    });

    /* ---------- admin: publish / unpublish / delete ---------- */
    $list.on('click', '[data-toggle]', async function () {
        const id = $(this).data('toggle');
        const a = items.find((x) => x.id === id);
        const $b = $(this).prop('disabled', true);
        try {
            const res = a.published ? await Api.announcements.unpublish(id) : await Api.announcements.publish(id);
            items = items.map((x) => (x.id === id ? { ...x, ...res.data } : x));
            Ui.toast('success', res.data.published ? 'Announcement published.' : 'Announcement unpublished.');
            render();
        } catch (err) {
            $b.prop('disabled', false);
            Ui.toast('error', err.message);
        }
    });

    $list.on('click', '[data-delete]', async function () {
        const id = $(this).data('delete');
        const a = items.find((x) => x.id === id);
        const ok = await Ui.confirm({ title: 'Delete this announcement?', message: `"${a.title}" will be permanently removed.`, confirmText: 'Delete' });
        if (!ok) return;
        try {
            await Api.announcements.remove(id);
            if (playingId === id) { player.pause(); playingId = null; }
            items = items.filter((x) => x.id !== id);
            Ui.toast('success', 'Announcement deleted.');
            render();
        } catch (err) {
            Ui.toast('error', err.message);
        }
    });

    load();
});