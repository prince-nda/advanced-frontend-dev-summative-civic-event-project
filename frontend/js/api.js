const Api = (() => {
    const base = CONFIG.API_BASE_URL + CONFIG.API_PREFIX;

    function normaliseError(xhr) {
        const body = xhr.responseJSON || {};
        let message = body.message;

        if (xhr.status === 0) {
            message = 'Cannot reach the server. Check that the backend is running, then try again.';
        } else if (Array.isArray(body.errors) && body.errors.length) {
            message = body.errors.map((e) => e.message).join(' ');
        } else if (xhr.status === 403) {
            message = message || 'You do not have permission to do that. Contact an administrator if you think this is a mistake.';
        } else if (!message) {
            message = xhr.status >= 500 ? 'Something went wrong on the server. Please try again.' : 'Request failed.';
        }
        return { status: xhr.status, message, errors: body.errors || [], network: xhr.status === 0 };
    }

    /**
     * @param {Object}  o
     * @param {string}  o.method  GET | POST | PUT | PATCH | DELETE
     * @param {string}  o.path    e.g. '/events' (the /api prefix is added for you)
     * @param {Object|FormData} [o.data]  plain object -> JSON body (or query string for GET); FormData -> multipart upload
     * @param {boolean} [o.auth=true]  false for login/signup
     * @param {function} [o.onProgress]  called with 0..1 while a file uploads
     */
    function request({ method = 'GET', path, data, auth = true, onProgress }) {
        return new Promise((resolve, reject) => {
            const headers = {};

            if (auth) {
                // Expired token? Don't even send the request.
                if (!Auth.isLoggedIn()) {
                    const hadToken = !!Auth.getToken();
                    Auth.logout(hadToken ? 'Your session has expired. Please log in again.' : 'Please log in to continue.',
                        hadToken ? 'error' : 'info');
                    return reject({ status: 401, message: 'Not signed in', errors: [] });
                }
                headers.Authorization = 'Bearer ' + Auth.getToken();
            }

            const opts = { url: base + path, method, headers, dataType: 'json' };

            if (data instanceof FormData) {
                // Multipart upload: let the browser set the boundary header
                opts.data = data;
                opts.processData = false;
                opts.contentType = false;
            } else if (data && method === 'GET') {
                opts.data = data; // query string
            } else if (data) {
                opts.data = JSON.stringify(data);
                opts.contentType = 'application/json';
            }

            if (onProgress) {
                // Report upload progress (used by the file upload forms)
                opts.xhr = function () {
                    const xhr = $.ajaxSettings.xhr();
                    if (xhr.upload) {
                        xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); });
                    }
                    return xhr;
                };
            }

            $.ajax(opts)
                .done((body) => resolve(body))
                .fail((xhr) => {
                    const err = normaliseError(xhr);
                    // 401 on a protected call = bad/expired token. (A 401 from /auth/login just means wrong password.)
                    if (xhr.status === 401 && auth) {
                        Auth.logout('Your session has expired. Please log in again.', 'error');
                    }
                    reject(err);
                });
        });
    }

    const get = (path, data) => request({ method: 'GET', path, data });
    const post = (path, data) => request({ method: 'POST', path, data });
    const put = (path, data) => request({ method: 'PUT', path, data });
    const patch = (path, data) => request({ method: 'PATCH', path, data });
    const del = (path) => request({ method: 'DELETE', path });

    /* ---------- endpoint map (matches the provided backend routes) ---------- */
    return {
        request,

        auth: {
            // NEVER send a `role` field: the backend would accept it. New accounts are always normal users.
            signup: (d) => request({ method: 'POST', path: '/auth/signup', data: d, auth: false }),
            login: (d) => request({ method: 'POST', path: '/auth/login', data: d, auth: false }),
        },

        users: {                                   // list/get/enable/disable are admin-only on the backend
            list: (page = 1, limit = 20) => get('/users', { page, limit }),
            get: (id) => get(`/users/${id}`),
            enable: (id) => patch(`/users/${id}/enable`),
            disable: (id) => patch(`/users/${id}/disable`),
            me: () => get('/users/profile/me'),
            updateMe: (d) => patch('/users/profile/me', d), // only full_name and email
        },

        events: {                                  // create/update/remove are admin-only; FormData fields: title, description, location, starts_at, ends_at, image
            list: () => get('/events'),            // no server-side search, filters or pagination: do those in the browser
            get: (id) => get(`/events/${id}`),
            create: (formData, onProgress) => request({ method: 'POST', path: '/events', data: formData, onProgress }),
            update: (id, formData, onProgress) => request({ method: 'PUT', path: `/events/${id}`, data: formData, onProgress }),
            remove: (id) => del(`/events/${id}`),
        },

        registrations: {
            register: (event_id) => post('/event-registrations/register', { event_id }),
            cancel: (event_id) => post('/event-registrations/cancel', { event_id }),
            mine: () => get('/event-registrations/my-registrations'),
            attendees: (event_id) => get(`/event-registrations/event/${event_id}/attendees`), // admin only
        },

        feedback: {
            create: (d) => post('/event-feedback', d),          // { event_id, rating, comment }
            update: (id, d) => put(`/event-feedback/${id}`, d), // { rating, comment }
            mine: () => get('/event-feedback/my-feedback'),
            forEvent: (event_id) => get(`/event-feedback/event/${event_id}`), // admin only
        },

        announcements: {                           // FormData: title, audio, published
            list: () => get('/announcements'),     // returns unpublished too: filter published in the browser for normal users
            get: (id) => get(`/announcements/${id}`),
            create: (formData, onProgress) => request({ method: 'POST', path: '/announcements', data: formData, onProgress }),
            update: (id, formData, onProgress) => request({ method: 'PUT', path: `/announcements/${id}`, data: formData, onProgress }),
            publish: (id) => patch(`/announcements/${id}/publish`),
            unpublish: (id) => patch(`/announcements/${id}/unpublish`),
            remove: (id) => del(`/announcements/${id}`),
        },

        promos: {                                  // FormData: title, description, caption_text, video
            list: (page = 1, limit = 20) => get('/promos', { page, limit }), // { data, pagination }
            get: (id) => get(`/promos/${id}`),
            create: (formData, onProgress) => request({ method: 'POST', path: '/promos', data: formData, onProgress }),
            update: (id, formData, onProgress) => request({ method: 'PUT', path: `/promos/${id}`, data: formData, onProgress }),
            publish: (id) => patch(`/promos/${id}/publish`),
            unpublish: (id) => patch(`/promos/${id}/unpublish`),
            remove: (id) => del(`/promos/${id}`),
        },

        notifications: {
            list: () => get('/notifications'),
            get: (id) => get(`/notifications/${id}`),
            remove: (id) => del(`/notifications/${id}`), // admin only
        },

        dashboard: {
            admin: () => get('/dashboard/admin'),  // admin only
            me: () => get('/dashboard/me'),
        },
    };
})();

/**
 * File validation helper, used BEFORE uploading so the user gets a clear message.
 * type: 'image' | 'video' | 'audio'. Returns an error string, or '' if the file is fine.
 */
function validateUpload(file, type) {
    const rule = CONFIG.UPLOAD_RULES[type];
    if (!file || !rule) return '';
    const ext = file.name.split('.').pop().toLowerCase();
    if (!rule.exts.includes(ext)) return `Unsupported file type. Allowed: ${rule.exts.join(', ')}.`;
    if (file.size > rule.maxMB * 1024 * 1024) return `File is too large. Maximum size is ${rule.maxMB} MB.`;
    return '';
}