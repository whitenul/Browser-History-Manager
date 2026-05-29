import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// ===== Type Definitions =====

export type ThemeMode = 'auto' | 'light' | 'dark'
export type BackgroundType = 'none' | 'gradient' | 'stars' | 'aurora' | 'image'
export type CardStyle = 'flat' | 'bordered' | 'shadowed' | 'elevated' | 'glass'
export type HeaderStyle = 'solid' | 'gradient' | 'glass' | 'minimal'
export type RadiusPreset = 'none' | 'small' | 'medium' | 'large' | 'full'
export type AnimationSpeed = 'off' | 'slow' | 'normal' | 'fast'
export type ScrollbarStyle = 'thin' | 'default' | 'hidden'
export type FontSize = 'small' | 'medium' | 'large'
export type FontFamily = 'system' | 'serif' | 'mono' | 'rounded'
export type FontWeight = 'light' | 'normal' | 'medium' | 'semibold'
export type LineHeight = 'compact' | 'normal' | 'relaxed'
export type CardDensity = 'compact' | 'normal' | 'comfortable'

export interface BackgroundConfig {
  type: BackgroundType
  /** For 'image' type: base64 data URL or external URL */
  imageUrl: string
  /** Blur amount in px (0-30) */
  blur: number
  /** Opacity 0-1 */
  opacity: number
  /** Overlay color (usually dark) */
  overlayColor: string
  /** Overlay opacity 0-1 */
  overlayOpacity: number
  /** Background size */
  size: 'cover' | 'contain' | 'auto'
  /** Gradient CSS (for 'gradient' type) */
  gradient: string
}

export interface ThemePreset {
  id: string
  name: string
  icon: string
  /** Semantic color tokens for light mode */
  light: Record<string, string>
  /** Semantic color tokens for dark mode */
  dark: Record<string, string>
}

// ===== Preset Themes =====

export const PRESET_THEMES: ThemePreset[] = [
  {
    id: 'indigo', name: 'theme.presets.indigo', icon: '💎',
    light: { '--color-primary': '#4f46e5', '--color-primary-hover': '#4338ca', '--color-primary-light': 'rgba(79,70,229,0.08)', '--color-accent': '#7c3aed', '--color-accent-light': 'rgba(124,58,237,0.08)' },
    dark: { '--color-primary': '#818cf8', '--color-primary-hover': '#6366f1', '--color-primary-light': 'rgba(129,140,248,0.12)', '--color-accent': '#a78bfa', '--color-accent-light': 'rgba(167,139,250,0.12)' },
  },
  {
    id: 'emerald', name: 'theme.presets.emerald', icon: '🌿',
    light: { '--color-primary': '#059669', '--color-primary-hover': '#047857', '--color-primary-light': 'rgba(5,150,105,0.08)', '--color-accent': '#0891b2', '--color-accent-light': 'rgba(8,145,178,0.08)' },
    dark: { '--color-primary': '#34d399', '--color-primary-hover': '#10b981', '--color-primary-light': 'rgba(52,211,153,0.12)', '--color-accent': '#22d3ee', '--color-accent-light': 'rgba(34,211,238,0.12)' },
  },
  {
    id: 'rose', name: 'theme.presets.rose', icon: '🌹',
    light: { '--color-primary': '#e11d48', '--color-primary-hover': '#be123c', '--color-primary-light': 'rgba(225,29,72,0.08)', '--color-accent': '#f59e0b', '--color-accent-light': 'rgba(245,158,11,0.08)' },
    dark: { '--color-primary': '#fb7185', '--color-primary-hover': '#f43f5e', '--color-primary-light': 'rgba(251,113,133,0.12)', '--color-accent': '#fbbf24', '--color-accent-light': 'rgba(251,191,36,0.12)' },
  },
  {
    id: 'amber', name: 'theme.presets.amber', icon: '🔥',
    light: { '--color-primary': '#d97706', '--color-primary-hover': '#b45309', '--color-primary-light': 'rgba(217,119,6,0.08)', '--color-accent': '#dc2626', '--color-accent-light': 'rgba(220,38,38,0.08)' },
    dark: { '--color-primary': '#fbbf24', '--color-primary-hover': '#f59e0b', '--color-primary-light': 'rgba(251,191,36,0.12)', '--color-accent': '#f87171', '--color-accent-light': 'rgba(248,113,113,0.12)' },
  },
  {
    id: 'cyan', name: 'theme.presets.cyan', icon: '🌊',
    light: { '--color-primary': '#0891b2', '--color-primary-hover': '#0e7490', '--color-primary-light': 'rgba(8,145,178,0.08)', '--color-accent': '#6366f1', '--color-accent-light': 'rgba(99,102,241,0.08)' },
    dark: { '--color-primary': '#22d3ee', '--color-primary-hover': '#06b6d4', '--color-primary-light': 'rgba(34,211,238,0.12)', '--color-accent': '#818cf8', '--color-accent-light': 'rgba(129,140,248,0.12)' },
  },
  {
    id: 'violet', name: 'theme.presets.violet', icon: '🔮',
    light: { '--color-primary': '#7c3aed', '--color-primary-hover': '#6d28d9', '--color-primary-light': 'rgba(124,58,237,0.08)', '--color-accent': '#ec4899', '--color-accent-light': 'rgba(236,72,153,0.08)' },
    dark: { '--color-primary': '#a78bfa', '--color-primary-hover': '#8b5cf6', '--color-primary-light': 'rgba(167,139,250,0.12)', '--color-accent': '#f472b6', '--color-accent-light': 'rgba(244,114,182,0.12)' },
  },
  {
    id: 'slate', name: 'theme.presets.slate', icon: '🪨',
    light: { '--color-primary': '#475569', '--color-primary-hover': '#334155', '--color-primary-light': 'rgba(71,85,105,0.08)', '--color-accent': '#64748b', '--color-accent-light': 'rgba(100,116,139,0.08)' },
    dark: { '--color-primary': '#94a3b8', '--color-primary-hover': '#cbd5e1', '--color-primary-light': 'rgba(148,163,184,0.12)', '--color-accent': '#64748b', '--color-accent-light': 'rgba(100,116,139,0.12)' },
  },
  {
    id: 'pink', name: 'theme.presets.pink', icon: '🌸',
    light: { '--color-primary': '#db2777', '--color-primary-hover': '#be185d', '--color-primary-light': 'rgba(219,39,119,0.08)', '--color-accent': '#f97316', '--color-accent-light': 'rgba(249,115,22,0.08)' },
    dark: { '--color-primary': '#f472b6', '--color-primary-hover': '#ec4899', '--color-primary-light': 'rgba(244,114,182,0.12)', '--color-accent': '#fb923c', '--color-accent-light': 'rgba(251,146,60,0.12)' },
  },
]

export const GRADIENT_PRESETS = [
  { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'forest', name: 'Forest', gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'night', name: 'Night', gradient: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' },
  { id: 'flame', name: 'Flame', gradient: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' },
  { id: 'aurora-g', name: 'Aurora', gradient: 'linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)' },
  { id: 'lavender', name: 'Lavender', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'midnight', name: 'Midnight', gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'cyber', name: 'Cyber', gradient: 'linear-gradient(135deg, #fc466b 0%, #3f5efb 100%)' },
]

// ===== Base palettes for light/dark =====

const LIGHT_PALETTE: Record<string, string> = {
  '--color-bg-base': '#f8fafc',
  '--color-bg-surface': '#ffffff',
  '--color-bg-surface-rgb': '255,255,255',
  '--color-bg-elevated': '#ffffff',
  '--color-bg-overlay': 'rgba(0,0,0,0.5)',
  '--color-text-primary': '#0f172a',
  '--color-text-secondary': '#334155',
  '--color-text-muted': '#64748b',
  '--color-text-inverse': '#ffffff',
  '--color-border': '#e2e8f0',
  '--color-border-light': '#f1f5f9',
  '--color-danger': '#ef4444',
  '--color-danger-hover': '#dc2626',
  '--color-danger-light': 'rgba(239,68,68,0.08)',
  '--color-success': '#10b981',
  '--color-success-light': 'rgba(16,185,129,0.08)',
  '--color-warning': '#f59e0b',
  '--color-warning-light': 'rgba(245,158,11,0.08)',
  '--color-info': '#3b82f6',
  '--color-info-light': 'rgba(59,130,246,0.08)',
}

const DARK_PALETTE: Record<string, string> = {
  '--color-bg-base': '#0b0f14',
  '--color-bg-surface': '#1a1f2e',
  '--color-bg-surface-rgb': '26,31,46',
  '--color-bg-elevated': '#242938',
  '--color-bg-overlay': 'rgba(0,0,0,0.7)',
  '--color-text-primary': '#e8edf2',
  '--color-text-secondary': '#94a3b8',
  '--color-text-muted': '#64748b',
  '--color-text-inverse': '#0f172a',
  '--color-border': '#2a3040',
  '--color-border-light': '#1e2433',
  '--color-danger': '#f87171',
  '--color-danger-hover': '#ef4444',
  '--color-danger-light': 'rgba(248,113,113,0.12)',
  '--color-success': '#34d399',
  '--color-success-light': 'rgba(52,211,153,0.12)',
  '--color-warning': '#fbbf24',
  '--color-warning-light': 'rgba(251,191,36,0.12)',
  '--color-info': '#60a5fa',
  '--color-info-light': 'rgba(96,165,250,0.12)',
}

// ===== Radius map =====

const RADIUS_MAP: Record<RadiusPreset, string> = {
  none: '0px',
  small: '4px',
  medium: '8px',
  large: '14px',
  full: '9999px',
}

// ===== Animation speed map =====

const SPEED_MAP: Record<AnimationSpeed, string> = {
  off: '0ms',
  slow: '300ms',
  normal: '150ms',
  fast: '80ms',
}

const FONT_WEIGHT_MAP: Record<FontWeight, string> = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
}

const LINE_HEIGHT_MAP: Record<LineHeight, string> = {
  compact: '1.3',
  normal: '1.5',
  relaxed: '1.7',
}

const CARD_DENSITY_MAP: Record<CardDensity, string> = {
  compact: 'compact',
  normal: 'normal',
  comfortable: 'comfortable',
}

// ===== Store =====

export const useThemeStore = defineStore('theme', () => {
  // --- Core state ---
  const mode = ref<ThemeMode>('auto')
  const activePresetId = ref('indigo')
  const isDark = ref(false)

  // --- Background ---
  const background = ref<BackgroundConfig>({
    type: 'none',
    imageUrl: '',
    blur: 0,
    opacity: 1,
    overlayColor: '#000000',
    overlayOpacity: 0,
    size: 'cover',
    gradient: '',
  })

  // --- Layout ---
  const headerStyle = ref<HeaderStyle>('solid')
  const cardStyle = ref<CardStyle>('flat')
  const radiusPreset = ref<RadiusPreset>('medium')
  const compactMode = ref(false)

  // --- Typography ---
  const fontSize = ref<FontSize>('medium')
  const fontFamily = ref<FontFamily>('system')

  // --- Effects ---
  const animationSpeed = ref<AnimationSpeed>('normal')
  const scrollbarStyle = ref<ScrollbarStyle>('thin')

  // --- Glass settings ---
  const glassBlur = ref(12)
  const glassOpacity = ref(0.6)

  // --- Custom colors (override preset) ---
  const customColors = ref<Record<string, string> | null>(null)

  // --- Custom CSS (user-written styles) ---
  const customCSS = ref('')
  const fontWeight = ref<FontWeight>('normal')
  const lineHeight = ref<LineHeight>('normal')
  const cardDensity = ref<CardDensity>('normal')

  // --- UI state ---
  const showThemeModal = ref(false)

  // ===== Computed =====

  const activePreset = computed(() => PRESET_THEMES.find(p => p.id === activePresetId.value) || PRESET_THEMES[0])

  const effectiveMode = computed(() => {
    if (mode.value === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode.value
  })

  // ===== Apply all tokens to DOM =====

  function applyTokens() {
    const html = document.documentElement
    const dark = effectiveMode.value === 'dark'
    isDark.value = dark

    // 1. Dark mode class
    html.classList.toggle('dark', dark)
    html.classList.toggle('compact', compactMode.value)
    html.classList.toggle('no-animations', animationSpeed.value === 'off')

    // 2. Semantic tokens: base palette
    const palette = dark ? { ...DARK_PALETTE } : { ...LIGHT_PALETTE }

    // 3. Merge preset colors
    const presetColors = dark ? activePreset.value.dark : activePreset.value.light
    Object.assign(palette, presetColors)

    // 4. Merge custom colors (highest priority)
    if (customColors.value) {
      Object.assign(palette, customColors.value)
    }

    // 5. Apply all semantic tokens
    for (const [key, val] of Object.entries(palette)) {
      html.style.setProperty(key, val)
    }

    // 6. Component tokens (derived from semantic)
    applyComponentTokens(html, palette)

    // 7. Effect tokens
    applyEffectTokens(html)

    // 8. Data attributes for CSS selectors
    html.dataset.headerStyle = headerStyle.value
    html.dataset.cardStyle = cardStyle.value
    html.dataset.scrollbarStyle = scrollbarStyle.value
    html.dataset.bgType = background.value.type

    // 9. Font
    const fontSizes: Record<FontSize, string> = { small: '12px', medium: '13px', large: '15px' }
    html.style.fontSize = fontSizes[fontSize.value]
    html.dataset.fontFamily = fontFamily.value
    html.dataset.fontWeight = fontWeight.value
    html.dataset.lineHeight = lineHeight.value
    html.dataset.cardDensity = cardDensity.value

    // 10. Radius
    html.style.setProperty('--radius-base', RADIUS_MAP[radiusPreset.value])

    // 11. Animation speed
    html.style.setProperty('--transition-base', SPEED_MAP[animationSpeed.value])
  }

  function applyComponentTokens(html: HTMLElement, palette: Record<string, string>) {
    const dark = isDark.value
    const primary = palette['--color-primary'] || '#4f46e5'
    const primaryHover = palette['--color-primary-hover'] || primary
    const primaryLight = palette['--color-primary-light'] || 'rgba(79,70,229,0.08)'
    const danger = palette['--color-danger'] || '#ef4444'
    const dangerLight = palette['--color-danger-light'] || 'rgba(239,68,68,0.08)'
    const surface = palette['--color-bg-surface'] || '#ffffff'
    const surfaceRgb = palette['--color-bg-surface-rgb'] || '255,255,255'
    const border = palette['--color-border'] || '#e2e8f0'
    const textPrimary = palette['--color-text-primary'] || '#0f172a'
    const textMuted = palette['--color-text-muted'] || '#64748b'

    // Button tokens
    html.style.setProperty('--btn-primary-bg', primary)
    html.style.setProperty('--btn-primary-text', '#ffffff')
    html.style.setProperty('--btn-primary-hover-bg', primaryHover)
    html.style.setProperty('--btn-secondary-bg', surface)
    html.style.setProperty('--btn-secondary-text', textPrimary)
    html.style.setProperty('--btn-secondary-border', border)
    html.style.setProperty('--btn-ghost-text', textMuted)
    html.style.setProperty('--btn-ghost-hover-bg', primaryLight)
    html.style.setProperty('--btn-danger-bg', dangerLight)
    html.style.setProperty('--btn-danger-text', danger)
    html.style.setProperty('--btn-danger-border', danger)
    html.style.setProperty('--btn-danger-hover-bg', danger)

    // Card tokens
    html.style.setProperty('--card-bg', surface)
    html.style.setProperty('--card-border', border)
    html.style.setProperty('--card-surface-rgb', surfaceRgb)

    // Input tokens
    html.style.setProperty('--input-bg', surface)
    html.style.setProperty('--input-border', border)
    html.style.setProperty('--input-focus-border', primary)
    html.style.setProperty('--input-focus-ring', primaryLight)

    // Header tokens
    html.style.setProperty('--header-bg', primary)
    html.style.setProperty('--header-text', '#ffffff')
    html.style.setProperty('--header-hover-bg', 'rgba(255,255,255,0.15)')
    // Glass header for MiniBrowser (semi-transparent to show theme background)
    html.style.setProperty('--glass-header-bg', dark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.75)')

    // Tag/badge tokens
    html.style.setProperty('--tag-active-bg', primaryLight)
    html.style.setProperty('--tag-active-text', primary)
    html.style.setProperty('--tag-active-border', primary)

    // Toast tokens
    html.style.setProperty('--toast-bg', dark ? '#1e293b' : '#334155')
    html.style.setProperty('--toast-text', dark ? '#e2e8f0' : '#ffffff')

    // Tooltip tokens
    html.style.setProperty('--tooltip-bg', dark ? '#1b1f23' : '#24292e')
    html.style.setProperty('--tooltip-text', '#ffffff')

    // Shadow tokens
    html.style.setProperty('--shadow-modal', '0 8px 32px rgba(0,0,0,0.2)')
    html.style.setProperty('--shadow-fab', '0 4px 12px rgba(0,0,0,0.15)')
    html.style.setProperty('--shadow-fab-hover', '0 6px 16px rgba(0,0,0,0.2)')
  }

  function applyEffectTokens(html: HTMLElement) {
    // Background tokens
    html.style.setProperty('--bg-blur', `${background.value.blur}px`)
    html.style.setProperty('--bg-opacity', `${background.value.opacity}`)
    html.style.setProperty('--bg-overlay-color', background.value.overlayColor)
    html.style.setProperty('--bg-overlay-opacity', `${background.value.overlayOpacity}`)

    // Glass tokens
    html.style.setProperty('--glass-blur', `${glassBlur.value}px`)
    html.style.setProperty('--glass-opacity', `${glassOpacity.value}`)

    // Transition
    const speed = SPEED_MAP[animationSpeed.value]
    html.style.setProperty('--transition-hover', speed)
    html.style.setProperty('--transition-modal', speed === '0ms' ? '0ms' : '200ms')
    html.style.setProperty('--transition-page', speed === '0ms' ? '0ms' : '300ms')
  }

  // ===== Actions =====

  function setMode(m: ThemeMode) { mode.value = m; applyTokens(); saveTheme() }
  function setPreset(id: string) { activePresetId.value = id; customColors.value = null; applyTokens(); saveTheme() }
  function setHeaderStyle(s: HeaderStyle) { headerStyle.value = s; applyTokens(); saveTheme() }
  function setCardStyle(s: CardStyle) { cardStyle.value = s; applyTokens(); saveTheme() }
  function setRadiusPreset(r: RadiusPreset) { radiusPreset.value = r; applyTokens(); saveTheme() }
  function setFontSize(s: FontSize) { fontSize.value = s; applyTokens(); saveTheme() }
  function setFontFamily(f: FontFamily) { fontFamily.value = f; applyTokens(); saveTheme() }
  function setAnimationSpeed(s: AnimationSpeed) { animationSpeed.value = s; applyTokens(); saveTheme() }
  function setScrollbarStyle(s: ScrollbarStyle) { scrollbarStyle.value = s; applyTokens(); saveTheme() }
  function toggleCompact() { compactMode.value = !compactMode.value; applyTokens(); saveTheme() }

  function setBackground(bg: Partial<BackgroundConfig>) {
    Object.assign(background.value, bg)
    applyTokens()
    saveTheme()
  }

  function setBackgroundImage(url: string) {
    background.value.imageUrl = url
    if (url && background.value.type !== 'image') {
      background.value.type = 'image'
    }
    applyTokens()
    saveTheme()
  }

  function setCustomColors(colors: Record<string, string> | null) {
    customColors.value = colors
    applyTokens()
    saveTheme()
  }

  function setCustomCSS(css: string) {
    customCSS.value = css
    applyCustomCSS()
    saveTheme()
  }

  function applyCustomCSS() {
    let el = document.getElementById('user-custom-style')
    if (!el) {
      el = document.createElement('style')
      el.id = 'user-custom-style'
      document.head.appendChild(el)
    }
    el.textContent = customCSS.value
  }

  function setGlassBlur(v: number) { glassBlur.value = v; applyTokens(); saveTheme() }
  function setGlassOpacity(v: number) { glassOpacity.value = v; applyTokens(); saveTheme() }
  function setFontWeight(w: FontWeight) { fontWeight.value = w; applyTokens(); saveTheme() }
  function setLineHeight(h: LineHeight) { lineHeight.value = h; applyTokens(); saveTheme() }
  function setCardDensity(d: CardDensity) { cardDensity.value = d; applyTokens(); saveTheme() }

  function toggleThemeModal() { showThemeModal.value = !showThemeModal.value }

  // ===== Persistence =====

  async function saveTheme() {
    const data = {
      mode: mode.value,
      activePresetId: activePresetId.value,
      background: background.value,
      headerStyle: headerStyle.value,
      cardStyle: cardStyle.value,
      radiusPreset: radiusPreset.value,
      compactMode: compactMode.value,
      fontSize: fontSize.value,
      fontFamily: fontFamily.value,
      animationSpeed: animationSpeed.value,
      scrollbarStyle: scrollbarStyle.value,
      glassBlur: glassBlur.value,
      glassOpacity: glassOpacity.value,
      customColors: customColors.value,
      customCSS: customCSS.value,
      fontWeight: fontWeight.value,
      lineHeight: lineHeight.value,
      cardDensity: cardDensity.value,
    }
    await chrome.storage.local.set({ themeConfig: data })
  }

  async function loadTheme() {
    const result = await chrome.storage.local.get('themeConfig')
    const data = result.themeConfig as Record<string, any> | undefined
    if (!data) { applyTokens(); return }

    mode.value = data.mode || 'auto'
    activePresetId.value = data.activePresetId || 'indigo'
    if (data.background) Object.assign(background.value, data.background)
    headerStyle.value = data.headerStyle || 'solid'
    cardStyle.value = data.cardStyle || 'flat'
    radiusPreset.value = data.radiusPreset || 'medium'
    compactMode.value = data.compactMode || false
    fontSize.value = data.fontSize || 'medium'
    fontFamily.value = data.fontFamily || 'system'
    animationSpeed.value = data.animationSpeed || 'normal'
    scrollbarStyle.value = data.scrollbarStyle || 'thin'
    glassBlur.value = data.glassBlur ?? 12
    glassOpacity.value = data.glassOpacity ?? 0.6
    customColors.value = data.customColors || null
    customCSS.value = data.customCSS || ''
    fontWeight.value = data.fontWeight || 'normal'
    lineHeight.value = data.lineHeight || 'normal'
    cardDensity.value = data.cardDensity || 'normal'

    applyTokens()
    applyCustomCSS()
  }

  function exportConfig(): string {
    return JSON.stringify({
      mode: mode.value,
      activePresetId: activePresetId.value,
      background: background.value,
      headerStyle: headerStyle.value,
      cardStyle: cardStyle.value,
      radiusPreset: radiusPreset.value,
      compactMode: compactMode.value,
      fontSize: fontSize.value,
      fontFamily: fontFamily.value,
      animationSpeed: animationSpeed.value,
      scrollbarStyle: scrollbarStyle.value,
      glassBlur: glassBlur.value,
      glassOpacity: glassOpacity.value,
      customColors: customColors.value,
      customCSS: customCSS.value,
      fontWeight: fontWeight.value,
      lineHeight: lineHeight.value,
      cardDensity: cardDensity.value,
    }, null, 2)
  }

  function importConfig(json: string): boolean {
    try {
      const data = JSON.parse(json)
      if (data.mode) mode.value = data.mode
      if (data.activePresetId) activePresetId.value = data.activePresetId
      if (data.background) Object.assign(background.value, data.background)
      if (data.headerStyle) headerStyle.value = data.headerStyle
      if (data.cardStyle) cardStyle.value = data.cardStyle
      if (data.radiusPreset) radiusPreset.value = data.radiusPreset
      if (data.compactMode !== undefined) compactMode.value = data.compactMode
      if (data.fontSize) fontSize.value = data.fontSize
      if (data.fontFamily) fontFamily.value = data.fontFamily
      if (data.animationSpeed) animationSpeed.value = data.animationSpeed
      if (data.scrollbarStyle) scrollbarStyle.value = data.scrollbarStyle
      if (data.glassBlur !== undefined) glassBlur.value = data.glassBlur
      if (data.glassOpacity !== undefined) glassOpacity.value = data.glassOpacity
      if (data.customColors) customColors.value = data.customColors
      if (data.customCSS !== undefined) customCSS.value = data.customCSS
      if (data.fontWeight) fontWeight.value = data.fontWeight
      if (data.lineHeight) lineHeight.value = data.lineHeight
      if (data.cardDensity) cardDensity.value = data.cardDensity
      applyTokens()
      applyCustomCSS()
      saveTheme()
      return true
    } catch {
      return false
    }
  }

  function resetAll() {
    mode.value = 'auto'
    activePresetId.value = 'indigo'
    background.value = { type: 'none', imageUrl: '', blur: 0, opacity: 1, overlayColor: '#000000', overlayOpacity: 0, size: 'cover', gradient: '' }
    headerStyle.value = 'solid'
    cardStyle.value = 'flat'
    radiusPreset.value = 'medium'
    compactMode.value = false
    fontSize.value = 'medium'
    fontFamily.value = 'system'
    animationSpeed.value = 'normal'
    scrollbarStyle.value = 'thin'
    glassBlur.value = 12
    glassOpacity.value = 0.6
    customColors.value = null
    customCSS.value = ''
    fontWeight.value = 'normal'
    lineHeight.value = 'normal'
    cardDensity.value = 'normal'
    applyTokens()
    applyCustomCSS()
    saveTheme()
  }

  // Watch system dark mode
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (mode.value === 'auto') applyTokens()
    })
  }

  return {
    // State
    mode, activePresetId, isDark, background, headerStyle, cardStyle,
    radiusPreset, compactMode, fontSize, fontFamily, animationSpeed,
    scrollbarStyle, glassBlur, glassOpacity, customColors, customCSS, showThemeModal,
    fontWeight, lineHeight, cardDensity,
    // Computed
    activePreset, effectiveMode,
    // Actions
    setMode, setPreset, setHeaderStyle, setCardStyle, setRadiusPreset,
    setFontSize, setFontFamily, setAnimationSpeed, setScrollbarStyle,
    toggleCompact, setBackground, setBackgroundImage, setCustomColors,
    setGlassBlur, setGlassOpacity, setCustomCSS, toggleThemeModal,
    setFontWeight, setLineHeight, setCardDensity,
    // Persistence
    saveTheme, loadTheme, exportConfig, importConfig, resetAll, applyTokens,
  }
})
