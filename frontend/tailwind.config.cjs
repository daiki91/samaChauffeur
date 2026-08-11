module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Poppins"', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        // Primary — terracotta / sunset orange
        brand: {
          50: '#fff4ed',
          100: '#ffe6d5',
          200: '#ffcbaa',
          300: '#ffa873',
          400: '#ff7a3d',
          500: '#f2590e',
          600: '#d6440a',
          700: '#b23409',
          800: '#8c280d',
          900: '#71220e',
        },
        // Secondary — deep west-african green
        secondary: {
          50: '#eefbf3',
          100: '#d5f5e0',
          200: '#abe9c4',
          300: '#75d6a2',
          400: '#3fbb80',
          500: '#1f9d65',
          600: '#157d51',
          700: '#126442',
          800: '#114f37',
          900: '#0f412f',
        },
        // Accent — warm gold
        accent: {
          300: '#ffe08a',
          400: '#ffce54',
          500: '#f6b93b',
          600: '#de9a1f',
          700: '#b87814',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 15, 10, 0.04), 0 4px 16px rgba(20, 15, 10, 0.06)',
        floating: '0 8px 30px rgba(20, 15, 10, 0.12)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      backgroundImage: {
        'warm-gradient': 'linear-gradient(135deg, #f2590e 0%, #de9a1f 100%)',
        'hero-gradient': 'linear-gradient(160deg, #71220e 0%, #f2590e 55%, #f6b93b 100%)',
      },
    },
  },
  plugins: [],
}
