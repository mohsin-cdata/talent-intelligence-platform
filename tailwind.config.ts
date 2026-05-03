import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      // CData Brand Colors (Phase 14f refresh)
      colors: {
        // Primary brand colors
        cdata: {
          yellow: '#FFEB00',        // Agility - Primary accent
          black: '#1A1A1A',         // Depth - Text, headers
          white: '#FFFFFF',         // Clarity - Backgrounds
          gray: '#9CA3AF',          // Balance - Secondary
          navy: '#1E3A5F',          // Resolve - Links, secondary accent
          'yellow-hover': '#E6D400', // Hover state
          'navy-light': '#2A4A6F',  // Lighter navy
        },
        // Surface tokens (Phase 14f)
        surface: {
          DEFAULT: '#FAFAFA',       // Main background
          raised: '#FFFFFF',        // Cards, panels
          sunken: '#F3F4F6',        // Inset areas
          overlay: 'rgba(0,0,0,0.5)', // Modal overlays
        },
        // Border tokens
        'border-subtle': '#E5E7EB',
        'border-default': '#D1D5DB',
        'border-strong': '#9CA3AF',
        // Semantic colors mapped to CData brand
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#FFEB00',       // CData Yellow
          foreground: '#1A1A1A',    // Dark text on yellow
        },
        secondary: {
          DEFAULT: '#1E3A5F',       // CData Navy
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: '#FFEB00',
          foreground: '#1A1A1A',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      // CData Typography
      fontFamily: {
        grafier: ['Grafier', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Consolas', 'monospace'],
      },
      // Softer shadows (Phase 14f)
      boxShadow: {
        'soft-sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'soft': '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'soft-md': '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'soft-lg': '0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
        'panel': '0 1px 3px rgba(0,0,0,0.05)',
      },
      fontSize: {
        'heading-xl': ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'heading-lg': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        'heading-md': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-sm': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
