/**
 * pages/login.js
 * GUARD: signed-in visitors skip this page (Auth.redirectIfLoggedIn).
 */
$(function () {
    Auth.redirectIfLoggedIn();
    Ui.showFlash(); // e.g. "Account created, please sign in" or "Session expired"

    const $form = $('#login-form');
    const $btn = $('#submit-btn');
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Show / hide password
    $('#toggle-password').on('click', function () {
        const show = $('#password').attr('type') === 'password';
        $('#password').attr('type', show ? 'text' : 'password');
        $(this).text(show ? 'Hide' : 'Show').attr('aria-pressed', show);
    });

    function fieldError(id, message) {
        const $input = $('#' + id);
        const $msg = $('#' + id + '-error');
        $input.attr('aria-invalid', message ? 'true' : 'false').toggleClass('border-red-500', !!message);
        $msg.text(message || '').toggleClass('hidden', !message);
    }

    // Client-side validation before calling the server
    function validate(email, password) {
        let ok = true;
        fieldError('email', '');
        fieldError('password', '');
        if (!EMAIL_RE.test(email)) { fieldError('email', 'Enter a valid email address.'); ok = false; }
        if (!password) { fieldError('password', 'Enter your password.'); ok = false; }
        if (!ok) $form.find('[aria-invalid="true"]').first().trigger('focus');
        return ok;
    }

    $form.on('submit', async function (e) {
        e.preventDefault();
        Ui.formError($('#form-error'), '');

        const email = $.trim($('#email').val());
        const password = $('#password').val();
        if (!validate(email, password)) return;

        Ui.setLoading($btn, true, 'Signing in…');
        try {
            const res = await Api.auth.login({ email, password });
            Auth.save(res.data.token, res.data.user, $('#remember').is(':checked'));

            // The backend does not stop disabled accounts from logging in, so check the profile here.
            const me = await Api.users.me();
            if (me.data && me.data.is_active === false) {
                Auth.clear();
                throw { message: 'Your account has been disabled. Please contact an administrator.' };
            }

            Auth.setFlash('success', `Welcome back, ${res.data.user.full_name}!`);
            location.href = Auth.homeUrl(); // admin -> dashboard, user -> events
        } catch (err) {
            Auth.clear();
            Ui.setLoading($btn, false);
            const msg = err.status === 401 ? 'Incorrect email or password.' : err.message;
            Ui.formError($('#form-error'), msg || 'Could not sign in. Please try again.');
            $('#form-error')[0].scrollIntoView({ block: 'nearest' });
        }
    });
});