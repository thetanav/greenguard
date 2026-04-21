/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0f0d',
        'bg-panel': '#111916',
        'bg-elevated': '#1a2622',
        'accent-primary': '#48dc82',
        'accent-secondary': '#2dd4bf',
        'text-primary': '#e8f5ec',
        'text-secondary': '#8ba896',
        'text-muted': '#4d665a',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
        'serif': ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}