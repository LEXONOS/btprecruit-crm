import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#020b18',
          900: '#04111f',
          800: '#071c30',
          700: '#0a2744',
          600: '#0d3458',
          500: '#10416c',
        },
        ocean: {
          500: '#0891b2',
          400: '#22d3ee',
          300: '#67e8f9',
        },
        gold: {
          500: '#c9943a',
          400: '#e0b060',
          300: '#f0cc8a',
        },
      },
      fontFamily: {
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
        body: ['var(--font-karla)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      backgroundImage: {
        'grid-navy': "linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
}
export default config
