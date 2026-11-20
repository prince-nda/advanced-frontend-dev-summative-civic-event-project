$(function () {
    const user = Auth.requireAdmin();
    if (!user) return;
    Layout.mount('admin');

    const id = new URLSearchParams(location.search).get('id');
    const editing = !!id;
    const $form = $('#event-form');
    const $btn = $('#submit-btn');
    let currentImageUrl = null;
    let previewUrl = null;

    /* ---------- helpers ---------- */
    const pad = (n) => String(n).padStart(2, '0');
    // ISO string -> value for <input type="datetime-local"> in the user's own timezone
    function toLocalInput(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function fieldError(name, message) {
        const $input = $('#' + name);
        $input.attr('aria-invalid', message ? 'true' : 'false').toggleClass('border-red-500', !!message);
        $('#' + name + '-error').text(message || '').toggleClass('hidden', !message);
    }

    function showPreview(src, caption) {
        $('#preview').attr('src', src);
        $('#preview-caption').text(caption);
        $('#preview-wrap').removeClass('hidden');
    }

    /* ---------- edit mode: load the event ---------- */
    async function loadForEdit() {
        $('#form-title').text('Edit event');
        $('#form-sub').text('Update the details below. Leave the image empty to keep the current one.');
        $btn.text('Save changes');
        $form.addClass('hidden');
        $('#load-state').removeClass('hidden').html('<div class="mt-8 space-y-4" aria-busy="true"><div class="skeleton h-14"></div><div class="skeleton h-32"></div><div class="skeleton h-14"></div></div>');
        try {
            const res = await Api.events.get(id);
            const e = res.data;
            $('#title').val(e.title);
            $('#description').val(e.description || '');
            $('#location').val(e.location || '');
            $('#starts_at').val(toLocalInput(e.starts_at));
            $('#ends_at').val(toLocalInput(e.ends_at));
            currentImageUrl = e.metadata && e.metadata.image_url;
            if (currentImageUrl) showPreview(currentImageUrl, 'Current image. Choose a new file to replace it.');
            $('#load-state').addClass('hidden').empty();
            $form.removeClass('hidden');
        } catch (err) {
            $('#load-state').html(`<div class="mt-8 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
                <p class="text-lg font-extrabold">${err.status === 404 ? 'Event not found' : 'We could not load this event'}</p>
                <p class="mt-2 text-sm text-muted">${Ui.esc(err.message)}</p>
                <a href="events.html" class="mt-6 inline-block rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Back to events</a></div>`);
        }
    }

    /* ---------- image selection: validate type/size BEFORE uploading, then preview ---------- */
    $('#image').on('change', function () {
        const file = this.files[0];
        fieldError('image', '');
        if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }

        if (!file) {
            if (currentImageUrl) showPreview(currentImageUrl, 'Current image. Choose a new file to replace it.');
            else $('#preview-wrap').addClass('hidden');
            return;
        }
        const problem = validateUpload(file, 'image');
        if (problem) {
            fieldError('image', problem);
            this.value = '';
            $('#preview-wrap').addClass('hidden');
            return;
        }
        previewUrl = URL.createObjectURL(file);
        showPreview(previewUrl, `${file.name} (${(file.size / 1024).toFixed(0)} KB). This is a preview; nothing is uploaded until you save.`);
    });

    /* ---------- validation ---------- */
    function validate(v) {
        ['title', 'location', 'starts_at', 'ends_at'].forEach((f) => fieldError(f, ''));
        let ok = true;
        if (v.title.length < 3) { fieldError('title', 'Enter a title (at least 3 characters).'); ok = false; }
        if (!v.location) { fieldError('location', 'Enter where the event takes place.'); ok = false; }
        if (!v.starts_at) { fieldError('starts_at', 'Choose a start date and time.'); ok = false; }
        if (!v.ends_at) { fieldError('ends_at', 'Choose an end date and time.'); ok = false; }
        if (v.starts_at && v.ends_at && new Date(v.ends_at) <= new Date(v.starts_at)) {
            fieldError('ends_at', 'The end must be after the start.');
            ok = false;
        }
        if (!ok) $form.find('[aria-invalid="true"]').first().trigger('focus');
        return ok;
    }

    /* ---------- progress ---------- */
    function setProgress(fraction) {
        const pct = Math.round(fraction * 100);
        $('#progress-wrap').removeClass('hidden');
        $('#progress-fill').css('width', pct + '%');
        $('#progress-text').text(pct + '%');
        $('#progress-bar').attr('aria-valuenow', pct);
    }

    /* ---------- submit ---------- */
    $form.on('submit', async function (e) {
        e.preventDefault();
        Ui.formError($('#form-error'), '');

        const v = {
            title: $.trim($('#title').val()),
            description: $.trim($('#description').val()),
            location: $.trim($('#location').val()),
            starts_at: $('#starts_at').val(),
            ends_at: $('#ends_at').val(),
        };
        if (!validate(v)) return;

        const fd = new FormData();
        fd.append('title', v.title);
        fd.append('description', v.description);
        fd.append('location', v.location);
        fd.append('starts_at', new Date(v.starts_at).toISOString()); // sent as UTC
        fd.append('ends_at', new Date(v.ends_at).toISOString());
        const file = $('#image')[0].files[0];
        if (file) fd.append('image', file); // field name expected by uploadEventImage.single('image')

        Ui.setLoading($btn, true, editing ? 'Saving…' : 'Creating…');
        $('#progress-wrap').addClass('hidden');
        try {
            const res = file
                ? await (editing ? Api.events.update(id, fd, setProgress) : Api.events.create(fd, setProgress))
                : await (editing ? Api.events.update(id, fd) : Api.events.create(fd));

            const newId = (res.data && res.data.id) || id;
            Auth.setFlash('success', editing ? 'Event updated successfully.' : 'Event created. A notification was sent to all users.');
            location.href = 'event-detail.html?id=' + encodeURIComponent(newId);
        } catch (err) {
            Ui.setLoading($btn, false);
            $('#progress-wrap').addClass('hidden');
            Ui.formError($('#form-error'), err.message || 'Could not save the event. Please try again.');
            $('#form-error')[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    if (editing) loadForEdit();
});