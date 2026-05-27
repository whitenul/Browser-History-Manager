import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno({ dark: 'class' }),
    presetIcons({ scale: 1.2, warn: true, cdn: 'https://esm.sh/' }),
  ],
  theme: {
    colors: {
      primary: {
        50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
        400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
        800: '#3730a3', 900: '#312e81',
      },
      surface: {
        0: '#ffffff', 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
        300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569',
        700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
      },
    },
  },
  shortcuts: {
    'btn': 'inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer select-none border-none outline-none',
    'btn-primary': 'btn text-white bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)]',
    'btn-secondary': 'btn bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)]',
    'btn-ghost': 'btn bg-transparent text-[var(--btn-ghost-text)] hover:bg-[var(--btn-ghost-hover-bg)]',
    'btn-danger': 'btn text-[var(--btn-danger-text)] bg-[var(--btn-danger-bg)] border border-[var(--btn-danger-border)] hover:bg-[var(--btn-danger-hover-bg)] hover:text-white',
    'btn-icon': 'btn w-7 h-7 p-0 rounded-md',
    'input': 'w-full px-3 py-1.5 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--input-focus-border)] focus:ring-2 focus:ring-[var(--input-focus-ring)]',
    'card': 'rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm',
    'badge': 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
    'divider': 'w-full h-px bg-[var(--color-border)]',
  },
})
