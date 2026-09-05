import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#181410',
        surface: {
          1: '#211B15',
          2: '#2A2219',
          DEFAULT: '#211B15',
        },
        'surface-1': '#211B15',
        'surface-2': '#2A2219',
        border: '#3D3226',
        'accent-primary': '#D97A3F',
        'accent-secondary': '#B8443A',
        accent: {
          primary: '#D97A3F',
          secondary: '#B8443A',
          DEFAULT: '#D97A3F',
        },
        'darkroom-bg': '#181410',
        'darkroom-surface-1': '#211B15',
        'darkroom-surface-2': '#2A2219',
        'darkroom-border': '#3D3226',
        'darkroom-accent-primary': '#D97A3F',
        'darkroom-accent-secondary': '#B8443A',
        'darkroom-text-primary': '#F5EFE6',
        'darkroom-text-body': '#D8CDBC',
        'darkroom-text-muted': '#9C8E78',
        'darkroom-text-placeholder': '#6B5F4E',
        'darkroom-muted': '#9C8E78',
        // Text semantic mappings
        'text-primary': '#F5EFE6',
        'text-body': '#D8CDBC',
        'text-muted': '#9C8E78',
        'text-placeholder': '#6B5F4E',
        text: {
          primary: '#F5EFE6',
          body: '#D8CDBC',
          muted: '#9C8E78',
          placeholder: '#6B5F4E',
        },
        // shadcn/ui compatibility tokens
        card: {
          DEFAULT: '#211B15',
          foreground: '#F5EFE6',
        },
        popover: {
          DEFAULT: '#2A2219',
          foreground: '#F5EFE6',
        },
        primary: {
          DEFAULT: '#D97A3F',
          foreground: '#181410',
        },
        secondary: {
          DEFAULT: '#2A2219',
          foreground: '#F5EFE6',
        },
        muted: {
          DEFAULT: '#2A2219',
          foreground: '#9C8E78',
        },
        destructive: {
          DEFAULT: '#B8443A',
          foreground: '#F5EFE6',
        },
        input: '#3D3226',
        ring: '#D97A3F',
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '4px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        btn: '2px',
        pill: '9999px',
        full: '9999px',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['General Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
