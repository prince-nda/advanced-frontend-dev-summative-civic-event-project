tailwind.config = {
    theme: {
        extend: {
            colors: {
                navy: { DEFAULT: '#0F1B3D', 800: '#16224A', 700: '#1E2C5C' },
                brand: '#FF3D8B',          // decorative pink / text on navy
                action: { DEFAULT: '#D7297E', dark: '#B91F69' }, // accessible pink for buttons and links
                tint: '#FDE8F1',           // light pink behind icons
                surface: '#F6F6F8',        // page background
                line: '#E4E7EE',           // borders
                muted: '#5B6478',          // secondary text (5.9:1 on white)
            },
            fontFamily: {
                sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
            },
            boxShadow: {
                glow: '0 12px 28px -10px rgba(215, 41, 126, 0.55)',
                card: '0 1px 2px rgba(15, 27, 61, 0.05), 0 8px 24px -12px rgba(15, 27, 61, 0.12)',
            },
        },
    },
};