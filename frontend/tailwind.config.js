/** MumbaiCare design tokens */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#081A2E', 900: '#0C2340', 800: '#12325A', 700: '#1B4476' },
        harbor: { 600: '#1D5FA8', 500: '#2F74C0', 100: '#E4EEF9' },
        tide: { 700: '#0A6E68', 600: '#0E8C83', 500: '#14A89C', 100: '#DDF3F0' },
        ink: { 900: '#15202B', 700: '#3A4A5C', 500: '#66768A', 300: '#B7C2CE', 200: '#D8DFE6', 100: '#EDF1F5', 50: '#F6F8FA' },
        alert: { 600: '#C0392B', 100: '#FBE7E4' }, amber: { 600: '#B7791F', 100: '#FCF1DC' },
      },
      fontFamily: { sans: ['"Public Sans"', 'system-ui', 'sans-serif'], display: ['"Fraunces"', 'Georgia', 'serif'] },
    },
  },
};
