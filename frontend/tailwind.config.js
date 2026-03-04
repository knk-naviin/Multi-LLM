/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-code)', 'monospace'],
      },
      boxShadow: {
        soft: '0 16px 52px rgba(8, 26, 54, 0.14)',
        float: '0 18px 60px rgba(8, 26, 54, 0.22)',
      },
      keyframes: {
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0.78)', opacity: '0.38' },
          '40%': { transform: 'scale(1.2)', opacity: '1' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.25s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
