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
          yellow: '#F5B324',
          yellowDark: '#D99B1A',
          yellowLight: '#FEF08A',
          charcoal: '#1E1E1E',
          slate: '#0F172A',
        },
      },
    },
  },
  plugins: [],
}

