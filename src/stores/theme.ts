import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type RadiusStyle = 'none' | 'small' | 'medium' | 'large'
export type FontSize = 'small' | 'medium' | 'large'
export type HeaderStyle = 'solid' | 'gradient' | 'glass' | 'minimal'
export type CardStyle = 'flat' | 'bordered' | 'shadowed' | 'elevated'
export type FontFamily = 'system' | 'serif' | 'mono' | 'rounded'
export type AnimationSpeed = 'off' | 'slow' | 'normal' | 'fast'
export type ScrollbarStyle = 'thin' | 'default' | 'hidden'
export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'diagonal' | 'noise'

export interface PresetTheme {
  id: string
  name: string
  icon: string
  light: Record<string, string>
  dark: Record<string, string>
}

export const PRESET_THEMES: PresetTheme[] = [
  { id: 'indigo', name: 'theme.presets.indigo', icon: '💎', light: { '--primary-color': '#4f46e5', '--app-header-bg': '#4f46e5', '--app-header-text': '#ffffff', '--primary-light': 'rgba(79,70,229,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#818cf8', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(129,140,248,0.12)', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59' } },
  { id: 'emerald', name: 'theme.presets.emerald', icon: '🌿', light: { '--primary-color': '#059669', '--app-header-bg': '#059669', '--app-header-text': '#ffffff', '--primary-light': 'rgba(5,150,105,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#34d399', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(52,211,153,0.12)', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59' } },
  { id: 'rose', name: 'theme.presets.rose', icon: '🌹', light: { '--primary-color': '#e11d48', '--app-header-bg': '#e11d48', '--app-header-text': '#ffffff', '--primary-light': 'rgba(225,29,72,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#fb7185', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(251,113,133,0.12)', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59' } },
  { id: 'amber', name: 'theme.presets.amber', icon: '🔥', light: { '--primary-color': '#d97706', '--app-header-bg': '#d97706', '--app-header-text': '#ffffff', '--primary-light': 'rgba(217,119,6,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#fbbf24', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(251,191,36,0.12)', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59' } },
  { id: 'cyan', name: 'theme.presets.cyan', icon: '🌊', light: { '--primary-color': '#0891b2', '--app-header-bg': '#0891b2', '--app-header-text': '#ffffff', '--primary-light': 'rgba(8,145,178,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#22d3ee', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(34,211,238,0.12)', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59' } },
  { id: 'violet', name: 'theme.presets.violet', icon: '🔮', light: { '--primary-color': '#7c3aed', '--app-header-bg': '#7c3aed', '--app-header-text': '#ffffff', '--primary-light': 'rgba(124,58,237,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#a78bfa', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(167,139,250,0.12)', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59' } },
  { id: 'slate', name: 'theme.presets.slate', icon: '🪨', light: { '--primary-color': '#475569', '--app-header-bg': '#334155', '--app-header-text': '#ffffff', '--primary-light': 'rgba(71,85,105,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#94a3b8', '--app-header-bg': '#0f172a', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(148,163,184,0.12)', '--app-surface': '#0f172a', '--app-surface-rgb': '15,23,42' } },
  { id: 'pink', name: 'theme.presets.pink', icon: '🌸', light: { '--primary-color': '#db2777', '--app-header-bg': '#db2777', '--app-header-text': '#ffffff', '--primary-light': 'rgba(219,39,119,0.08)', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255' }, dark: { '--primary-color': '#f472b6', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--primary-light': 'rgba(244,114,182,0.12)', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59' } },
]

export interface GradientTheme { name: string; gradient: string; primary: string; surface: string; surfaceRgb: string }

export const GRADIENT_THEMES: GradientTheme[] = [
  { name: 'theme.gradients.ocean', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', primary: '#667eea', surface: '#1e293b', surfaceRgb: '30,41,59' },
  { name: 'theme.gradients.sunset', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', primary: '#f5576c', surface: '#1e293b', surfaceRgb: '30,41,59' },
  { name: 'theme.gradients.forest', gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', primary: '#11998e', surface: '#1e293b', surfaceRgb: '30,41,59' },
  { name: 'theme.gradients.night', gradient: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)', primary: '#4ca1af', surface: '#0f172a', surfaceRgb: '15,23,42' },
  { name: 'theme.gradients.flame', gradient: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)', primary: '#f12711', surface: '#1e293b', surfaceRgb: '30,41,59' },
  { name: 'theme.gradients.aurora', gradient: 'linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)', primary: '#00c9ff', surface: '#1e293b', surfaceRgb: '30,41,59' },
  { name: 'theme.gradients.lavender', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', primary: '#a18cd1', surface: '#1e293b', surfaceRgb: '30,41,59' },
  { name: 'theme.gradients.glacier', gradient: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)', primary: '#5b86e5', surface: '#ffffff', surfaceRgb: '255,255,255' },
  { name: 'theme.gradients.desert', gradient: 'linear-gradient(135deg, #c2956a 0%, #e0c097 100%)', primary: '#c2956a', surface: '#f8fafc', surfaceRgb: '248,250,252' },
]

const LIGHT_VARS = { '--app-bg': '#f8fafc', '--app-surface': '#ffffff', '--app-surface-rgb': '255,255,255', '--app-header-bg': '#4f46e5', '--app-header-text': '#ffffff', '--text-primary': '#0f172a', '--text-secondary': '#334155', '--text-muted': '#64748b', '--border-color': '#e2e8f0', '--primary-color': '#4f46e5', '--primary-light': 'rgba(79,70,229,0.08)' }
const DARK_VARS = { '--app-bg': '#0f172a', '--app-surface': '#1e293b', '--app-surface-rgb': '30,41,59', '--app-header-bg': '#1e293b', '--app-header-text': '#f1f5f9', '--text-primary': '#f1f5f9', '--text-secondary': '#94a3b8', '--text-muted': '#64748b', '--border-color': '#334155', '--primary-color': '#818cf8', '--primary-light': 'rgba(129,140,248,0.12)' }

const RADIUS_MAP: Record<RadiusStyle, { sm: string; md: string; lg: string; xl: string }> = {
  none: { sm: '0px', md: '0px', lg: '0px', xl: '0px' },
  small: { sm: '2px', md: '4px', lg: '6px', xl: '8px' },
  medium: { sm: '4px', md: '6px', lg: '10px', xl: '14px' },
  large: { sm: '6px', md: '10px', lg: '16px', xl: '20px' },
}

const FONT_SIZE_MAP: Record<FontSize, string> = { small: '12px', medium: '13px', large: '14px' }
const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', 'Noto Serif SC', serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  rounded: "'Nunito', 'Quicksand', 'M PLUS Rounded 1c', system-ui, sans-serif",
}

const ANIM_SPEED_MAP: Record<AnimationSpeed, string> = {
  off: '0ms',
  slow: '250ms',
  normal: '120ms',
  fast: '60ms',
}

export interface ThemeConfig {
  mode: ThemeMode
  activePreset: string
  activeGradient: string | null
  customColors: { primary: string; bg: string; text: string; surfaceRgb: string } | null
  accentColor: string | null
  radiusStyle: RadiusStyle
  fontSize: FontSize
  fontFamily: FontFamily
  headerStyle: HeaderStyle
  cardStyle: CardStyle
  animationSpeed: AnimationSpeed
  scrollbarStyle: ScrollbarStyle
  backgroundPattern: BackgroundPattern
  compactMode: boolean
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('auto')
  const activeGradient = ref<string | null>(null)
  const customColors = ref<{ primary: string; bg: string; text: string; surfaceRgb: string } | null>(null)
  const activePreset = ref<string>('indigo')
  const showThemeModal = ref(false)
  const isDark = ref(false)
  const radiusStyle = ref<RadiusStyle>('medium')
  const fontSize = ref<FontSize>('medium')
  const fontFamily = ref<FontFamily>('system')
  const headerStyle = ref<HeaderStyle>('solid')
  const cardStyle = ref<CardStyle>('bordered')
  const animationSpeed = ref<AnimationSpeed>('normal')
  const scrollbarStyle = ref<ScrollbarStyle>('thin')
  const backgroundPattern = ref<BackgroundPattern>('none')
  const accentColor = ref<string | null>(null)
  const compactMode = ref(false)

  function applyTheme() {
    const html = document.documentElement
    let dark = false
    if (mode.value === 'auto') { dark = window.matchMedia('(prefers-color-scheme: dark)').matches } else { dark = mode.value === 'dark' }
    isDark.value = dark
    html.classList.toggle('dark', dark)

    const baseVars = dark ? { ...DARK_VARS } : { ...LIGHT_VARS }
    Object.entries(baseVars).forEach(([key, val]) => { html.style.setProperty(key, val) })

    if (activePreset.value && !activeGradient.value && !customColors.value) {
      const preset = PRESET_THEMES.find(p => p.id === activePreset.value)
      if (preset) { const v = dark ? preset.dark : preset.light; Object.entries(v).forEach(([k, val]) => { html.style.setProperty(k, val) }) }
    }

    if (activeGradient.value) {
      html.style.setProperty('--gradient-bg', activeGradient.value)
      html.style.setProperty('--app-header-bg', activeGradient.value)
      const gt = GRADIENT_THEMES.find(g => g.gradient === activeGradient.value)
      if (gt) {
        html.style.setProperty('--primary-color', gt.primary)
        html.style.setProperty('--app-surface', gt.surface)
        html.style.setProperty('--app-surface-rgb', gt.surfaceRgb)
        const r = parseInt(gt.primary.slice(1, 3), 16), g = parseInt(gt.primary.slice(3, 5), 16), b = parseInt(gt.primary.slice(5, 7), 16)
        html.style.setProperty('--primary-light', `rgba(${r},${g},${b},0.08)`)
      }
    } else { html.style.removeProperty('--gradient-bg') }

    if (customColors.value) {
      html.style.setProperty('--primary-color', customColors.value.primary)
      html.style.setProperty('--app-bg', customColors.value.bg)
      html.style.setProperty('--app-surface', customColors.value.bg)
      html.style.setProperty('--app-surface-rgb', customColors.value.surfaceRgb)
      html.style.setProperty('--text-primary', customColors.value.text)
      const r = parseInt(customColors.value.primary.slice(1, 3), 16), g = parseInt(customColors.value.primary.slice(3, 5), 16), b = parseInt(customColors.value.primary.slice(5, 7), 16)
      html.style.setProperty('--primary-light', `rgba(${r},${g},${b},0.08)`)
      html.style.setProperty('--app-header-bg', customColors.value.primary)
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      html.style.setProperty('--app-header-text', lum > 0.5 ? '#000000' : '#ffffff')
    }

    if (accentColor.value) {
      html.style.setProperty('--accent-color', accentColor.value)
      const r = parseInt(accentColor.value.slice(1, 3), 16), g = parseInt(accentColor.value.slice(3, 5), 16), b = parseInt(accentColor.value.slice(5, 7), 16)
      html.style.setProperty('--accent-light', `rgba(${r},${g},${b},0.12)`)
    } else {
      html.style.removeProperty('--accent-color')
      html.style.removeProperty('--accent-light')
    }

    const radii = RADIUS_MAP[radiusStyle.value]
    html.style.setProperty('--radius-sm', radii.sm); html.style.setProperty('--radius-md', radii.md)
    html.style.setProperty('--radius-lg', radii.lg); html.style.setProperty('--radius-xl', radii.xl)

    html.style.fontSize = FONT_SIZE_MAP[fontSize.value]
    html.style.fontFamily = FONT_FAMILY_MAP[fontFamily.value]

    const speed = ANIM_SPEED_MAP[animationSpeed.value]
    html.style.setProperty('--transition-fast', speed === '0ms' ? '0ms' : speed)
    html.style.setProperty('--transition-normal', speed === '0ms' ? '0ms' : `${Math.round(parseInt(speed) * 1.6)}ms`)
    html.style.setProperty('--transition-slow', speed === '0ms' ? '0ms' : `${parseInt(speed) * 2.5}ms`)
    html.classList.toggle('no-animations', animationSpeed.value === 'off')

    html.classList.toggle('compact', compactMode.value)
    if (compactMode.value) {
      html.style.setProperty('--item-height', '40px'); html.style.setProperty('--group-header-height', '28px')
      html.style.setProperty('--header-height', '40px'); html.style.setProperty('--tabs-height', '34px')
    } else {
      html.style.removeProperty('--item-height'); html.style.removeProperty('--group-header-height')
      html.style.removeProperty('--header-height'); html.style.removeProperty('--tabs-height')
    }

    html.dataset.headerStyle = headerStyle.value
    html.dataset.cardStyle = cardStyle.value
    html.dataset.scrollbarStyle = scrollbarStyle.value
    html.dataset.bgPattern = backgroundPattern.value
  }

  async function loadTheme() {
    try {
      const result = await chrome.storage.local.get([
        'themeMode', 'activeGradient', 'customColors', 'activePreset',
        'radiusStyle', 'fontSize', 'fontFamily', 'headerStyle', 'cardStyle',
        'animationSpeed', 'scrollbarStyle', 'backgroundPattern', 'accentColor',
        'compactMode',
      ])
      if (result.themeMode) mode.value = result.themeMode as ThemeMode
      if (result.activeGradient) activeGradient.value = result.activeGradient as string
      if (result.customColors) {
        const cc = result.customColors as { primary: string; bg: string; text: string }
        const bgRgb = `${parseInt(cc.bg.slice(1, 3), 16)},${parseInt(cc.bg.slice(3, 5), 16)},${parseInt(cc.bg.slice(5, 7), 16)}`
        customColors.value = { ...cc, surfaceRgb: bgRgb }
      }
      if (result.activePreset) activePreset.value = result.activePreset as string
      if (result.radiusStyle) radiusStyle.value = result.radiusStyle as RadiusStyle
      if (result.fontSize) fontSize.value = result.fontSize as FontSize
      if (result.fontFamily) fontFamily.value = result.fontFamily as FontFamily
      if (result.headerStyle) headerStyle.value = result.headerStyle as HeaderStyle
      if (result.cardStyle) cardStyle.value = result.cardStyle as CardStyle
      if (result.animationSpeed) animationSpeed.value = result.animationSpeed as AnimationSpeed
      if (result.scrollbarStyle) scrollbarStyle.value = result.scrollbarStyle as ScrollbarStyle
      if (result.backgroundPattern) backgroundPattern.value = result.backgroundPattern as BackgroundPattern
      if (result.accentColor) accentColor.value = result.accentColor as string
      if (result.compactMode !== undefined) compactMode.value = result.compactMode as boolean
    } catch { /* ignore */ }
    applyTheme()
  }

  async function saveTheme() {
    try {
      await chrome.storage.local.set({
        themeMode: mode.value, activeGradient: activeGradient.value, customColors: customColors.value,
        activePreset: activePreset.value, radiusStyle: radiusStyle.value, fontSize: fontSize.value,
        fontFamily: fontFamily.value, headerStyle: headerStyle.value, cardStyle: cardStyle.value,
        animationSpeed: animationSpeed.value, scrollbarStyle: scrollbarStyle.value,
        backgroundPattern: backgroundPattern.value, accentColor: accentColor.value,
        compactMode: compactMode.value,
      })
    } catch { /* ignore */ }
  }

  function setMode(m: ThemeMode) { mode.value = m; activeGradient.value = null; customColors.value = null; applyTheme(); saveTheme() }
  function setGradient(g: string) { activeGradient.value = g; customColors.value = null; applyTheme(); saveTheme() }
  function setCustomColors(c: { primary: string; bg: string; text: string }) {
    activeGradient.value = null
    const bgRgb = `${parseInt(c.bg.slice(1, 3), 16)},${parseInt(c.bg.slice(3, 5), 16)},${parseInt(c.bg.slice(5, 7), 16)}`
    customColors.value = { ...c, surfaceRgb: bgRgb }
    applyTheme(); saveTheme()
  }
  function setPreset(id: string) { activePreset.value = id; activeGradient.value = null; customColors.value = null; applyTheme(); saveTheme() }
  function setRadiusStyle(s: RadiusStyle) { radiusStyle.value = s; applyTheme(); saveTheme() }
  function setFontSize(s: FontSize) { fontSize.value = s; applyTheme(); saveTheme() }
  function setFontFamily(f: FontFamily) { fontFamily.value = f; applyTheme(); saveTheme() }
  function setHeaderStyle(s: HeaderStyle) { headerStyle.value = s; applyTheme(); saveTheme() }
  function setCardStyle(s: CardStyle) { cardStyle.value = s; applyTheme(); saveTheme() }
  function setAnimationSpeed(s: AnimationSpeed) { animationSpeed.value = s; applyTheme(); saveTheme() }
  function setScrollbarStyle(s: ScrollbarStyle) { scrollbarStyle.value = s; applyTheme(); saveTheme() }
  function setBackgroundPattern(p: BackgroundPattern) { backgroundPattern.value = p; applyTheme(); saveTheme() }
  function setAccentColor(c: string | null) { accentColor.value = c; applyTheme(); saveTheme() }
  function toggleCompact() { compactMode.value = !compactMode.value; applyTheme(); saveTheme() }
  function toggleThemeModal() { showThemeModal.value = !showThemeModal.value }

  function exportConfig(): string {
    const config: ThemeConfig = {
      mode: mode.value, activePreset: activePreset.value, activeGradient: activeGradient.value,
      customColors: customColors.value, accentColor: accentColor.value, radiusStyle: radiusStyle.value,
      fontSize: fontSize.value, fontFamily: fontFamily.value, headerStyle: headerStyle.value,
      cardStyle: cardStyle.value, animationSpeed: animationSpeed.value, scrollbarStyle: scrollbarStyle.value,
      backgroundPattern: backgroundPattern.value, compactMode: compactMode.value,
    }
    return JSON.stringify(config, null, 2)
  }

  function importConfig(json: string): boolean {
    try {
      const c = JSON.parse(json)
      if (typeof c !== 'object' || c === null) return false
      const validModes = ['auto', 'light', 'dark']
      const validPresets = ['indigo', 'emerald', 'rose', 'amber', 'cyan', 'violet', 'slate', 'pink']
      const validRadius = ['none', 'small', 'medium', 'large']
      const validFontSize = ['small', 'medium', 'large']
      const validFontFamily = ['system', 'serif', 'mono', 'rounded']
      const validHeaderStyle = ['solid', 'gradient', 'glass', 'minimal']
      const validCardStyle = ['flat', 'bordered', 'shadowed', 'elevated']
      const validAnimSpeed = ['off', 'slow', 'normal', 'fast']
      const validScrollbar = ['thin', 'default', 'hidden']
      const validBgPattern = ['none', 'dots', 'grid', 'diagonal', 'noise']
      const isValidHex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
      if (c.mode && !validModes.includes(c.mode)) return false
      if (c.activePreset && !validPresets.includes(c.activePreset)) return false
      if (c.radiusStyle && !validRadius.includes(c.radiusStyle)) return false
      if (c.fontSize && !validFontSize.includes(c.fontSize)) return false
      if (c.fontFamily && !validFontFamily.includes(c.fontFamily)) return false
      if (c.headerStyle && !validHeaderStyle.includes(c.headerStyle)) return false
      if (c.cardStyle && !validCardStyle.includes(c.cardStyle)) return false
      if (c.animationSpeed && !validAnimSpeed.includes(c.animationSpeed)) return false
      if (c.scrollbarStyle && !validScrollbar.includes(c.scrollbarStyle)) return false
      if (c.backgroundPattern && !validBgPattern.includes(c.backgroundPattern)) return false
      if (c.customColors) {
        if (typeof c.customColors !== 'object') return false
        if (c.customColors.primary && !isValidHex(c.customColors.primary)) return false
        if (c.customColors.bg && !isValidHex(c.customColors.bg)) return false
        if (c.customColors.text && !isValidHex(c.customColors.text)) return false
        if (c.customColors.surfaceRgb && !/^\d+,\d+,\d+$/.test(c.customColors.surfaceRgb)) return false
      }
      if (c.accentColor && !isValidHex(c.accentColor)) return false
      if (c.activeGradient !== undefined && c.activeGradient !== null && typeof c.activeGradient !== 'string') return false
      if (c.compactMode !== undefined && typeof c.compactMode !== 'boolean') return false
      if (c.mode) mode.value = c.mode
      if (c.activePreset) activePreset.value = c.activePreset
      if (c.activeGradient !== undefined) activeGradient.value = c.activeGradient
      if (c.customColors) {
        const cc = c.customColors as { primary: string; bg: string; text: string; surfaceRgb?: string }
        const bgRgb = cc.surfaceRgb || `${parseInt(cc.bg.slice(1, 3), 16)},${parseInt(cc.bg.slice(3, 5), 16)},${parseInt(cc.bg.slice(5, 7), 16)}`
        customColors.value = { primary: cc.primary, bg: cc.bg, text: cc.text, surfaceRgb: bgRgb }
      }
      if (c.accentColor !== undefined) accentColor.value = c.accentColor
      if (c.radiusStyle) radiusStyle.value = c.radiusStyle
      if (c.fontSize) fontSize.value = c.fontSize
      if (c.fontFamily) fontFamily.value = c.fontFamily
      if (c.headerStyle) headerStyle.value = c.headerStyle
      if (c.cardStyle) cardStyle.value = c.cardStyle
      if (c.animationSpeed) animationSpeed.value = c.animationSpeed
      if (c.scrollbarStyle) scrollbarStyle.value = c.scrollbarStyle
      if (c.backgroundPattern) backgroundPattern.value = c.backgroundPattern
      if (c.compactMode !== undefined) compactMode.value = c.compactMode
      applyTheme(); saveTheme()
      return true
    } catch { return false }
  }

  function resetAll() {
    mode.value = 'auto'; activePreset.value = 'indigo'; activeGradient.value = null
    customColors.value = null; accentColor.value = null; radiusStyle.value = 'medium'
    fontSize.value = 'medium'; fontFamily.value = 'system'; headerStyle.value = 'solid'
    cardStyle.value = 'bordered'; animationSpeed.value = 'normal'; scrollbarStyle.value = 'thin'
    backgroundPattern.value = 'none'; compactMode.value = false
    applyTheme(); saveTheme()
  }

  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (mode.value === 'auto') applyTheme() })
  }

  return {
    mode, activeGradient, customColors, activePreset, showThemeModal, isDark,
    radiusStyle, fontSize, fontFamily, headerStyle, cardStyle, animationSpeed,
    scrollbarStyle, backgroundPattern, accentColor, compactMode,
    loadTheme, saveTheme, setMode, setGradient, setCustomColors, setPreset,
    setRadiusStyle, setFontSize, setFontFamily, setHeaderStyle, setCardStyle,
    setAnimationSpeed, setScrollbarStyle, setBackgroundPattern, setAccentColor,
    toggleCompact, toggleThemeModal, exportConfig, importConfig, resetAll, applyTheme,
  }
})
