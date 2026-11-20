/**
 * pages/promo-detail.js
 * HTML5 video with captions. The API stores captions as plain text (`caption_text`), not a caption file,
 * so once the video's length is known we turn that text into a WebVTT track in the browser (spread across
 * the video by sentence length) and attach it as <track kind="captions" srclang="en" label="English" default>.
 * A Captions on/off button and the full transcript are provided for accessibility.
 *
 * GUARD: any signed-in user; unpublished promos are hidden from normal users.
 */
$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('promos');
    Ui.showFlash();

    const id = new URLSearchParams(location.search).get('id');
    const $root = $('#detail');
    const isAdmin = Auth.isAdmin();

    function showError(title, text, retry) {
        $root.removeAttr('aria-busy').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p class="text-lg font-extrabold">${Ui.esc(title)}</p><p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
            <div class="mt-6 flex justify-center gap-3">
                ${retry ? '<button id="retry" type="button" class="rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}
                <a href="promos.html" class="rounded-xl border border-line px-5 py-3 text-sm font-bold hover:bg-surface">Back to promos</a></div></div>`);
    }

    /* ---------- caption text -> WebVTT ---------- */
    const stamp = (s) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
    };

    // Split long sentences into short lines that are comfortable to read
    function chunks(sentence, max = 80) {
        const out = []; let line = '';
        sentence.split(' ').forEach((w) => {
            if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; }
            else line = (line + ' ' + w).trim();
        });
        if (line) out.push(line.trim());
        return out;
    }

    function buildVtt(text, duration) {
        if (/^\s*WEBVTT/.test(text)) return text; // the admin already pasted a real VTT file
        const sentences = (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
        const cues = sentences.flatMap((s) => chunks(s));
        const total = cues.reduce((n, c) => n + c.length, 0) || 1;
        let t = 0;
        const body = cues.map((c, i) => {
            const len = (c.length / total) * duration;
            const cue = `${i + 1}\n${stamp(t)} --> ${stamp(Math.min(duration, t + len))}\n${c}\n`;
            t += len;
            return cue;
        });
        return 'WEBVTT\n\n' + body.join('\n');
    }

    function addCaptions(video, text) {
        const make = () => {
            if (video.querySelector('track')) return; // only once
            const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 60;
            const url = URL.createObjectURL(new Blob([buildVtt(text, dur)], { type: 'text/vtt' }));
            const track = document.createElement('track');
            track.kind = 'captions'; track.srclang = 'en'; track.label = 'English'; track.src = url; track.default = true;
            video.appendChild(track);
            track.track.mode = 'showing'; // captions are on by default

            $('#cc-btn').removeClass('hidden').attr('aria-pressed', 'true').on('click', function () {
                const on = track.track.mode !== 'showing';
                track.track.mode = on ? 'showing' : 'hidden';
                $(this).attr('aria-pressed', on).text(on ? 'Captions: on' : 'Captions: off');
            });
        };
        if (video.readyState >= 1) make();
        else video.addEventListener('loadedmetadata', make, { once: true });
    }

    /* ---------- render ---------- */
    function render(p) {
        document.title = `${p.title} | CivicEvents`;
        $root.removeAttr('aria-busy').html(`
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-action">Promo video</p>
            <h1 class="mt-2 text-4xl font-extrabold leading-tight tracking-tight">${Ui.esc(p.title)}</h1>
            <p class="mt-3 text-sm text-muted">Added <time datetime="${Ui.esc(p.created_at)}">${Ui.esc(Ui.fmtDate(p.created_at))}</time>
                ${isAdmin && !p.published ? '<span class="ml-2 rounded-full bg-navy px-2 py-0.5 text-xs font-bold text-white">Unpublished</span>' : ''}</p>

            <section class="mt-6" aria-label="Video player">
                <video id="video" controls preload="metadata" playsinline class="aspect-video w-full rounded-2xl bg-navy" src="${Ui.esc(p.video_url)}" aria-label="${Ui.esc(p.title)}">
                    Your browser cannot play this video. <a href="${Ui.esc(p.video_url)}" class="underline">Download the video</a> instead.
                </video>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <button id="cc-btn" type="button" aria-pressed="true" class="hidden rounded-xl border border-line px-4 py-2 text-sm font-bold hover:bg-surface">Captions: on</button>
                    <p id="video-error" role="alert" class="hidden text-sm font-semibold text-red-700"></p>
                </div>
            </section>

            <section class="mt-8" aria-labelledby="about-h">
                <h2 id="about-h" class="text-xl font-extrabold">About this promo</h2>
                <p class="mt-3 whitespace-pre-line leading-relaxed">${Ui.esc(p.description || 'No description provided.')}</p>
            </section>

            <section class="mt-8" aria-labelledby="tr-h">
                <h2 id="tr-h" class="text-xl font-extrabold">Transcript</h2>
                <p class="mt-3 whitespace-pre-line rounded-xl bg-surface p-5 text-sm leading-relaxed">${Ui.esc(p.caption_text || 'No transcript has been provided.')}</p>
            </section>`);

        const video = document.getElementById('video');
        video.addEventListener('error', () => $('#video-error').text('This video could not be played. Try downloading it instead.').removeClass('hidden'));
        if (p.caption_text) addCaptions(video, p.caption_text);
    }

    async function load() {
        if (!id) return showError('No promo selected', 'Open one from the promos list.');
        $root.attr('aria-busy', 'true').html('<div class="skeleton h-10 w-2/3"></div><div class="skeleton mt-6 aspect-video"></div>');
        try {
            const res = await Api.promos.get(id);
            const p = res.data;
            if (!isAdmin && p.published === false) return showError('Promo not available', 'This promo is not published.');
            render(p);
        } catch (err) {
            if (err.status === 404) showError('Promo not found', 'It may have been removed.');
            else showError('We could not load this promo', err.message, true);
        }
    }
    $root.on('click', '#retry', load);
    load();
});