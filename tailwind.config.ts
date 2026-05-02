import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0a0a',
          raised: '#111111',
          overlay: '#1a1a1a',
          border: '#222222',
          muted: '#2a2a2a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
