<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '@/i18n'
import { useThemeStore, PRESET_THEMES, GRADIENT_PRESETS } from '@/stores/theme'
import type { BackgroundType, CardStyle, HeaderStyle, RadiusPreset, AnimationSpeed, ScrollbarStyle, FontSize, FontFamily, FontWeight, LineHeight, CardDensity } from '@/stores/theme'

const { t } = useI18n()
const theme = useThemeStore()
const activeSection = ref<'color' | 'background' | 'layout' | 'typo' | 'effects' | 'advanced'>('color')
const importText = ref('')
const showImportArea = ref(false)
const customCSSText = ref(theme.customCSS || '')

function applyCustomCSS() {
  theme.setCustomCSS(customCSSText.value)
}

function resetCustomCSS() {
  customCSSText.value = ''
  theme.setCustomCSS('')
}
const imageUrlInput = ref('')

const colorDefaults = computed<Record<string, string>>(() => theme.isDark ? {
  '--color-text-primary': '#e8edf2', '--color-text-secondary': '#94a3b8', '--color-text-muted': '#64748b',
  '--color-bg-base': '#0b0f14', '--color-bg-surface': '#1a1f2e', '--color-border': '#2a3040',
  '--color-danger': '#f87171', '--color-success': '#34d399', '--color-warning': '#fbbf24', '--color-info': '#60a5fa',
} : {
  '--color-text-primary': '#0f172a', '--color-text-secondary': '#334155', '--color-text-muted': '#64748b',
  '--color-bg-base': '#f8fafc', '--color-bg-surface': '#ffffff', '--color-border': '#e2e8f0',
  '--color-danger': '#ef4444', '--color-success': '#10b981', '--color-warning': '#f59e0b', '--color-info': '#3b82f6',
})

function getColor(varName: string): string {
  return theme.customColors?.[varName] || colorDefaults.value[varName] || '#000000'
}

function setColor(varName: string, value: string) {
  theme.setCustomColors({ ...theme.customColors, [varName]: value })
}

const sections = [
  { id: 'color' as const, label: t('theme.color'), icon: 'i-lucide:palette' },
  { id: 'background' as const, label: 'Background', icon: 'i-lucide:image' },
  { id: 'layout' as const, label: t('theme.layout'), icon: 'i-lucide:layout' },
  { id: 'typo' as const, label: t('theme.typography'), icon: 'i-lucide:type' },
  { id: 'effects' as const, label: t('theme.effects'), icon: 'i-lucide:sparkles' },
  { id: 'advanced' as const, label: t('theme.advanced'), icon: 'i-lucide:settings-2' },
]

const bgTypes: { value: BackgroundType; label: string; icon: string }[] = [
  { value: 'none', label: 'None', icon: 'i-lucide:ban' },
  { value: 'gradient', label: 'Gradient', icon: 'i-lucide:blend' },
  { value: 'stars', label: 'Stars', icon: 'i-lucide:stars' },
  { value: 'aurora', label: 'Aurora', icon: 'i-lucide:sun' },
  { value: 'image', label: 'Image', icon: 'i-lucide:image' },
]

function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    theme.setBackground({ type: 'image', imageUrl: dataUrl })
  }
  reader.readAsDataURL(file)
}

function applyImageUrl() {
  if (imageUrlInput.value.trim()) {
    theme.setBackground({ type: 'image', imageUrl: imageUrlInput.value.trim() })
    imageUrlInput.value = ''
  }
}

function close() { theme.showThemeModal = false }
function doExport() {
  const json = theme.exportConfig()
  navigator.clipboard.writeText(json).catch(() => { showImportArea.value = true; importText.value = json })
}
function doImport() {
  if (theme.importConfig(importText.value)) { showImportArea.value = false; importText.value = '' }
}
</script>

<template>
  <Teleport to="body">
    <div class="theme-overlay" @click="close">
      <div class="theme-modal glass-panel" @click.stop>
        <div class="modal-header">
          <span class="i-lucide:palette header-icon" />
          <span class="header-title gradient-text">{{ t('theme.title') }}</span>
          <button class="close-btn" @click="close"><span class="i-lucide:x" /></button>
        </div>

        <div class="section-tabs">
          <button v-for="sec in sections" :key="sec.id" class="section-tab" :class="{ active: activeSection === sec.id }" @click="activeSection = sec.id">
            <span :class="sec.icon" />{{ sec.label }}
          </button>
        </div>

        <div class="modal-body">
          <!-- 配色 -->
          <div v-if="activeSection === 'color'">
            <div class="sub-label">{{ t('theme.mode') }}</div>
            <div class="mode-row">
              <button v-for="m in (['auto','light','dark'] as const)" :key="m" class="mode-btn" :class="{ active: theme.mode === m }" @click="theme.setMode(m)">
                <span :class="m === 'auto' ? 'i-lucide:monitor' : m === 'light' ? 'i-lucide:sun' : 'i-lucide:moon'" />{{ m }}
              </button>
            </div>
            <div class="sub-label">{{ t('theme.presetPalette') }}</div>
            <div class="preset-grid">
              <button v-for="p in PRESET_THEMES" :key="p.id" class="preset-card" :class="{ active: theme.activePresetId === p.id && !theme.customColors }" @click="theme.setPreset(p.id)">
                <div class="preset-preview" :style="{ backgroundColor: p.light['--color-primary'] }"><span class="preset-icon">{{ p.icon }}</span></div>
                <span class="preset-name">{{ t(p.name) }}</span>
              </button>
            </div>
            <div class="sub-label">Brand Colors</div>
            <div class="color-row">
              <label class="color-field"><span>Primary</span><input type="color" :value="getColor('--color-primary')" @input="setColor('--color-primary', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
              <label class="color-field"><span>Accent</span><input type="color" :value="getColor('--color-accent')" @input="setColor('--color-accent', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
            </div>
            <div class="sub-label">{{ t('theme.textColors') }}</div>
            <div class="color-row">
              <label class="color-field"><span>{{ t('theme.textPrimary') }}</span><input type="color" :value="getColor('--color-text-primary')" @input="setColor('--color-text-primary', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
              <label class="color-field"><span>{{ t('theme.textSecondary') }}</span><input type="color" :value="getColor('--color-text-secondary')" @input="setColor('--color-text-secondary', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
              <label class="color-field"><span>{{ t('theme.textMuted') }}</span><input type="color" :value="getColor('--color-text-muted')" @input="setColor('--color-text-muted', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
            </div>
            <div class="sub-label">{{ t('theme.bgColors') }}</div>
            <div class="color-row">
              <label class="color-field"><span>{{ t('theme.bgBase') }}</span><input type="color" :value="getColor('--color-bg-base')" @input="setColor('--color-bg-base', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
              <label class="color-field"><span>{{ t('theme.bgSurface') }}</span><input type="color" :value="getColor('--color-bg-surface')" @input="setColor('--color-bg-surface', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
            </div>
            <div class="sub-label">{{ t('theme.borderColor') }}</div>
            <div class="color-row">
              <label class="color-field"><span>{{ t('theme.border') }}</span><input type="color" :value="getColor('--color-border')" @input="setColor('--color-border', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
            </div>
            <div class="sub-label">{{ t('theme.semanticColors') }}</div>
            <div class="color-row">
              <label class="color-field"><span>{{ t('theme.danger') }}</span><input type="color" :value="getColor('--color-danger')" @input="setColor('--color-danger', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
              <label class="color-field"><span>{{ t('theme.success') }}</span><input type="color" :value="getColor('--color-success')" @input="setColor('--color-success', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
              <label class="color-field"><span>{{ t('theme.warning') }}</span><input type="color" :value="getColor('--color-warning')" @input="setColor('--color-warning', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
              <label class="color-field"><span>{{ t('theme.info') }}</span><input type="color" :value="getColor('--color-info')" @input="setColor('--color-info', ($event.target as HTMLInputElement).value)" class="color-input" /></label>
            </div>
            <button v-if="theme.customColors" class="reset-btn" @click="theme.setCustomColors(null)"><span class="i-lucide:x" />Clear All Custom Colors</button>
          </div>

          <!-- 背景 -->
          <div v-if="activeSection === 'background'">
            <div class="sub-label">Background Type</div>
            <div class="bg-type-row">
              <button v-for="bt in bgTypes" :key="bt.value" class="bg-type-btn" :class="{ active: theme.background.type === bt.value }" @click="theme.setBackground({ type: bt.value })">
                <span :class="bt.icon" />{{ bt.label }}
              </button>
            </div>

            <!-- Gradient -->
            <div v-if="theme.background.type === 'gradient'" class="sub-section">
              <div class="sub-label">Gradient Presets</div>
              <div class="gradient-grid">
                <button v-for="g in GRADIENT_PRESETS" :key="g.id" class="gradient-card" :class="{ active: theme.background.gradient === g.gradient }" @click="theme.setBackground({ gradient: g.gradient })">
                  <div class="gradient-preview" :style="{ background: g.gradient }" />
                  <span class="gradient-name">{{ g.name }}</span>
                </button>
              </div>
            </div>

            <!-- Image -->
            <div v-if="theme.background.type === 'image'" class="sub-section">
              <div class="sub-label">Upload Image</div>
              <label class="upload-area">
                <input type="file" accept="image/*" @change="handleImageUpload" class="hidden-input" />
                <span class="i-lucide:upload" /><span>Click to upload</span>
              </label>
              <div class="sub-label" style="margin-top:8px">Or paste URL</div>
              <div class="url-row">
                <input v-model="imageUrlInput" class="url-input" placeholder="https://..." @keydown.enter="applyImageUrl" />
                <button class="apply-btn sm" @click="applyImageUrl">Apply</button>
              </div>
              <div v-if="theme.background.imageUrl" class="image-preview-wrap">
                <div class="image-preview" :style="{ backgroundImage: `url(${theme.background.imageUrl})` }" />
              </div>
            </div>

            <!-- Blur & Opacity (for image/gradient) -->
            <div v-if="['image', 'gradient'].includes(theme.background.type)" class="sub-section">
              <div class="sub-label">Adjustments</div>
              <div class="slider-row">
                <span class="slider-label">Blur</span>
                <input type="range" :value="theme.background.blur" min="0" max="30" step="1" @input="theme.setBackground({ blur: +($event.target as HTMLInputElement).value })" class="slider" />
                <span class="slider-value">{{ theme.background.blur }}px</span>
              </div>
              <div class="slider-row">
                <span class="slider-label">Opacity</span>
                <input type="range" :value="theme.background.opacity" min="0" max="1" step="0.05" @input="theme.setBackground({ opacity: +($event.target as HTMLInputElement).value })" class="slider" />
                <span class="slider-value">{{ Math.round(theme.background.opacity * 100) }}%</span>
              </div>
              <div class="slider-row">
                <span class="slider-label">Overlay</span>
                <input type="range" :value="theme.background.overlayOpacity" min="0" max="0.8" step="0.05" @input="theme.setBackground({ overlayOpacity: +($event.target as HTMLInputElement).value })" class="slider" />
                <span class="slider-value">{{ Math.round(theme.background.overlayOpacity * 100) }}%</span>
              </div>
              <div class="slider-row">
                <span class="slider-label">Overlay Color</span>
                <input type="color" :value="theme.background.overlayColor" @input="theme.setBackground({ overlayColor: ($event.target as HTMLInputElement).value })" class="color-input" />
              </div>
            </div>
          </div>

          <!-- 布局 -->
          <div v-if="activeSection === 'layout'">
            <div class="sub-label">{{ t('theme.headerStyle') }}</div>
            <div class="option-grid-4">
              <button v-for="hs in (['solid','gradient','glass','minimal'] as HeaderStyle[])" :key="hs" class="option-card" :class="{ active: theme.headerStyle === hs }" @click="theme.setHeaderStyle(hs)">
                <div class="option-preview header-preview" :class="hs" />
                <span class="option-label">{{ hs }}</span>
              </button>
            </div>
            <div class="sub-label">{{ t('theme.cardStyle') }}</div>
            <div class="option-grid-5">
              <button v-for="cs in (['flat','bordered','shadowed','elevated','glass'] as CardStyle[])" :key="cs" class="option-card" :class="{ active: theme.cardStyle === cs }" @click="theme.setCardStyle(cs)">
                <div class="option-preview card-preview" :class="cs" />
                <span class="option-label">{{ cs }}</span>
              </button>
            </div>
            <div class="sub-label">Radius</div>
            <div class="option-grid-5">
              <button v-for="rp in (['none','small','medium','large','full'] as RadiusPreset[])" :key="rp" class="option-card" :class="{ active: theme.radiusPreset === rp }" @click="theme.setRadiusPreset(rp)">
                <div class="radius-demo" :class="rp" />
                <span class="option-label">{{ rp }}</span>
              </button>
            </div>
            <button class="toggle-btn" :class="{ active: theme.compactMode }" @click="theme.toggleCompact()">
              <span class="i-lucide:minimize-2" />Compact<span class="toggle-status">{{ theme.compactMode ? 'ON' : 'OFF' }}</span>
            </button>
            <div class="sub-label" style="margin-top:10px">Card Density</div>
            <div class="option-grid-3">
              <button v-for="cd in (['compact','normal','comfortable'] as CardDensity[])" :key="cd" class="option-card" :class="{ active: theme.cardDensity === cd }" @click="theme.setCardDensity(cd)">
                <div class="density-demo" :class="cd">
                  <div class="density-line" /><div class="density-line" /><div class="density-line" />
                </div>
                <span class="option-label">{{ cd }}</span>
              </button>
            </div>
          </div>

          <!-- 排版 -->
          <div v-if="activeSection === 'typo'">
            <div class="sub-label">Font Size</div>
            <div class="option-grid-3">
              <button v-for="fs in (['small','medium','large'] as FontSize[])" :key="fs" class="option-card" :class="{ active: theme.fontSize === fs }" @click="theme.setFontSize(fs)">
                <span class="font-preview" :style="{ fontSize: fs === 'small' ? '11px' : fs === 'medium' ? '13px' : '15px' }">Aa</span>
                <span class="option-label">{{ fs }}</span>
              </button>
            </div>
            <div class="sub-label">Font Family</div>
            <div class="option-grid-4">
              <button v-for="ff in (['system','serif','mono','rounded'] as FontFamily[])" :key="ff" class="option-card" :class="{ active: theme.fontFamily === ff }" @click="theme.setFontFamily(ff)">
                <span class="font-preview">{{ ff === 'system' ? 'Aa' : ff === 'serif' ? 'Aa' : ff === 'mono' ? 'Aa' : 'Aa' }}</span>
                <span class="option-label">{{ ff }}</span>
              </button>
            </div>
            <div class="sub-label">{{ t('theme.fontWeight') }}</div>
            <div class="option-grid-4">
              <button v-for="fw in (['light','normal','medium','semibold'] as FontWeight[])" :key="fw" class="option-card" :class="{ active: theme.fontWeight === fw }" @click="theme.setFontWeight(fw)">
                <span class="font-preview" :style="{ fontWeight: fw === 'light' ? '300' : fw === 'normal' ? '400' : fw === 'medium' ? '500' : '600' }">Aa</span>
                <span class="option-label">{{ fw }}</span>
              </button>
            </div>
            <div class="sub-label">{{ t('theme.lineHeight') }}</div>
            <div class="option-grid-3">
              <button v-for="lh in (['compact','normal','relaxed'] as LineHeight[])" :key="lh" class="option-card" :class="{ active: theme.lineHeight === lh }" @click="theme.setLineHeight(lh)">
                <span class="lh-preview" :class="lh">Aa<br>Aa</span>
                <span class="option-label">{{ lh }}</span>
              </button>
            </div>
          </div>

          <!-- 效果 -->
          <div v-if="activeSection === 'effects'">
            <div class="sub-label">Animation Speed</div>
            <div class="option-grid-4">
              <button v-for="as_ in (['off','slow','normal','fast'] as AnimationSpeed[])" :key="as_" class="option-card" :class="{ active: theme.animationSpeed === as_ }" @click="theme.setAnimationSpeed(as_)">
                <span class="anim-icon" :class="{ off: as_ === 'off', slow: as_ === 'slow', fast: as_ === 'fast' }">⟳</span>
                <span class="option-label">{{ as_ }}</span>
              </button>
            </div>
            <div class="sub-label">Scrollbar</div>
            <div class="option-grid-3">
              <button v-for="ss in (['thin','default','hidden'] as ScrollbarStyle[])" :key="ss" class="option-card" :class="{ active: theme.scrollbarStyle === ss }" @click="theme.setScrollbarStyle(ss)">
                <span class="option-label">{{ ss }}</span>
              </button>
            </div>
            <div class="sub-label">Glass Settings</div>
            <div class="slider-row">
              <span class="slider-label">Blur</span>
              <input type="range" :value="theme.glassBlur" min="0" max="30" step="1" @input="theme.setGlassBlur(+($event.target as HTMLInputElement).value)" class="slider" />
              <span class="slider-value">{{ theme.glassBlur }}px</span>
            </div>
            <div class="slider-row">
              <span class="slider-label">Opacity</span>
              <input type="range" :value="theme.glassOpacity" min="0.1" max="1" step="0.05" @input="theme.setGlassOpacity(+($event.target as HTMLInputElement).value)" class="slider" />
              <span class="slider-value">{{ Math.round(theme.glassOpacity * 100) }}%</span>
            </div>
          </div>

          <!-- 高级 -->
          <div v-if="activeSection === 'advanced'">
            <div class="sub-label">Custom CSS</div>
            <p class="hint-text">Write custom CSS to override any style. Use CSS variables like <code>--color-primary</code>, <code>--fs-lg</code>, <code>--space-md</code> etc.</p>
            <textarea
              class="custom-css-textarea"
              v-model="customCSSText"
              placeholder=":root { --color-primary: #ff0000; }"
              rows="8"
              spellcheck="false"
            />
            <div class="action-row" style="margin-top:6px">
              <button class="action-btn" @click="applyCustomCSS"><span class="i-lucide:check" />Apply</button>
              <button class="action-btn" @click="resetCustomCSS"><span class="i-lucide:rotate-ccw" />Clear</button>
            </div>

            <div class="sub-label" style="margin-top:12px">{{ t('theme.importExport') }}</div>
            <div class="action-row">
              <button class="action-btn" @click="doExport"><span class="i-lucide:download" />Export</button>
              <button class="action-btn" @click="showImportArea = !showImportArea"><span class="i-lucide:upload" />Import</button>
            </div>
            <div v-if="showImportArea" class="import-area">
              <textarea v-model="importText" class="import-textarea" placeholder="Paste theme JSON..." rows="4" />
              <button class="apply-btn" @click="doImport"><span class="i-lucide:check" />Apply</button>
            </div>
            <div class="sub-label" style="margin-top:16px">{{ t('theme.reset') }}</div>
            <button class="btn-danger" @click="theme.resetAll()"><span class="i-lucide:rotate-ccw" />Reset All</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.theme-overlay { position: fixed; inset: 0; z-index: 400; background: var(--color-bg-overlay); backdrop-filter: blur(var(--glass-blur)); display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease; }
.theme-modal { width: 380px; max-height: 520px; border-radius: var(--radius-xl); box-shadow: var(--shadow-modal); display: flex; flex-direction: column; overflow: hidden; }
.modal-header { display: flex; align-items: center; gap: var(--space-md); padding: 12px 16px; border-bottom: 1px solid var(--color-border); background: rgba(var(--card-surface-rgb), 0.8); }
.header-icon { font-size: var(--fs-2xl); color: var(--color-primary); }
.header-title { font-size: var(--fs-xl); font-weight: 600; flex: 1; }
.close-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; font-size: var(--fs-xl); border-radius: var(--radius-sm); transition: all var(--transition-hover); }
.close-btn:hover { background: var(--color-primary-light); color: var(--color-text-primary); }

.section-tabs { display: flex; border-bottom: 1px solid var(--color-border); background: rgba(var(--card-surface-rgb), 0.5); overflow-x: auto; }
.section-tab { flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 3px; padding: 8px 6px; font-size: var(--fs-sm); font-weight: 500; color: var(--color-text-muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all var(--transition-hover); }
.section-tab:hover { color: var(--color-text-secondary); background: var(--color-primary-light); }
.section-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

.modal-body { flex: 1; overflow-y: auto; padding: 12px 14px; background: rgba(var(--card-surface-rgb), 0.7); backdrop-filter: blur(var(--glass-blur)); }
.sub-label { font-size: var(--fs-sm); font-weight: 600; color: var(--color-text-muted); margin-bottom: var(--space-sm); margin-top: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.sub-label:first-child { margin-top: 0; }
.sub-section { margin-top: var(--space-md); }

.mode-row { display: flex; gap: var(--space-sm); margin-bottom: var(--space-xs); }
.mode-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--space-xs); padding: 6px 0; font-size: var(--fs-base); font-weight: 500; color: var(--color-text-muted); background: var(--color-bg-base); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.mode-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.mode-btn.active { background: var(--color-primary-light); color: var(--color-primary); border-color: var(--color-primary); }

.preset-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-sm); }
.preset-card { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px; background: var(--color-bg-base); border: 2px solid transparent; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.preset-card:hover { border-color: var(--color-primary); }
.preset-card.active { border-color: var(--color-primary); background: var(--color-primary-light); }
.preset-preview { width: 28px; height: 28px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; }
.preset-icon { font-size: var(--fs-md); }
.preset-name { font-size: var(--fs-xs); color: var(--color-text-secondary); font-weight: 500; }

.color-row { display: flex; gap: var(--space-lg); margin-bottom: var(--space-md); }
.color-field { display: flex; align-items: center; gap: var(--space-sm); font-size: var(--fs-base); color: var(--color-text-secondary); cursor: pointer; }
.color-input { width: 28px; height: 28px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; padding: 0; background: none; }
.color-input::-webkit-color-swatch-wrapper { padding: var(--space-2xs); }
.color-input::-webkit-color-swatch { border: none; border-radius: var(--radius-xs); }

.bg-type-row { display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-bottom: var(--space-xs); }
.bg-type-btn { display: flex; align-items: center; gap: 3px; padding: 5px 8px; font-size: var(--fs-sm); font-weight: 500; color: var(--color-text-muted); background: var(--color-bg-base); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.bg-type-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.bg-type-btn.active { background: var(--color-primary-light); color: var(--color-primary); border-color: var(--color-primary); }

.gradient-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-sm); }
.gradient-card { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px; background: var(--color-bg-base); border: 2px solid transparent; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.gradient-card:hover { border-color: var(--color-primary); }
.gradient-card.active { border-color: var(--color-primary); background: var(--color-primary-light); }
.gradient-preview { width: 100%; height: 24px; border-radius: var(--radius-sm); }
.gradient-name { font-size: var(--fs-xs); color: var(--color-text-secondary); font-weight: 500; }

.upload-area { display: flex; align-items: center; justify-content: center; gap: var(--space-sm); padding: var(--space-lg); border: 2px dashed var(--color-border); border-radius: var(--radius-md); cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-md); transition: all var(--transition-hover); }
.upload-area:hover { border-color: var(--color-primary); color: var(--color-primary); }
.hidden-input { display: none; }

.url-row { display: flex; gap: var(--space-sm); }
.url-input { flex: 1; padding: 6px 8px; font-size: var(--fs-base); background: var(--color-bg-base); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); outline: none; }
.url-input:focus { border-color: var(--color-primary); }

.image-preview-wrap { margin-top: var(--space-md); }
.image-preview { width: 100%; height: 80px; border-radius: var(--radius-md); background-size: cover; background-position: center; }

.slider-row { display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-sm); }
.slider-label { font-size: var(--fs-base); color: var(--color-text-secondary); min-width: 60px; }
.slider { flex: 1; accent-color: var(--color-primary); }
.slider-value { font-size: var(--fs-sm); color: var(--color-text-muted); min-width: 36px; text-align: right; font-family: monospace; }

.option-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-sm); margin-bottom: var(--space-xs); }
.option-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-sm); margin-bottom: var(--space-xs); }
.option-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-sm); margin-bottom: var(--space-xs); }
.option-card { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px; background: var(--color-bg-base); border: 2px solid transparent; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.option-card:hover { border-color: var(--color-primary); }
.option-card.active { border-color: var(--color-primary); background: var(--color-primary-light); }
.option-label { font-size: var(--fs-xs); color: var(--color-text-secondary); font-weight: 500; }

.option-preview { width: 100%; height: 24px; background: var(--color-bg-base); border: 1px solid var(--color-border); }
.header-preview.solid { background: var(--color-primary); border: none; }
.header-preview.gradient { background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light)); border: none; }
.header-preview.glass { background: var(--color-primary-light); backdrop-filter: blur(2px); border: 1px solid var(--color-primary-light); }
.header-preview.minimal { background: transparent; border-bottom: 2px solid var(--color-primary); }

.card-preview.flat { background: var(--color-bg-surface); border: none; }
.card-preview.bordered { background: var(--color-bg-surface); border: 1px solid var(--color-border); }
.card-preview.shadowed { background: var(--color-bg-surface); border: none; box-shadow: var(--shadow-sm); }
.card-preview.elevated { background: var(--color-bg-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-md); }
.card-preview.glass { background: rgba(var(--card-surface-rgb), 0.5); backdrop-filter: blur(var(--glass-blur)); border: 1px solid rgba(255,255,255,0.1); }

.radius-demo { width: 20px; height: 20px; background: var(--color-primary); opacity: 0.5; margin: 0 auto; }
.option-card.active .radius-demo { opacity: 1; }
.radius-demo.none { border-radius: 0; }
.radius-demo.small { border-radius: var(--radius-sm); }
.radius-demo.medium { border-radius: var(--radius-md); }
.radius-demo.large { border-radius: var(--radius-lg); }
.radius-demo.full { border-radius: var(--radius-full); }

.font-preview { font-size: var(--fs-2xl); font-weight: 600; color: var(--color-text-primary); line-height: 1.2; }

.lh-preview { font-size: var(--fs-sm); color: var(--color-text-primary); text-align: center; }
.lh-preview.compact { line-height: 1.3; }
.lh-preview.normal { line-height: 1.5; }
.lh-preview.relaxed { line-height: 1.7; }

.anim-icon { font-size: var(--fs-3xl); color: var(--color-text-muted); display: inline-block; }
.anim-icon.off { opacity: 0.3; }
.anim-icon.slow { animation: spin 2s linear infinite; }
.anim-icon.fast { animation: spin 0.5s linear infinite; }

.toggle-btn { display: flex; align-items: center; gap: var(--space-md); width: 100%; padding: 8px 12px; font-size: var(--fs-md); color: var(--color-text-muted); background: var(--color-bg-base); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); margin-top: var(--space-md); }
.toggle-btn:hover { border-color: var(--color-primary); }
.toggle-btn.active { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light); }
.toggle-status { margin-left: auto; font-size: var(--fs-sm); font-weight: 600; padding: 1px 6px; border-radius: var(--radius-sm); }

.density-demo { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; }
.density-line { width: 24px; height: 3px; background: var(--color-primary); border-radius: 2px; opacity: 0.4; }
.density-demo.compact .density-line { height: 2px; margin: 0; }
.density-demo.normal .density-line { height: 3px; margin: 1px 0; }
.density-demo.comfortable .density-line { height: 4px; margin: 2px 0; }
.option-card.active .density-line { opacity: 1; }

.action-row { display: flex; gap: var(--space-sm); margin-bottom: var(--space-md); }
.action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px; font-size: var(--fs-base); font-weight: 500; color: var(--color-text-secondary); background: var(--color-bg-base); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.action-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

.apply-btn { display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; padding: 7px; font-size: var(--fs-md); font-weight: 600; color: var(--color-text-inverse); background: var(--color-primary); border: none; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.apply-btn:hover { filter: brightness(1.1); }
.apply-btn.sm { width: auto; padding: 6px 12px; }

.reset-btn { display: flex; align-items: center; justify-content: center; gap: var(--space-xs); width: 100%; padding: 5px; margin-top: var(--space-xs); font-size: var(--fs-sm); color: var(--color-text-muted); background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-hover); }
.reset-btn:hover { color: var(--color-primary); border-color: var(--color-primary); }

.import-area { margin-bottom: var(--space-md); }
.import-textarea { width: 100%; padding: var(--space-md); font-size: var(--fs-sm); font-family: monospace; background: var(--color-bg-base); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-md); resize: vertical; outline: none; }
.import-textarea:focus { border-color: var(--color-primary); }
.custom-css-textarea { width: 100%; padding: var(--space-md); font-size: var(--fs-sm); font-family: var(--font-mono, ui-monospace, monospace); background: var(--color-bg-base); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-md); resize: vertical; outline: none; tab-size: 2; line-height: 1.5; }
.custom-css-textarea:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-light); }
.hint-text { font-size: var(--fs-sm); color: var(--color-text-muted); margin: 0 0 6px; line-height: 1.4; }
.hint-text code { background: var(--color-primary-light); color: var(--color-primary); padding: 1px 4px; border-radius: var(--radius-xs); font-size: var(--fs-xs); }
</style>
