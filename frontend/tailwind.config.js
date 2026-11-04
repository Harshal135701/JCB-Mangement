/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jcb: {
          yellow: '#F9B101',       // Official Classic JCB Yellow (Pantone 7549 C / RAL 1007)
          yellowDark: '#E09E00',
          yellowLight: '#FEF08A',
          black: '#000000',        // Official JCB Black (Chassis & Booms / Pantone Black 6 C)
          charcoal: '#1A1A1A',     // Deep Industrial Contrast
          cardBg: '#FFFFFF',
          border: '#E5E7EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
