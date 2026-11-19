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

    return { toast, showFlash, setLoading, formError };
})();