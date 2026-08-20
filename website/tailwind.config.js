import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
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
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        'surface-card': 'hsl(var(--card))',
        'surface-alt': '#f4f2f7',
        'ink-secondary': 'hsl(var(--muted-foreground))',
        'ink-muted': 'hsl(var(--muted-foreground))',
        'ink-light': '#1a1033',
        'ink-sec-light': '#5a5068',
        'accent-light': 'rgba(118, 56, 250, 0.1)',
        'accent-hover': 'hsl(259, 95%, 50%)',
        surface: 'hsl(var(--background))',
        'surface-navy': 'hsl(var(--background))',
        ink: 'hsl(var(--foreground))',
        'border-light': '#e0dce6',
        'caution-border': '#e6c84a',
        'caution-bg': '#fff8e6',
        'caution-text': '#a97b00',
        'roadmap-border': 'rgba(118, 56, 250, 0.3)',
        'roadmap-bg': 'rgba(118, 56, 250, 0.08)',
        'success-bg': 'rgba(110, 219, 110, 0.08)',
        'success-border': 'rgba(110, 219, 110, 0.3)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        body: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif'
        ],
        heading: [
          'Inter Tight',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'monospace'
        ]
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        marquee: {
          from: {
            transform: 'translateX(0)'
          },
          to: {
            transform: 'translateX(calc(-100% - 2rem))'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        marquee: 'marquee var(--duration) linear infinite'
      },
      backgroundImage: {
        'hero-glow': 'radial-gradient(circle at 50% 0%, rgba(118, 56, 250, 0.15) 0%, transparent 70%)'
      }
    }
  },
  plugins: [tailwindcssAnimate],
}
