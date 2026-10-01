/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        surface: '#13131a',
        surfaceElevated: '#1c1c26',
        surfaceHigh: '#252535',
        accent: '#3d7eff',
        accentLight: '#6b9fff',
        accentDark: '#1a5cff',
        textPrimary: '#f0f0f8',
        textSecondary: '#9898b0',
        // #5a5a78 original daba 3:1 sobre el fondo; este llega a ~6:1 (AA en texto pequeño)
        textMuted: '#8e8eaa',
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336',
        border: '#2a2a3e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        glow: '0 0 20px rgba(61, 126, 255, 0.3)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(61, 126, 255, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(61, 126, 255, 0.5)' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
