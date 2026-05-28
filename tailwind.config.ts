import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./src/**/*.{js,ts,jsx,tsx,mdx}",
		"./apps/client/src/**/*.{js,ts,jsx,tsx,mdx}",
		"./packages/**/src/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				'midnight-void': 'var(--color-midnight-void)',
				'deep-space': 'var(--color-deep-space)',
				'polar-white': 'var(--color-polar-white)',
				'absolute-zero': 'var(--color-absolute-zero)',
				'ash-gray': 'var(--color-ash-gray)',
				'dark-carbon': 'var(--color-dark-carbon)',
				'hyper-slate': 'var(--color-slate)',
				'amber-glow': 'var(--color-amber-glow)',
				'neon-green': 'var(--color-neon-green)',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			fontFamily: {
				aeonik: 'var(--font-sans)',
				input: 'var(--font-mono)',
				sans: 'var(--font-sans)',
				mono: 'var(--font-mono)'
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
				shimmer: {
					'0%': { backgroundPosition: '0% 0' },
					'100%': { backgroundPosition: '200% 0' }
				},
				'typing-bounce': {
					'0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
					'30%': { transform: 'translateY(-4px)', opacity: '1' }
				},
				'agent-bounce': {
					'0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
					'40%': { transform: 'scale(1)', opacity: '1' }
				},
				'orb-morph': {
					'0%, 100%': { borderRadius: '58% 42% 40% 60% / 55% 45% 55% 45%' },
					'33%': { borderRadius: '42% 58% 62% 38% / 45% 60% 40% 55%' },
					'66%': { borderRadius: '50% 50% 38% 62% / 60% 40% 60% 40%' }
				},
				'orb-breathe': {
					'0%, 100%': { transform: 'scale(0.92)', opacity: '0.85' },
					'50%': { transform: 'scale(1.02)', opacity: '1' }
				},
				'agent-blob-float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-1.5px)' }
				},
				'agent-blob-drift': {
					'0%, 100%': { transform: 'rotate(-3deg)' },
					'50%': { transform: 'rotate(3deg)' }
				},
				'agent-ribbon-flow': {
					'0%': { strokeDashoffset: '0' },
					'100%': { strokeDashoffset: '-44' }
				},
				'agent-ribbon-ghost-flow': {
					'0%': { strokeDashoffset: '0' },
					'100%': { strokeDashoffset: '44' }
				},
				'agent-ribbon-ghost': {
					'0%, 100%': { opacity: '0.22' },
					'50%': { opacity: '0.48' }
				},
				'agent-node-a': {
					'0%, 100%': { opacity: '0.65' },
					'50%': { opacity: '1' }
				},
				'agent-node-b': {
					'0%, 100%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(1.2)' }
				},
				'agent-node-c': {
					'0%, 100%': { opacity: '0.55' },
					'50%': { opacity: '0.95' }
				},
				'agent-blob-think': {
					'0%, 100%': { transform: 'translateY(0px) scale(1)' },
					'50%': { transform: 'translateY(-2px) scale(1.06)' }
				},
				'agent-blob-listen': {
					'0%, 100%': { transform: 'translateY(0px) scaleX(1)' },
					'50%': { transform: 'translateY(1px) scaleX(1.05)' }
				},
				twinkle: {
					'0%, 100%': { transform: 'scale(0) rotate(0deg)', opacity: '0' },
					'40%': { transform: 'scale(1) rotate(90deg)', opacity: '1' },
					'70%': { transform: 'scale(0.7) rotate(160deg)', opacity: '0.7' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				shimmer: 'shimmer 3s ease-in-out infinite',
				'agent-bounce': 'agent-bounce 1.4s ease-in-out infinite both',
				'orb-morph': 'orb-morph 6s ease-in-out infinite',
				'orb-breathe': 'orb-breathe 3s ease-in-out infinite',
				'agent-blob-float': 'agent-blob-float var(--blob-speed, 6s) ease-in-out infinite',
				'agent-blob-drift': 'agent-blob-drift calc(var(--blob-speed, 6s) * 1.4) ease-in-out infinite',
				'agent-ribbon-flow': 'agent-ribbon-flow var(--ribbon-flow, 2.8s) linear infinite',
				'agent-ribbon-ghost-flow': 'agent-ribbon-ghost-flow var(--ribbon-flow, 2.8s) linear infinite',
				'agent-ribbon-ghost': 'agent-ribbon-ghost var(--blob-speed, 6s) ease-in-out infinite',
				'agent-node-a': 'agent-node-a var(--ribbon-flow, 2.8s) ease-in-out infinite',
				'agent-node-b': 'agent-node-b var(--ribbon-flow, 2.8s) ease-in-out infinite',
				'agent-node-c': 'agent-node-c calc(var(--ribbon-flow, 2.8s) * 1.3) ease-in-out infinite',
				'agent-blob-think': 'agent-blob-think var(--blob-speed, 1.2s) ease-in-out infinite',
				'agent-blob-listen': 'agent-blob-listen var(--blob-speed, 3s) ease-in-out infinite',
				twinkle: 'twinkle 1.8s ease-in-out infinite'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
