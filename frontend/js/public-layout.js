const PublicLayout = (() => {
    function links(active, mobile) {
        const items = [
            ['index.html', 'Home', 'home'],
            ['events.html', 'Events', 'events'],
            ['announcements.html', 'Announcements', 'announcements'],
            ['promos.html', 'Promos', 'promos'],
            ['about.html', 'About', 'about'],
            ['help.html', 'Help', 'help'],
        ];
        return items.map(([href, label, key]) => {
            const on = key === active;
            const base = mobile ? 'block rounded-lg px-3 py-3 text-base' : 'rounded-lg px-3 py-2 text-sm';
            return `<a href="${Auth.url(href)}" ${on ? 'aria-current="page"' : ''} class="${base} font-semibold ${on ? 'text-white underline decoration-brand decoration-2 underline-offset-8' : 'text-white/80 hover:text-white'}">${label}</a>`;
        }).join('');
    }

    function actions(mobile) {
        const w = mobile ? 'w-full justify-center' : '';
        if (Auth.isLoggedIn()) {
            return `<a href="${Auth.homeUrl()}" class="inline-flex ${w} items-center gap-2 rounded-xl bg-action px-5 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-action-dark">Go to dashboard →</a>`;
        }
        return `<a href="login.html" class="inline-flex ${w} rounded-xl px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10">Sign in</a>
                <a href="signup.html" class="inline-flex ${w} rounded-xl bg-action px-5 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-action-dark">Get started</a>`;
    }

    function mount(active) {
        $('#app-header').html(`
        <a href="#main" class="skip-link">Skip to main content</a>
        <header class="sticky top-0 z-40 border-b border-white/10 bg-navy text-white">
            <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                <a href="index.html" class="flex shrink-0 items-center gap-2.5" aria-label="CivicEvents home">
                    <img src="assets/civicevents-icon.svg" alt="" class="h-8 w-8 rounded-lg bg-white p-1">
                    <span class="text-lg font-bold">CivicEvents</span>
                </a>
                <nav aria-label="Main" class="ml-auto hidden items-center gap-1 lg:flex">${links(active, false)}</nav>
                <div class="hidden items-center gap-2 lg:ml-4 lg:flex">${actions(false)}</div>
                <button id="pub-menu-btn" type="button" aria-controls="pub-mobile" aria-expanded="false" class="ml-auto rounded-lg p-2 hover:bg-white/10 lg:hidden">
                    <span class="sr-only">Open menu</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
            <div id="pub-mobile" class="hidden border-t border-white/10 px-4 pb-4 pt-3 lg:hidden">
                <nav aria-label="Mobile" class="space-y-1">${links(active, true)}</nav>
                <div class="mt-3 flex flex-col gap-2">${actions(true)}</div>
            </div>
        </header>`);
        $('#app-footer').html(Layout.footerHtml());
        $('#pub-menu-btn').on('click', function () {
            const open = $('#pub-mobile').toggleClass('hidden').is(':visible');
            $(this).attr('aria-expanded', open);
        });
    }

    return { mount };
})();