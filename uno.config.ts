import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno({
      dark: 'class',
    }),
    presetIcons({
      scale: 1.2,
      warn: true,
      cdn: 'https://esm.sh/',
    }),
  ],
  transformers: [],
  theme: {
    colors: {
      primary: {
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#6366f1',
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
      },
      surface: {
        0: '#ffffff',
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
        950: '#020617',
      },
    },
  },
  shortcuts: {
    'btn': 'inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer select-none border-none outline-none',
    'btn-primary': 'btn bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
    'btn-secondary': 'btn bg-surface-100 text-surface-700 hover:bg-surface-200 active:bg-surface-300',
    'btn-ghost': 'btn bg-transparent text-surface-600 hover:bg-surface-100 active:bg-surface-200',
    'btn-danger': 'btn bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    'btn-icon': 'btn w-7 h-7 p-0 rounded-md',
    'input': 'w-full px-3 py-1.5 rounded-md border border-surface-300 bg-white text-surface-900 text-sm outline-none transition-all duration-150 placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
    'card': 'rounded-lg border border-surface-200 bg-white p-4 shadow-sm',
    'badge': 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
    'divider': 'w-full h-px bg-surface-200',
  },
})
