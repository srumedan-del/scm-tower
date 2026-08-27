import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF',
        surface: '#F9F8F7',
        border: '#E6E5E3',
        text: '#2C2C2B',
        muted: '#7D7A75',
        blue: '#2783DE',
        green: '#46A171',
        orange: '#D5803B',
        red: '#E56458',
      },
    },
  },
  plugins: [],
}

export default config