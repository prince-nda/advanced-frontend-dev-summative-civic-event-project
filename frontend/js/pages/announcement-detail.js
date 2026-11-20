/**
 * pages/announcement-detail.js
 * One announcement with an accessible HTML5 audio player:
 * native keyboard-focusable controls, a live "current / total" time, 10-second skip buttons,
 * playback speed, and fallback text for browsers that cannot play the file.
 *
 * GUARD: any signed-in user. Unpublished announcements are hidden from normal users
 *        (admins can open them). Admin edit/publish/delete controls live on the list page.
 */
$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('announcements');
    Ui.showFlash();

    const id = new URLSearchParams(location.search).get('id');
    const $root = $('#detail');
    const isAdmin = Auth.isAdmin();

    function showError(title, text, retry) {
        $root.removeAttr('aria-busy').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p class="text-lg font-extrabold">${Ui.esc(title)}</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
            <div class="mt-6 flex justify-center gap-3">
                ${retry ? '<button id="retry" type="button" class="rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}
                <a href="announcements.html" class="rounded-xl border border-line px-5 py-3 text-sm font-bold hover:bg-surface">Back to announcements</a></div></div>`);
    }

    function render(a) {
        document.title = `${a.title} | CivicEvents`;
        $root.removeAttr('aria-busy').html(`
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-action">Audio announcement</p>
            <h1 class="mt-2 text-4xl font-extrabold leading-tight tracking-tight">${Ui.esc(a.title)}</h1>
            <p class="mt-3 text-sm text-muted">Published <time datetime="${Ui.esc(a.created_at)}">${Ui.esc(Ui.fmtDateTime(a.created_at))}</time>
                ${isAdmin && !a.published ? '<span class="ml-2 rounded-full bg-navy px-2 py-0.5 text-xs font-bold text-white">Unpublished</span>' : ''}</p>

            <section class="mt-8 rounded-2xl bg-navy p-6 text-white shadow-card sm:p-8" aria-label="Audio player">
                <audio id="audio" controls preload="metadata" class="w-full" aria-label="Audio for ${Ui.esc(a.title)}" src="${Ui.esc(a.audio_url)}">
                    Your browser cannot play this audio. <a href="${Ui.esc(a.audio_url)}" class="underline">Download the audio file</a> instead.
                </audio>

                <p class="mt-5 text-center text-3xl font-extrabold tabular-nums" aria-hidden="true"><span id="cur">0:00</span> <span class="text-white/50">/</span> <span id="dur">--:--</span></p>
                <p class="sr-only" id="time-sr" aria-live="off"></p>

                <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button type="button" id="back10" class="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold hover:bg-white/10">↺ Back 10 s</button>
                    <button type="button" id="fwd10" class="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold hover:bg-white/10">Forward 10 s ↻</button>
                    <label class="flex items-center gap-2 text-sm font-semibold">Speed
                        <select id="speed" class="rounded-lg border border-white/30 bg-navy px-2 py-2 text-sm text-white">
                            <option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option>
                        </select>
                    </label>
                </div>
                <p id="audio-error" role="alert" class="mt-4 hidden text-center text-sm font-semibold text-brand"></p>
            </section>

            <section class="mt-10" aria-labelledby="tr-h">
                <h2 id="tr-h" class="text-xl font-extrabold">Transcript</h2>
                <p class="mt-3 rounded-xl bg-surface px-4 py-5 text-sm text-muted">No written transcript has been provided for this announcement. Use the audio player above to listen.</p>
            </section>`);

        const audio = document.getElementById('audio');
        const update = () => {
            $('#cur').text(Ui.fmtDuration(audio.currentTime));
            $('#dur').text(Ui.fmtDuration(audio.duration));
        };
        ['loadedmetadata', 'timeupdate', 'durationchange', 'seeked'].forEach((ev) => audio.addEventListener(ev, update));
        audio.addEventListener('error', () => $('#audio-error').text('This audio could not be played. Try downloading it instead.').removeClass('hidden'));
        $('#back10').on('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
        $('#fwd10').on('click', () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); });
        $('#speed').on('change', function () { audio.playbackRate = Number(this.value); });
    }

    async function load() {
        if (!id) return showError('No announcement selected', 'Open one from the announcements list.');
        $root.attr('aria-busy', 'true').html('<div class="skeleton h-10 w-2/3"></div><div class="skeleton mt-6 h-48"></div>');
        try {
            const res = await Api.announcements.get(id);
            const a = res.data;
            if (!isAdmin && a.published === false) return showError('Announcement not available', 'This announcement is not published.');
            render(a);
        } catch (err) {
            if (err.status === 404) showError('Announcement not found', 'It may have been removed.');
            else showError('We could not load this announcement', err.message, true);
        }
    }
    $root.on('click', '#retry', load);
    load();
});