/**
 * pages/signup.js
 * GUARD: signed-in visitors skip this page (Auth.redirectIfLoggedIn).
 * NOTE: we never send a `role` field. The backend would accept it, so the form simply never offers it;
 *       every new account is a normal user. Admins are created in the database.
 */
$(function () {
    Auth.redirectIfLoggedIn();

    const $form = $('#signup-form');
    const $btn = $('#submit-btn');
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const RULES = {
        len: (p) => p.length >= 8,
        lower: (p) => /[a-z]/.test(p),
        upper: (p) => /[A-Z]/.test(p),
        num: (p) => /\d/.test(p),
        sym: (p) => /[\W_]/.test(p),
    };
    const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

    // Show / hide password toggles (both fields)
    $('.toggle-pw').on('click', function () {
        const $input = $('#' + $(this).data('target'));
        const show = $input.attr('type') === 'password';
        $input.attr('type', show ? 'text' : 'password');
        $(this).text(show ? 'Hide' : 'Show').attr('aria-pressed', show);
    });

    // Live strength meter + rule checklist
    $('#password').on('input', function () {
        const p = $(this).val();
        let passed = 0;
        $('#rules li').each(function () {
            const ok = RULES[$(this).data('rule')](p);
            if (ok) passed++;
            $(this).toggleClass('text-emerald-700 font-bold', ok).toggleClass('text-muted', !ok)
                .text((ok ? '✓ ' : '• ') + $(this).text().replace(/^[✓•]\s/, ''));
        });
        // 5 rules -> 4 bars: "Strong" (4) only when every rule passes
        const level = !p ? 0 : passed === 5 ? 4 : Math.max(1, Math.min(3, passed - 1));
        $('.meter-seg').each(function (i) {
            $(this).attr('class', 'meter-seg' + (i < level ? ' on-' + level : ''));
        });
        $('#strength-label').text('Password strength: ' + (p ? LABELS[level] : 'enter a password'));
    });

    function fieldError(id, message) {
        const $input = $('#' + id);
        $input.attr('aria-invalid', message ? 'true' : 'false').toggleClass('border-red-500', !!message);
        $('#' + id + '-error').text(message || '').toggleClass('hidden', !message);
    }

    function validate(v) {
        ['full_name', 'email', 'password', 'confirm_password'].forEach((f) => fieldError(f, ''));
        let ok = true;
        if (v.full_name.length < 2) { fieldError('full_name', 'Enter your full name.'); ok = false; }
        if (!EMAIL_RE.test(v.email)) { fieldError('email', 'Enter a valid email address.'); ok = false; }
        if (!CONFIG.PASSWORD_REGEX.test(v.password)) {
            fieldError('password', 'Password must be 8+ characters with upper and lower case, a number and a special character.');
            ok = false;
        }
        if (v.password !== v.confirm_password) { fieldError('confirm_password', 'Passwords do not match.'); ok = false; }
        if (!ok) $form.find('[aria-invalid="true"]').first().trigger('focus');
        return ok;
    }

    $form.on('submit', async function (e) {
        e.preventDefault();
        Ui.formError($('#form-error'), '');

        const v = {
            full_name: $.trim($('#full_name').val()),
            email: $.trim($('#email').val()),
            password: $('#password').val(),
            confirm_password: $('#confirm_password').val(),
        };
        if (!validate(v)) return;

        Ui.setLoading($btn, true, 'Creating account…');
        try {
            // confirm_password is checked here only; the API doesn't need it
            await Api.auth.signup({ full_name: v.full_name, email: v.email, password: v.password });
            Auth.setFlash('success', 'Account created! Please sign in.');
            location.href = 'login.html';
        } catch (err) {
            Ui.setLoading($btn, false);
            if (err.status === 409) {
                fieldError('email', 'That email is already in use. Try signing in instead.');
                $('#email').trigger('focus');
            } else {
                Ui.formError($('#form-error'), err.message || 'Could not create your account. Please try again.');
            }
        }
    });
});