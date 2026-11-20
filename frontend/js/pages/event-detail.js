$(function () {
    const user = Auth.requireAuth();
    if (!user) return;
    Layout.mount('events');
    Ui.showFlash();

    const id = new URLSearchParams(location.search).get('id');
    const isAdmin = Auth.isAdmin();
    const $root = $('#detail');

    let ev = null;          // the event
    let myReg = null;       // this user's registration row (status: registered | cancelled), or null
    let myFeedback = null;  // this user's feedback row for this event, or null
    let attendees = null;   // admin: array | null if it failed to load
    let allFeedback = null; // admin: array | null
    let editingFeedback = false;

    /* ---------- states ---------- */
    function skeleton() {
        $root.attr('aria-busy', 'true').html('<div class="skeleton h-72"></div><div class="mt-6 space-y-4"><div class="skeleton h-10 w-2/3"></div><div class="skeleton h-5 w-1/3"></div><div class="skeleton h-32"></div></div>');
    }

    function showError(title, text, retry) {
        $root.removeAttr('aria-busy').html(`
            <div class="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                <p class="text-lg font-extrabold">${Ui.esc(title)}</p>
                <p class="mx-auto mt-2 max-w-md text-sm text-muted">${Ui.esc(text)}</p>
                <div class="mt-6 flex justify-center gap-3">
                    ${retry ? '<button id="retry" type="button" class="rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Try again</button>' : ''}
                    <a href="events.html" class="rounded-xl border border-line px-5 py-3 text-sm font-bold hover:bg-surface">Back to events</a>
                </div>
            </div>`);
    }

    /* ---------- load ---------- */
    async function load() {
        if (!id) return showError('No event selected', 'Open an event from the events list.');
        skeleton();
        try {
            const res = await Api.events.get(id);
            ev = res.data;
            if (!isAdmin && ev.published === false) return showError('Event not available', 'This event is not published.');

            if (isAdmin) {
                const [a, f] = await Promise.all([
                    Api.registrations.attendees(id).catch(() => null),
                    Api.feedback.forEvent(id).catch(() => null),
                ]);
                attendees = a && a.data;
                allFeedback = f && f.data;
            } else {
                const [mine, fb] = await Promise.all([
                    Api.registrations.mine().catch(() => null),
                    Api.feedback.mine().catch(() => null),
                ]);
                myReg = ((mine && mine.data) || []).find((r) => r.event_id === id) || null;
                myFeedback = ((fb && fb.data) || []).find((f) => f.event_id === id) || null;
            }
            document.title = `${ev.title} | CivicEvents`;
            render();
        } catch (err) {
            if (err.status === 404) showError('Event not found', 'It may have been removed.');
            else showError('We could not load this event', err.message, true);
        }
    }

    /* ---------- render helpers ---------- */
    const hasEnded = () => new Date(ev.ends_at || ev.starts_at).getTime() < Date.now();

    function range() {
        if (!ev.starts_at) return 'Date to be announced';
        const s = new Date(ev.starts_at), e = ev.ends_at ? new Date(ev.ends_at) : null;
        if (!e) return Ui.fmtDateTime(ev.starts_at);
        const sameDay = s.toDateString() === e.toDateString();
        const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
        return sameDay ? `${Ui.fmtDateTime(ev.starts_at)} to ${time.format(e)}` : `${Ui.fmtDateTime(ev.starts_at)} to ${Ui.fmtDateTime(ev.ends_at)}`;
    }

    const stars = (n) => `<span class="text-action" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;

    function actionsHtml() {
        if (isAdmin) {
            return `<div class="flex flex-wrap gap-3">
                <a href="event-form.html?id=${encodeURIComponent(ev.id)}" class="rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark">Edit event</a>
                <button type="button" id="delete-event" class="rounded-xl border border-red-300 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50">Delete</button>
            </div>`;
        }
        if (myReg && myReg.status === 'registered') {
            return `<p class="rounded-xl bg-tint px-4 py-3 text-sm font-bold text-action-dark">✓ You are registered for this event</p>
                <button type="button" id="cancel-reg" class="mt-3 w-full rounded-xl border border-line px-5 py-3 text-sm font-bold hover:bg-surface">Cancel registration</button>`;
        }
        if (myReg && myReg.status === 'cancelled') {
            return `<p class="rounded-xl bg-surface px-4 py-3 text-sm text-muted">You cancelled your registration. The system does not allow registering again for the same event.</p>`;
        }
        if (hasEnded()) return '<p class="rounded-xl bg-surface px-4 py-3 text-sm font-bold text-muted">This event has ended.</p>';
        return '<button type="button" id="register" class="w-full rounded-xl bg-action px-5 py-3.5 text-sm font-bold text-white shadow-glow hover:bg-action-dark disabled:opacity-70">Register for this event</button>';
    }

    function feedbackFormHtml() {
        const r = myFeedback ? Number(myFeedback.rating) : 0;
        const pills = [1, 2, 3, 4, 5].map((n) => `
            <div>
                <input type="radio" name="rating" id="rate-${n}" value="${n}" class="peer sr-only" ${r === n ? 'checked' : ''}>
                <label for="rate-${n}" class="flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-line px-3 text-sm font-bold hover:bg-surface peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand/40">${n} ★</label>
            </div>`).join('');
        return `
            <form id="feedback-form" class="mt-4 space-y-4" novalidate>
                <fieldset>
                    <legend class="mb-2 text-sm font-bold">Your rating <span class="text-action" aria-hidden="true">*</span></legend>
                    <div class="flex flex-wrap gap-2">${pills}</div>
                    <p id="rating-error" class="mt-1.5 hidden text-sm font-medium text-red-700"></p>
                </fieldset>
                <div>
                    <label for="comment" class="mb-2 block text-sm font-bold">Comment</label>
                    <textarea id="comment" rows="3" maxlength="500" class="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-action focus:ring-4 focus:ring-brand/20" placeholder="How was the event?">${Ui.esc(myFeedback ? myFeedback.comment : '')}</textarea>
                </div>
                <div id="feedback-error" role="alert" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"></div>
                <div class="flex gap-3">
                    <button type="submit" id="feedback-submit" class="rounded-xl bg-action px-5 py-3 text-sm font-bold text-white hover:bg-action-dark disabled:opacity-70">${myFeedback ? 'Save changes' : 'Submit feedback'}</button>
                    ${myFeedback ? '<button type="button" id="feedback-cancel" class="rounded-xl border border-line px-5 py-3 text-sm font-bold hover:bg-surface">Cancel</button>' : ''}
                </div>
            </form>`;
    }

    function feedbackHtml() {
        if (isAdmin) {
            if (allFeedback === null) return '<p class="mt-4 text-sm text-muted">Feedback could not be loaded right now.</p>';
            if (!allFeedback.length) return '<p class="mt-4 rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">No feedback yet.</p>';
            const avg = allFeedback.reduce((sum, f) => sum + Number(f.rating), 0) / allFeedback.length;
            return `
                <div class="mt-4 flex items-center gap-4 rounded-xl bg-surface p-4">
                    <p class="text-4xl font-extrabold">${avg.toFixed(1)}</p>
                    <div><p class="text-lg">${stars(Math.round(avg))}</p><p class="text-sm text-muted">Average of ${allFeedback.length} rating${allFeedback.length === 1 ? '' : 's'}</p></div>
                </div>
                <ul class="mt-4 divide-y divide-line">${allFeedback.map((f) => `
                    <li class="py-4">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <p class="text-sm font-extrabold">${Ui.esc(f.full_name)}</p>
                            <p class="text-xs text-muted">${Ui.esc(Ui.timeAgo(f.created_at))}</p>
                        </div>
                        <p class="mt-1">${stars(Number(f.rating))}</p>
                        ${f.comment ? `<p class="mt-2 text-sm leading-relaxed text-muted">${Ui.esc(f.comment)}</p>` : ''}
                    </li>`).join('')}</ul>`;
        }
        // Normal user: one feedback per event (backend rule)
        if (myFeedback && !editingFeedback) {
            return `
                <div class="mt-4 rounded-xl border border-line p-4">
                    <p class="text-sm font-bold text-muted">Your feedback</p>
                    <p class="mt-1 text-lg">${stars(Number(myFeedback.rating))}</p>
                    ${myFeedback.comment ? `<p class="mt-2 text-sm leading-relaxed">${Ui.esc(myFeedback.comment)}</p>` : ''}
                    <button type="button" id="edit-feedback" class="mt-3 text-sm font-bold text-action hover:underline">Edit your feedback</button>
                </div>
                <p class="mt-3 text-xs text-muted">You can leave one piece of feedback per event. Ratings from all attendees are visible to organizers only.</p>`;
        }
        return feedbackFormHtml() + '<p class="mt-3 text-xs text-muted">You can leave one piece of feedback per event. Ratings from all attendees are visible to organizers only.</p>';
    }

    function attendeesHtml() {
        if (!isAdmin) return '';
        let body;
        if (attendees === null) body = '<p class="mt-4 text-sm text-muted">The attendee list could not be loaded right now.</p>';
        else if (!attendees.length) body = '<p class="mt-4 rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">Nobody has registered yet.</p>';
        else {
            body = `<div class="mt-4 overflow-x-auto rounded-xl border border-line"><table class="w-full text-left text-sm">
                <caption class="sr-only">People registered for ${Ui.esc(ev.title)}</caption>
                <thead class="bg-surface text-xs uppercase tracking-wide text-muted"><tr><th scope="col" class="px-4 py-3">Name</th><th scope="col" class="px-4 py-3">Email</th><th scope="col" class="px-4 py-3">Registered</th></tr></thead>
                <tbody class="divide-y divide-line">${attendees.map((a) => `<tr><td class="px-4 py-3 font-semibold">${Ui.esc(a.full_name)}</td><td class="px-4 py-3 text-muted">${Ui.esc(a.email)}</td><td class="px-4 py-3 text-muted">${Ui.esc(Ui.fmtDateTime(a.created_at))}</td></tr>`).join('')}</tbody></table></div>`;
        }
        return `<section class="mt-12" aria-labelledby="att-h"><h2 id="att-h" class="text-2xl font-extrabold">Registered attendees${attendees ? ` <span class="text-muted">(${attendees.length})</span>` : ''}</h2>${body}</section>`;
    }

    /* ---------- main render ---------- */
    function render() {
        const img = ev.metadata && ev.metadata.image_url;
        const mapHref = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.location || '');

        const hero = img
            ? `<img src="${Ui.esc(img)}" alt="Photo for ${Ui.esc(ev.title)}" class="detail-img h-64 w-full rounded-2xl object-cover sm:h-96">`
            : '<div class="flex h-48 w-full items-center justify-center rounded-2xl bg-navy text-brand sm:h-64" aria-hidden="true"><svg viewBox="0 0 24 24" class="h-16 w-16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg></div>';

        $root.removeAttr('aria-busy').html(`
            ${hero}
            <div class="mt-8 grid gap-10 lg:grid-cols-3">
                <div class="lg:col-span-2">
                    <p class="text-xs font-bold uppercase tracking-[0.16em] text-action">${hasEnded() ? 'Past event' : 'Upcoming event'}</p>
                    <h1 class="mt-2 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">${Ui.esc(ev.title)}</h1>
                    <h2 class="mt-8 text-xl font-extrabold">About this event</h2>
                    <p class="mt-3 whitespace-pre-line leading-relaxed text-navy/90">${Ui.esc(ev.description || 'No description has been added yet.')}</p>

                    <section class="mt-12" aria-labelledby="fb-h">
                        <h2 id="fb-h" class="text-2xl font-extrabold">${isAdmin ? 'Feedback' : 'Share your feedback'}</h2>
                        <div id="feedback-area">${feedbackHtml()}</div>
                    </section>
                </div>

                <aside class="lg:col-span-1" aria-label="Event details">
                    <div class="space-y-5 rounded-2xl border border-line p-6 shadow-card lg:sticky lg:top-24">
                        <div>
                            <p class="text-xs font-bold uppercase tracking-wide text-muted">When</p>
                            <p class="mt-1 text-sm font-semibold">${Ui.esc(range())}</p>
                        </div>
                        <div>
                            <p class="text-xs font-bold uppercase tracking-wide text-muted">Where</p>
                            <p class="mt-1 text-sm font-semibold">${Ui.esc(ev.location || 'To be announced')}</p>
                            ${ev.location ? `<a href="${mapHref}" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block text-sm font-bold text-action hover:underline">Open in maps<span class="sr-only"> (opens in a new tab)</span> ↗</a>` : ''}
                        </div>
                        <div id="actions">${actionsHtml()}</div>
                    </div>
                </aside>
            </div>
            ${attendeesHtml()}`);
    }

    /* ---------- actions ---------- */
    $root.on('click', '#retry', load);

    // Register (normal users)
    $root.on('click', '#register', async function () {
        const $b = $(this);
        Ui.setLoading($b, true, 'Registering…');
        try {
            await Api.registrations.register(ev.id);
            myReg = { status: 'registered', event_id: ev.id };
            Ui.toast('success', 'You are registered. See you there!');
        } catch (err) {
            Ui.toast('error', err.status === 409 ? 'You already have a registration for this event.' : err.message);
        }
        render();
    });

    // Cancel registration (normal users)
    $root.on('click', '#cancel-reg', async function () {
        const ok = await Ui.confirm({ title: 'Cancel your registration?', message: 'You will not be able to register for this event again.', confirmText: 'Cancel registration' });
        if (!ok) return;
        try {
            await Api.registrations.cancel(ev.id);
            myReg = { status: 'cancelled', event_id: ev.id };
            Ui.toast('success', 'Your registration was cancelled.');
        } catch (err) {
            Ui.toast('error', err.message);
        }
        render();
    });

    // Delete event (admin only)
    $root.on('click', '#delete-event', async function () {
        const ok = await Ui.confirm({ title: 'Delete this event?', message: `"${ev.title}" and its registrations and feedback will be permanently removed.`, confirmText: 'Delete event' });
        if (!ok) return;
        try {
            await Api.events.remove(ev.id);
            Auth.setFlash('success', 'Event deleted.');
            location.href = 'events.html';
        } catch (err) {
            Ui.toast('error', err.message);
        }
    });

    // Feedback (normal users): create once, then edit
    $root.on('click', '#edit-feedback', () => { editingFeedback = true; $('#feedback-area').html(feedbackHtml()); $('#comment').trigger('focus'); });
    $root.on('click', '#feedback-cancel', () => { editingFeedback = false; $('#feedback-area').html(feedbackHtml()); });

    $root.on('submit', '#feedback-form', async function (e) {
        e.preventDefault();
        const rating = Number($('input[name="rating"]:checked').val());
        const comment = $.trim($('#comment').val());
        $('#rating-error').addClass('hidden');
        Ui.formError($('#feedback-error'), '');

        if (!rating) {
            $('#rating-error').text('Choose a rating from 1 to 5.').removeClass('hidden');
            $('#rate-1').trigger('focus');
            return;
        }
        const $b = $('#feedback-submit');
        Ui.setLoading($b, true, 'Saving…');
        try {
            const res = myFeedback
                ? await Api.feedback.update(myFeedback.id, { rating, comment })
                : await Api.feedback.create({ event_id: ev.id, rating, comment });
            myFeedback = { ...(myFeedback || {}), ...res.data };
            editingFeedback = false;
            Ui.toast('success', 'Thanks for your feedback!');
            $('#feedback-area').html(feedbackHtml());
        } catch (err) {
            Ui.setLoading($b, false);
            Ui.formError($('#feedback-error'),
                err.status === 409 ? 'You have already left feedback for this event. Use "Edit your feedback" to change it.' : err.message);
        }
    });

    // Broken hero image -> navy placeholder
    document.getElementById('detail').addEventListener('error', (e) => {
        if (e.target.classList && e.target.classList.contains('detail-img')) {
            $(e.target).replaceWith('<div class="flex h-48 w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white/70" aria-hidden="true">Image unavailable</div>');
        }
    }, true);

    load();
});