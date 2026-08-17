/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: {
    // Bootstrap's reboot handles base normalization; Tailwind is utilities only.
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          300: '#5eead4',
          500: '#0f9488',
          600: '#0d7a70',
          700: '#0b6b63',
          900: '#134e4a',
        },
      },
    },
  },
  plugins: [],
};
