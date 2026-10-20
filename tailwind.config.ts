import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Apple-inspired Design System - UI/UX Pro Max
      colors: {
        // Primitive Colors (Base Palette)
        // Apple System Colors adapted for web
        'apple-blue': '#007AFF',
        'apple-green': '#34C759',
        'apple-indigo': '#5856D6',
        'apple-orange': '#FF9F0A',
        'apple-pink': '#FF2D55',
        'apple-purple': '#AF52DE',
        'apple-red': '#FF3B30',
        'apple-teal': '#5AC8FA',
        'apple-yellow': '#FFCC00',

        // Semantic Colors (Light Mode)
        background: {
          primary: '#FFFFFF',      // Pure white - main backgrounds
          secondary: '#F2F2F7',    // System gray 6 - grouped backgrounds
          tertiary: '#E5E5EA',     // System gray 5 - separator backgrounds
          elevated: '#FFFFFF',     // Cards, modals, popovers
          'elevated-hover': '#FAFAFA',
        },
        foreground: {
          primary: '#000000',      // Primary text - 100% opacity
          secondary: '#3C3C4399',  // Secondary text - 60% opacity
          tertiary: '#3C3C434D',   // Tertiary text - 30% opacity
          inverse: '#FFFFFF',      // Text on dark backgrounds
          disabled: '#3C3C432E',   // Disabled text - 18% opacity
        },
        border: {
          default: '#C6C6C8',      // Default border - System gray 4
          light: '#E5E5EA',        // Light border - System gray 5
          focus: '#007AFF',        // Focus ring - Apple Blue
          error: '#FF3B30',        // Error border - Apple Red
        },
        brand: {
          primary: '#007AFF',      // Primary brand - Apple Blue
          'primary-hover': '#0066CC',
          'primary-pressed': '#0052A3',
          secondary: '#5856D6',    // Secondary brand - Apple Indigo
          accent: '#FF2D55',       // Accent - Apple Pink
        },
        status: {
          success: '#34C759',      // Success - Apple Green
          warning: '#FF9F0A',      // Warning - Apple Orange
          error: '#FF3B30',        // Error - Apple Red
          info: '#007AFF',         // Info - Apple Blue
        },
        // Surface variants for glass morphism
        surface: {
          glass: 'rgba(255, 255, 255, 0.8)',
          'glass-strong': 'rgba(255, 255, 255, 0.9)',
          'glass-border': 'rgba(255, 255, 255, 0.2)',
        },
      },
      // Typography Scale - Apple San Francisco inspired
      fontFamily: {
        sans: [
          '"SF Pro Text"',
        ],
        mono: [
          '"SF Mono"',
          'Monaco',
          'Inconsolata',
          '"Fira Mono"',
          '"Droid Sans Mono"',
          'monospace',
        ],
      },
      fontSize: {
        // Apple Typography Scale
        'display-large': ['57px', { lineHeight: '64px', letterSpacing: '-0.02em', fontWeight: '600' }],    // 57pt
        'display-medium': ['45px', { lineHeight: '52px', letterSpacing: '-0.01em', fontWeight: '600' }],   // 45pt
        'display-small': ['36px', { lineHeight: '44px', letterSpacing: '0', fontWeight: '600' }],          // 36pt
        'headline-large': ['32px', { lineHeight: '40px', letterSpacing: '0', fontWeight: '600' }],         // 32pt
        'headline-medium': ['28px', { lineHeight: '36px', letterSpacing: '0', fontWeight: '600' }],        // 28pt
        'headline-small': ['24px', { lineHeight: '32px', letterSpacing: '0', fontWeight: '600' }],         // 24pt
        'title-large': ['22px', { lineHeight: '28px', letterSpacing: '0', fontWeight: '600' }],            // 22pt
        'title-medium': ['20px', { lineHeight: '28px', letterSpacing: '0', fontWeight: '500' }],           // 20pt
        'title-small': ['18px', { lineHeight: '24px', letterSpacing: '0', fontWeight: '500' }],            // 18pt
        'body-large': ['17px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '400' }],       // 17pt - Body
        'body-medium': ['15px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '400' }],      // 15pt - Callout
        'body-small': ['13px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '400' }],       // 13pt - Footnote
        'label-large': ['17px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '500' }],      // 17pt - Button
        'label-medium': ['15px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '500' }],     // 15pt
        'label-small': ['13px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '500' }],      // 13pt
        'caption': ['12px', { lineHeight: '16px', letterSpacing: '0', fontWeight: '400' }],                // 12pt - Caption 1
        'caption-2': ['11px', { lineHeight: '14px', letterSpacing: '0.06em', fontWeight: '400' }],         // 11pt - Caption 2
      },
      // Spacing Scale - 4px base unit (Apple standard)
      spacing: {
        '0': '0',
        '1': '4px',     // 1 unit = 4px
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',   // Touch target minimum
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '28': '112px',
        '32': '128px',
      },
      // Border Radius - Apple style (hairline)
      borderRadius: {
        'none': '0',
        'xs': '0.5px',    // Hairline - smallest visible radius
        'sm': '0.5px',    // Hairline
        'DEFAULT': '0.5px', // Hairline - standard
        'md': '0.5px',    // Hairline
        'lg': '0.5px',    // Hairline
        'xl': '0.5px',    // Hairline
        '2xl': '0.5px',   // Hairline
        '3xl': '0.5px',   // Hairline
        'full': '9999px', // Pills, badges - keep full for circular elements
      },
      // Shadows - Apple depth system
      boxShadow: {
        // Elevation levels
        'level-0': 'none',
        'level-1': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.03)',      // Subtle - cards
        'level-2': '0 2px 4px rgba(0, 0, 0, 0.05), 0 2px 2px rgba(0, 0, 0, 0.03)',      // Raised - dropdowns
        'level-3': '0 4px 8px rgba(0, 0, 0, 0.06), 0 4px 4px rgba(0, 0, 0, 0.04)',      // Floating - modals
        'level-4': '0 8px 16px rgba(0, 0, 0, 0.08), 0 8px 8px rgba(0, 0, 0, 0.05)',     // High - sheets
        'level-5': '0 16px 32px rgba(0, 0, 0, 0.1), 0 16px 16px rgba(0, 0, 0, 0.06)',   // Maximum - full screen

        // Focus ring
        'focus': '0 0 0 3px rgba(0, 122, 255, 0.4)',
        'focus-inset': 'inset 0 0 0 2px #007AFF',

        // Glass morphism
        'glass': '0 4px 30px rgba(0, 0, 0, 0.05)',
        'glass-strong': '0 8px 32px rgba(0, 0, 0, 0.08)',
      },
      // Animation - Apple motion
      transitionDuration: {
        'instant': '0ms',
        'fast': '100ms',
        'normal': '150ms',
        'slow': '200ms',
        'slower': '300ms',
        'slowest': '500ms',
      },
      transitionTimingFunction: {
        'ease-standard': 'cubic-bezier(0.4, 0.0, 0.2, 1)',        // Standard easing
        'ease-emphasized': 'cubic-bezier(0.2, 0.0, 0, 1)',        // Emphasized entrance
        'ease-decelerated': 'cubic-bezier(0.0, 0.0, 0.2, 1)',     // Decelerated exit
        'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',       // Spring-like
        'apple-default': 'cubic-bezier(0.42, 0.0, 0.58, 1)',      // Apple default
      },
      // Blur for glass morphism
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      // Z-index scale
      zIndex: {
        'base': '0',
        'dropdown': '100',
        'sticky': '200',
        'fixed': '300',
        'modal-backdrop': '400',
        'modal': '500',
        'popover': '600',
        'tooltip': '700',
        'toast': '800',
      },
      // Screen breakpoints - Mobile first
      screens: {
        'xs': '375px',   // iPhone SE / small phones
        'sm': '640px',   // Large phones / small tablets
        'md': '768px',   // Tablets
        'lg': '1024px',  // Small laptops
        'xl': '1280px',  // Desktops
        '2xl': '1440px', // Large desktops
        '3xl': '1920px', // Extra large
      },
    },
  },
  plugins: [],
}

export default config