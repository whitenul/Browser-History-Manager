export type EditorTheme = 'default' | 'oneDark' | 'monokai' | 'solarized' | 'dracula' | 'nord' | 'github'

export const EDITOR_THEMES: { id: EditorTheme; label: string; labelZh: string; isDark: boolean }[] = [
  { id: 'default', label: 'Default Light', labelZh: '默认亮色', isDark: false },
  { id: 'github', label: 'GitHub Light', labelZh: 'GitHub 亮色', isDark: false },
  { id: 'solarized', label: 'Solarized Light', labelZh: '日光亮色', isDark: false },
  { id: 'oneDark', label: 'One Dark', labelZh: 'One Dark 暗色', isDark: true },
  { id: 'monokai', label: 'Monokai', labelZh: 'Monokai 暗色', isDark: true },
  { id: 'dracula', label: 'Dracula', labelZh: 'Dracula 暗色', isDark: true },
  { id: 'nord', label: 'Nord', labelZh: 'Nord 暗色', isDark: true },
]
