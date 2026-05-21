/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#D62828',
        background: '#121212',
        card: '#1E1E1E',
        text: '#FFFFFF',
        'secondary-text': '#A0A0A0',
        border: '#2A2A2A',
        error: '#FF4D4D',
        success: '#4CAF50',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
