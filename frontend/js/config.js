const CONFIG = {
    // Where the provided backend runs (see README: `npm run dev` in /backend)
    API_BASE_URL: 'http://localhost:4000',
    API_PREFIX: '/api',

    // Keys used in sessionStorage / localStorage
    TOKEN_KEY: 'civic_token',
    USER_KEY: 'civic_user',
    FLASH_KEY: 'civic_flash',      // one-shot message shown after a redirect
    READ_KEY_PREFIX: 'civic_read_', // per-user list of read notification ids

    // Upload limits enforced by the backend (checked here BEFORE uploading)
    UPLOAD_RULES: {
        image: { maxMB: 2, exts: ['jpg', 'jpeg', 'png', 'gif'] },
        video: { maxMB: 8, exts: ['mp4', 'mov', 'avi', 'mkv'] },
        audio: { maxMB: 5, exts: ['mp3', 'wav', 'm4a', 'ogg'] },
    },

    // Password policy (mirrors the backend regex)
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/,
};