/**
 * pages/profile.js
 * Shows the signed-in user's profile. Only full_name and email can be edited:
 * role and is_active are read-only here (and the backend rejects them with 400 if sent).
 * A changed email asks for confirmation first, and a 409 from the API (email already used) is explained.
 *
 * GUARD: any signed-in user (each user can only reach their own profile: GET/PATCH /users/profile/me).
 */
$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('profile');
    Ui.showFlash();

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let profile = null;

    function fieldError(id, msg) {
        $('#' + id).attr('aria-invalid', msg ? 'true' : 'false').toggleClass('border-red-500', !!msg);
        $('#' + id + '-error').text(msg || '').toggleClass('hidden', !msg);
    }

    function fill(p) {
        profile = p;
        $('#full_name').val(p.full_name);
        $('#email').val(p.email);
        $('#v-role').text(p.role);
        $('#v-active').html(p.is_active
            ? '<span class="text-emerald-700">Active</span>'
            : '<span class="text-red-700">Disabled</span>');
    }

    async function load() {
        $('#load-state').html('<div class="space-y-4" aria-busy="true"><div class="skeleton h-24"></div><div class="skeleton h-64"></div></div>');
        try {
            const res = await Api.users.me();
            fill(res.data);
            $('#load-state').empty();
            $('#content').removeClass('hidden');
            loadActivity();
        } catch (err) {
            $('#load-state').html(`<div class="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
                <p class="text-lg font-extrabold">We could not load your profile</p><p class="mt-2 text-sm text-muted">${Ui.esc(err.message)}</p>
                <button id="retry" type="button" class="mt-6 rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button></div>`);
        }
    }
    $('#load-state').on('click', '#retry', load);

    // Small activity summary from GET /dashboard/me (counts come back as strings, so convert them)
    async function loadActivity() {
        if (Auth.isAdmin()) return;
        try {
            const res = await Api.dashboard.me();
            const d = res.data;
            const cards = [
                ['Events registered', Number(d.registrations.total_registered_events)],
                ['Feedback given', Number(d.feedbacks.total_feedbacks)],
                ['Notifications', Number(d.notifications.total_notifications)],
            ];
            $('#activity-cards').html(cards.map(([label, n]) => `<div class="rounded-2xl border border-line p-5"><dt class="text-xs font-bold uppercase tracking-wide text-muted">${label}</dt><dd class="mt-1 text-3xl font-extrabold">${n}</dd></div>`).join(''));
            $('#activity').removeClass('hidden');
        } catch (e) { /* the summary is optional; stay quiet */ }
    }

    $('#reset-btn').on('click', () => { fill(profile); fieldError('full_name', ''); fieldError('email', ''); Ui.formError($('#form-error'), ''); });

    $('#profile-form').on('submit', async function (e) {
        e.preventDefault();
        Ui.formError($('#form-error'), '');
        fieldError('full_name', ''); fieldError('email', '');

        const full_name = $.trim($('#full_name').val());
        const email = $.trim($('#email').val());
        let ok = true;
        if (full_name.length < 2) { fieldError('full_name', 'Enter your full name.'); ok = false; }
        if (!EMAIL_RE.test(email)) { fieldError('email', 'Enter a valid email address.'); ok = false; }
        if (!ok) { $(this).find('[aria-invalid="true"]').first().trigger('focus'); return; }

        const changes = {};
        if (full_name !== profile.full_name) changes.full_name = full_name;
        if (email !== profile.email) changes.email = email;
        if (!Object.keys(changes).length) { Ui.toast('info', 'Nothing to save: no changes were made.'); return; }

        if (changes.email) {
            const sure = await Ui.confirm({ title: 'Change your email?', message: `You will use ${email} to sign in from now on.`, confirmText: 'Change email' });
            if (!sure) return;
        }

        const $btn = $('#save-btn');
        Ui.setLoading($btn, true, 'Saving…');
        try {
            const res = await Api.users.updateMe(changes); // role / is_active are never sent
            fill(res.data);
            Auth.updateUser({ full_name: res.data.full_name, email: res.data.email });
            Layout.refreshUser(); // update the name in the navbar
            Ui.toast('success', 'Profile updated.');
        } catch (err) {
            if (err.status === 409) {
                fieldError('email', 'That email is already used by another account. Please choose a different one.');
                $('#email').trigger('focus');
            } else {
                Ui.formError($('#form-error'), err.message);
            }
        } finally {
            Ui.setLoading($btn, false);
        }
    });

    load();
});