/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 精致奢华配色：深色背景 + 琥珀/金色强调
        dark: {
          bg: '#0f0d17',
          surface: '#1a1625',
          elevated: '#252030',
          border: '#2d2838',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          glow: '#fbbf24',
        },
        gold: {
          light: '#f4d03f',
          base: '#d4af37',
          dark: '#b8941f',
        },
        success: {
          light: '#10b981',
          base: '#059669',
          dark: '#047857',
        },
        danger: {
          light: '#ef4444',
          base: '#dc2626',
          dark: '#b91c1c',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'], // 标题字体 - 优雅、奢华
        sans: ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'], // 正文字体 - 现代、清晰
      },
      boxShadow: {
        'glow-amber': '0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1)',
        'glow-gold': '0 0 30px rgba(212, 175, 55, 0.4), 0 0 60px rgba(212, 175, 55, 0.2)',
        'dark-lg': '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'dark-xl': '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
      backgroundImage: {
        'gradient-mesh': 'radial-gradient(at 0% 0%, rgba(251, 191, 36, 0.1) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(212, 175, 55, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(251, 191, 36, 0.05) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(212, 175, 55, 0.08) 0px, transparent 50%)',
        'noise': 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'stagger-1': 'fadeIn 0.6s ease-out 0.1s both',
        'stagger-2': 'fadeIn 0.6s ease-out 0.2s both',
        'stagger-3': 'fadeIn 0.6s ease-out 0.3s both',
        'stagger-4': 'fadeIn 0.6s ease-out 0.4s both',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(251, 191, 36, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}

