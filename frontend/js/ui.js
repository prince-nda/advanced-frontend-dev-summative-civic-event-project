/**
 * ui.js
 * Small shared UI helpers: toasts, one-shot flash messages, button loading state.
 * Requires: jQuery, config.js, auth.js
 */
const Ui = (() => {
    const ICONS = { success: '✓', error: '!', info: 'i' };
    const COLORS = {
        success: 'border-emerald-600',
        error: 'border-red-600',
        info: 'border-navy',
    };

    // Polite live region so screen readers announce toasts
    function region() {
        let $r = $('#toast-region');
        if (!$r.length) {
            $r = $('<div id="toast-region" role="status" aria-live="polite" aria-atomic="false" ' +
                'class="fixed top-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3"></div>');
            $('body').append($r);
        }
        return $r;
    }

    function toast(type, message, ms = 5000) {
        const $t = $(
            `<div class="toast flex items-start gap-3 rounded-xl border-l-4 ${COLORS[type] || COLORS.info} bg-white p-4 shadow-card">
                <span aria-hidden="true" class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">${ICONS[type] || 'i'}</span>
                <p class="flex-1 text-sm font-medium text-navy"></p>
                <button type="button" class="-m-1 rounded p-1 text-muted hover:text-navy" aria-label="Dismiss message">✕</button>
            </div>`
        );
        $t.find('p').text(message); // .text() keeps API messages from injecting HTML
        $t.find('button').on('click', () => $t.remove());
        region().append($t);
        if (ms) setTimeout(() => $t.fadeOut(200, () => $t.remove()), ms);
    }

    // Show a message stored by Auth.setFlash() before a redirect (e.g. "session expired")
    function showFlash() {
        const flash = Auth.takeFlash();
        if (flash) toast(flash.type, flash.message, 7000);
    }

    // Disable a button and show a spinner label while a request is running
    function setLoading($btn, loading, label) {
        if (loading) {
            $btn.data('label', $btn.html()).prop('disabled', true).attr('aria-busy', 'true')
                .html(`<span class="spinner" aria-hidden="true"></span><span>${label || 'Please wait…'}</span>`);
        } else {
            $btn.prop('disabled', false).removeAttr('aria-busy').html($btn.data('label'));
        }
    }

    // Inline form error (role="alert" element); pass '' to clear
    function formError($el, message) {
        if (message) $el.text(message).removeClass('hidden');
        else $el.text('').addClass('hidden');
    }

    // Escape text before putting API data into HTML strings (prevents XSS)
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Rwanda: Central Africa Time (UTC+2, no daylight saving), day-month-year dates.
    // Events are shown in Rwanda time for every visitor so a date never shifts with the device's time zone.
    const TZ = 'Africa/Kigali';
    const LOCALE = 'en-GB';

    function fmtDateTime(iso) {
        if (!iso) return 'Date to be announced';
        const d = new Date(iso);
        if (isNaN(d)) return 'Date to be announced';
        return new Intl.DateTimeFormat(LOCALE, {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
        }).format(d);
    }

    // "2025-11-21" in Rwanda time (used to compare days)
    function dayKey(iso) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
    }
    function fmtToday() {
        return new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date());
    }
    function hourNow() {
        return Number(new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date())) % 24;
    }
    function fmtTime(iso) {
        return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
    }
    function monthDay(iso) {
        const d = new Date(iso);
        return {
            month: new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: TZ }).format(d),
            day: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: TZ }).format(d),
        };
    }
    // <input type="datetime-local"> has no time zone: treat what the admin types as Rwanda time
    function toKigaliInput(iso) {
        const d = new Date(iso);
        return isNaN(d) ? '' : new Date(d.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 16);
    }
    function fromKigaliInput(value) {
        return new Date(value + ':00+02:00').toISOString();
    }

    function timeAgo(iso) {
        const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
        if (isNaN(secs)) return '';
        if (secs < 60) return 'Just now';
        const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
        for (const [name, size] of units) {
            if (secs >= size) { const n = Math.floor(secs / size); return `${n} ${name}${n > 1 ? 's' : ''} ago`; }
        }
        return '';
    }

    // Accessible confirmation dialog (native <dialog>); resolves true when confirmed
    function confirmDialog({ title, message, confirmText = 'Delete' }) {
        return new Promise((resolve) => {
            const $d = $(
                `<dialog class="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-card backdrop:bg-navy/60" aria-labelledby="dlg-title">
                    <form method="dialog" class="p-6">
                        <h2 id="dlg-title" class="text-lg font-extrabold text-navy"></h2>
                        <p class="mt-2 text-sm text-muted"></p>
                        <div class="mt-6 flex justify-end gap-3">
                            <button value="cancel" class="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-navy hover:bg-surface">Cancel</button>
                            <button value="ok" class="rounded-xl bg-action px-4 py-2.5 text-sm font-bold text-white hover:bg-action-dark"></button>
                        </div>
                    </form>
                </dialog>`
            );
            $d.find('h2').text(title);
            $d.find('p').text(message);
            $d.find('button[value="ok"]').text(confirmText);
            $('body').append($d);
            const el = $d[0];
            el.addEventListener('close', () => { resolve(el.returnValue === 'ok'); $d.remove(); });
            el.showModal();
        });
    }

    // 83 -> "1:23" (used for audio length)
    function fmtDuration(sec) {
        if (!isFinite(sec)) return '--:--';
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function fmtDate(iso) {
        const d = new Date(iso);
        return isNaN(d) ? '' : new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(d);
    }

    // Shows a WHOLE image (portrait posters included) inside a box without cropping it:
    // the sharp image is "contained", and a blurred copy of it fills the empty space around it.
    // boxClass sets the size (it must give the box a height); imgClass is added to the sharp <img>.
    function mediaImg(url, alt, boxClass, imgClass) {
        const src = esc(url);
        return `<div class="relative overflow-hidden bg-surface ${boxClass || ''}">
            <img src="${src}" alt="" aria-hidden="true" loading="lazy" class="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl">
            <img src="${src}" alt="${esc(alt || '')}" loading="lazy" class="absolute inset-0 h-full w-full object-contain ${imgClass || ''}">
        </div>`;
    }

    return { toast, showFlash, setLoading, formError, esc, mediaImg, fmtDateTime, fmtDate, fmtDuration, timeAgo, confirm: confirmDialog,
        dayKey, fmtToday, hourNow, fmtTime, monthDay, toKigaliInput, fromKigaliInput };
})();