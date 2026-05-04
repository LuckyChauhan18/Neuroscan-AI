/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6fcff',
          100: '#b3f5ff',
          200: '#80eeff',
          300: '#4de7ff',
          400: '#1ae0ff',
          500: '#00D4FF',
          600: '#00B4D8',
          700: '#0077B6',
          800: '#005f92',
          900: '#003d5c',
        },
        dark: {
          50: '#2a2d3a',
          100: '#1e2030',
          200: '#181a28',
          300: '#131520',
          400: '#0e1018',
          500: '#0a0c10',
          600: '#060810',
          700: '#04060c',
          800: '#020408',
          900: '#000204',
        },
        accent: {
          cyan: '#00D4FF',
          teal: '#00B4D8',
          green: '#00E676',
          red: '#FF1744',
          purple: '#7C4DFF',
          orange: '#FF9100',
        }
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'neural-pattern': 'linear-gradient(135deg, rgba(0, 212, 255, 0.03) 0%, rgba(0, 180, 216, 0.03) 50%, rgba(0, 119, 182, 0.03) 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.3)',
        'glow-green': '0 0 20px rgba(0, 230, 118, 0.3)',
        'glow-red': '0 0 20px rgba(255, 23, 68, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
