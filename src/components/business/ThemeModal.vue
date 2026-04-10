<script setup lang="ts">
import { ref } from 'vue'
import { useThemeStore, PRESET_THEMES, GRADIENT_THEMES } from '@/stores/theme'
import type { RadiusStyle, FontSize, FontFamily, HeaderStyle, CardStyle, AnimationSpeed, ScrollbarStyle, BackgroundPattern } from '@/stores/theme'

const theme = useThemeStore()
const activeSection = ref<'color' | 'layout' | 'typo' | 'effects' | 'advanced'>('color')
const customPrimary = ref(theme.customColors?.primary || '#4f46e5')
const customBg = ref(theme.customColors?.bg || '#f8fafc')
const customText = ref(theme.customColors?.text || '#0f172a')
const customAccent = ref(theme.accentColor || '#f59e0b')
const importText = ref('')
const showImportArea = ref(false)

const sections = [
  { id: 'color' as const, label: '配色', icon: 'i-lucide:palette' },
  { id: 'layout' as const, label: '布局', icon: 'i-lucide:layout' },
  { id: 'typo' as const, label: '排版', icon: 'i-lucide:type' },
  { id: 'effects' as const, label: '效果', icon: 'i-lucide:sparkles' },
  { id: 'advanced' as const, label: '高级', icon: 'i-lucide:settings-2' },
]

const modeOptions = [
  { value: 'auto' as const, label: '跟随系统', icon: 'i-lucide:monitor' },
  { value: 'light' as const, label: '浅色', icon: 'i-lucide:sun' },
  { value: 'dark' as const, label: '深色', icon: 'i-lucide:moon' },
]

const headerOptions: { value: HeaderStyle; label: string; desc: string }[] = [
  { value: 'solid', label: '实色', desc: '纯色填充' },
  { value: 'gradient', label: '渐变', desc: '渐变过渡' },
  { value: 'glass', label: '毛玻璃', desc: '半透明模糊' },
  { value: 'minimal', label: '极简', desc: '无背景色' },
]

const cardOptions: { value: CardStyle; label: string; desc: string }[] = [
  { value: 'flat', label: '扁平', desc: '无边框无阴影' },
  { value: 'bordered', label: '描边', desc: '细边框' },
  { value: 'shadowed', label: '阴影', desc: '柔和投影' },
  { value: 'elevated', label: '悬浮', desc: '强投影+边框' },
]

const radiusOptions: { value: RadiusStyle; label: string; preview: string }[] = [
  { value: 'none', label: '直角', preview: '0px' },
  { value: 'small', label: '小', preview: '4px' },
  { value: 'medium', label: '中', preview: '8px' },
  { value: 'large', label: '大', preview: '16px' },
]

const fontOptions: { value: FontSize; label: string; size: string }[] = [
  { value: 'small', label: '小', size: '11px' },
  { value: 'medium', label: '中', size: '13px' },
  { value: 'large', label: '大', size: '15px' },
]

const fontFamilyOptions: { value: FontFamily; label: string; preview: string }[] = [
  { value: 'system', label: '系统默认', preview: 'Aa' },
  { value: 'serif', label: '衬线体', preview: 'Aa' },
  { value: 'mono', label: '等宽体', preview: 'Aa' },
  { value: 'rounded', label: '圆体', preview: 'Aa' },
]

const animOptions: { value: AnimationSpeed; label: string }[] = [
  { value: 'off', label: '关闭' },
  { value: 'slow', label: '慢' },
  { value: 'normal', label: '正常' },
  { value: 'fast', label: '快' },
]

const scrollOptions: { value: ScrollbarStyle; label: string }[] = [
  { value: 'thin', label: '纤细' },
  { value: 'default', label: '标准' },
  { value: 'hidden', label: '隐藏' },
]

const patternOptions: { value: BackgroundPattern; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'dots', label: '点阵' },
  { value: 'grid', label: '网格' },
  { value: 'diagonal', label: '斜线' },
  { value: 'noise', label: '噪点' },
]

function applyCustom() { theme.setCustomColors({ primary: customPrimary.value, bg: customBg.value, text: customText.value }) }
function applyAccent() { theme.setAccentColor(customAccent.value) }
function clearAccent() { theme.setAccentColor(null) }
function close() { theme.showThemeModal = false }

function doExport() {
  const json = theme.exportConfig()
  navigator.clipboard.writeText(json).then(() => { showImportArea.value = false }).catch(() => { showImportArea.value = true; importText.value = json })
}

function doImport() {
  if (theme.importConfig(importText.value)) { showImportArea.value = false; importText.value = '' }
}
</script>

<template>
  <Teleport to="body">
    <div class="theme-overlay" @click="close">
      <div class="theme-modal" @click.stop>
        <div class="modal-header">
          <span class="i-lucide:palette header-icon" />
          <span class="header-title">主题设置</span>
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
            <div class="sub-label">外观模式</div>
            <div class="mode-row">
              <button v-for="opt in modeOptions" :key="opt.value" class="mode-btn" :class="{ active: theme.mode === opt.value }" @click="theme.setMode(opt.value)">
                <span :class="opt.icon" />{{ opt.label }}
              </button>
            </div>
            <div class="sub-label">主题色板</div>
            <div class="preset-grid">
              <button v-for="p in PRESET_THEMES" :key="p.id" class="preset-card" :class="{ active: theme.activePreset === p.id && !theme.activeGradient && !theme.customColors }" @click="theme.setPreset(p.id)">
                <div class="preset-preview" :style="{ backgroundColor: p.light['--primary-color'] }"><span class="preset-icon">{{ p.icon }}</span></div>
                <span class="preset-name">{{ p.name }}</span>
              </button>
            </div>
            <div class="sub-label">渐变主题</div>
            <div class="gradient-grid">
              <button v-for="g in GRADIENT_THEMES" :key="g.name" class="gradient-card" :class="{ active: theme.activeGradient === g.gradient }" @click="theme.setGradient(g.gradient)">
                <div class="gradient-preview" :style="{ background: g.gradient }" />
                <span class="gradient-name">{{ g.name }}</span>
              </button>
            </div>
            <div class="sub-label">自定义颜色</div>
            <div class="color-row">
              <label class="color-field"><span class="color-label">主色调</span><div class="color-input-wrap"><input type="color" v-model="customPrimary" class="color-input" /><span class="color-hex">{{ customPrimary }}</span></div></label>
              <label class="color-field"><span class="color-label">背景色</span><div class="color-input-wrap"><input type="color" v-model="customBg" class="color-input" /><span class="color-hex">{{ customBg }}</span></div></label>
              <label class="color-field"><span class="color-label">文字色</span><div class="color-input-wrap"><input type="color" v-model="customText" class="color-input" /><span class="color-hex">{{ customText }}</span></div></label>
            </div>
            <button class="apply-btn" @click="applyCustom"><span class="i-lucide:check" />应用自定义颜色</button>
            <div class="sub-label" style="margin-top:12px">强调色</div>
            <div class="accent-row">
              <label class="color-field"><span class="color-label">强调色</span><div class="color-input-wrap"><input type="color" v-model="customAccent" class="color-input" /><span class="color-hex">{{ customAccent }}</span></div></label>
              <button class="apply-btn sm" @click="applyAccent">应用</button>
              <button v-if="theme.accentColor" class="reset-btn sm" @click="clearAccent">清除</button>
            </div>
          </div>

          <!-- 布局 -->
          <div v-if="activeSection === 'layout'">
            <div class="sub-label">头部风格</div>
            <div class="option-grid-4">
              <button v-for="opt in headerOptions" :key="opt.value" class="option-card" :class="{ active: theme.headerStyle === opt.value }" @click="theme.setHeaderStyle(opt.value)">
                <div class="option-preview header-preview" :class="opt.value" />
                <span class="option-label">{{ opt.label }}</span>
                <span class="option-desc">{{ opt.desc }}</span>
              </button>
            </div>
            <div class="sub-label">卡片风格</div>
            <div class="option-grid-4">
              <button v-for="opt in cardOptions" :key="opt.value" class="option-card" :class="{ active: theme.cardStyle === opt.value }" @click="theme.setCardStyle(opt.value)">
                <div class="option-preview card-preview" :class="opt.value" />
                <span class="option-label">{{ opt.label }}</span>
                <span class="option-desc">{{ opt.desc }}</span>
              </button>
            </div>
            <div class="sub-label">圆角风格</div>
            <div class="option-grid-4">
              <button v-for="opt in radiusOptions" :key="opt.value" class="option-card" :class="{ active: theme.radiusStyle === opt.value }" @click="theme.setRadiusStyle(opt.value)">
                <div class="option-preview radius-preview" :style="{ borderRadius: opt.preview }" />
                <span class="option-label">{{ opt.label }}</span>
              </button>
            </div>
            <div class="sub-label">紧凑模式</div>
            <button class="toggle-btn" :class="{ active: theme.compactMode }" @click="theme.toggleCompact()">
              <span class="i-lucide:minimize-2" />紧凑模式<span class="toggle-status">{{ theme.compactMode ? '开' : '关' }}</span>
            </button>
          </div>

          <!-- 排版 -->
          <div v-if="activeSection === 'typo'">
            <div class="sub-label">字体大小</div>
            <div class="option-grid-3">
              <button v-for="opt in fontOptions" :key="opt.value" class="option-card" :class="{ active: theme.fontSize === opt.value }" @click="theme.setFontSize(opt.value)">
                <span class="font-preview" :style="{ fontSize: opt.size }">Aa</span>
                <span class="option-label">{{ opt.label }}</span>
              </button>
            </div>
            <div class="sub-label">字体族</div>
            <div class="option-grid-4">
              <button v-for="opt in fontFamilyOptions" :key="opt.value" class="option-card" :class="{ active: theme.fontFamily === opt.value }" @click="theme.setFontFamily(opt.value)">
                <span class="font-preview" :style="{ fontFamily: opt.value === 'system' ? 'system-ui' : opt.value === 'serif' ? 'Georgia, serif' : opt.value === 'mono' ? 'Consolas, monospace' : 'system-ui' }">{{ opt.preview }}</span>
                <span class="option-label">{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <!-- 效果 -->
          <div v-if="activeSection === 'effects'">
            <div class="sub-label">动画速度</div>
            <div class="option-grid-4">
              <button v-for="opt in animOptions" :key="opt.value" class="option-card" :class="{ active: theme.animationSpeed === opt.value }" @click="theme.setAnimationSpeed(opt.value)">
                <span class="anim-icon" :class="{ off: opt.value === 'off', slow: opt.value === 'slow', fast: opt.value === 'fast' }">⟳</span>
                <span class="option-label">{{ opt.label }}</span>
              </button>
            </div>
            <div class="sub-label">滚动条</div>
            <div class="option-grid-3">
              <button v-for="opt in scrollOptions" :key="opt.value" class="option-card" :class="{ active: theme.scrollbarStyle === opt.value }" @click="theme.setScrollbarStyle(opt.value)">
                <div class="scrollbar-preview" :class="opt.value" />
                <span class="option-label">{{ opt.label }}</span>
              </button>
            </div>
            <div class="sub-label">背景纹理</div>
            <div class="option-grid-5">
              <button v-for="opt in patternOptions" :key="opt.value" class="option-card" :class="{ active: theme.backgroundPattern === opt.value }" @click="theme.setBackgroundPattern(opt.value)">
                <div class="pattern-preview" :class="opt.value" />
                <span class="option-label">{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <!-- 高级 -->
          <div v-if="activeSection === 'advanced'">
            <div class="sub-label">导入/导出</div>
            <div class="action-row">
              <button class="action-btn" @click="doExport"><span class="i-lucide:download" />导出配置</button>
              <button class="action-btn" @click="showImportArea = !showImportArea"><span class="i-lucide:upload" />导入配置</button>
            </div>
            <div v-if="showImportArea" class="import-area">
              <textarea v-model="importText" class="import-textarea" placeholder="粘贴主题配置 JSON..." rows="4" />
              <button class="apply-btn" @click="doImport"><span class="i-lucide:check" />应用导入</button>
            </div>
            <div class="sub-label" style="margin-top:16px">重置</div>
            <button class="danger-btn" @click="theme.resetAll()"><span class="i-lucide:rotate-ccw" />重置所有主题设置</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.theme-overlay { position: fixed; inset: 0; z-index: 400; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.theme-modal { width: 380px; max-height: 520px; background: var(--app-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; }
.modal-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border-color); }
.header-icon { font-size: 16px; color: var(--primary-color); }
.header-title { font-size: 14px; font-weight: 600; flex: 1; }
.close-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 14px; border-radius: var(--radius-sm); }
.close-btn:hover { background: var(--primary-light); color: var(--text-primary); }

.section-tabs { display: flex; border-bottom: 1px solid var(--border-color); }
.section-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 3px; padding: 8px 0; font-size: 11px; font-weight: 500; color: var(--text-muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all var(--transition-fast); }
.section-tab:hover { color: var(--text-secondary); background: var(--primary-light); }
.section-tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }

.modal-body { flex: 1; overflow-y: auto; padding: 12px 14px; }
.sub-label { font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
.sub-label:first-child { margin-top: 0; }

.mode-row { display: flex; gap: 6px; margin-bottom: 4px; }
.mode-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 0; font-size: 11px; font-weight: 500; color: var(--text-muted); background: var(--app-bg); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.mode-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
.mode-btn.active { background: var(--primary-light); color: var(--primary-color); border-color: var(--primary-color); }

.preset-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.preset-card { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px; background: var(--app-bg); border: 2px solid transparent; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.preset-card:hover { border-color: var(--primary-color); }
.preset-card.active { border-color: var(--primary-color); background: var(--primary-light); }
.preset-preview { width: 28px; height: 28px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; }
.preset-icon { font-size: 12px; }
.preset-name { font-size: 9px; color: var(--text-secondary); font-weight: 500; }

.gradient-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.gradient-card { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px; background: var(--app-bg); border: 2px solid transparent; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.gradient-card:hover { border-color: var(--primary-color); }
.gradient-card.active { border-color: var(--primary-color); background: var(--primary-light); }
.gradient-preview { width: 100%; height: 24px; border-radius: var(--radius-sm); }
.gradient-name { font-size: 9px; color: var(--text-secondary); font-weight: 500; }

.color-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.color-field { display: flex; align-items: center; justify-content: space-between; }
.color-label { font-size: 11px; color: var(--text-secondary); }
.color-input-wrap { display: flex; align-items: center; gap: 6px; }
.color-input { width: 28px; height: 28px; border: 2px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer; padding: 0; background: none; }
.color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.color-input::-webkit-color-swatch { border: none; border-radius: 2px; }
.color-hex { font-size: 10px; color: var(--text-muted); font-family: monospace; }

.accent-row { display: flex; align-items: center; gap: 6px; }
.accent-row .color-field { flex: 1; }

.apply-btn { display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; padding: 7px; font-size: 12px; font-weight: 600; color: white; background: var(--primary-color); border: none; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.apply-btn:hover { opacity: 0.9; }
.apply-btn.sm { width: auto; padding: 4px 10px; font-size: 11px; }

.reset-btn { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; padding: 5px; margin-top: 4px; font-size: 10px; color: var(--text-muted); background: transparent; border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.reset-btn:hover { color: var(--primary-color); border-color: var(--primary-color); }
.reset-btn.sm { width: auto; padding: 4px 8px; margin-top: 0; }

.option-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 4px; }
.option-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 4px; }
.option-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 4px; }
.option-card { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px; background: var(--app-bg); border: 2px solid transparent; border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.option-card:hover { border-color: var(--primary-color); }
.option-card.active { border-color: var(--primary-color); background: var(--primary-light); }
.option-label { font-size: 9px; color: var(--text-secondary); font-weight: 500; }
.option-desc { font-size: 8px; color: var(--text-muted); }

.option-preview { width: 100%; height: 24px; background: var(--app-bg); border: 1px solid var(--border-color); }
.header-preview.solid { background: var(--primary-color); border: none; }
.header-preview.gradient { background: linear-gradient(90deg, var(--primary-color), rgba(99,102,241,0.5)); border: none; }
.header-preview.glass { background: rgba(99,102,241,0.2); backdrop-filter: blur(2px); border: 1px solid rgba(99,102,241,0.3); }
.header-preview.minimal { background: transparent; border-bottom: 2px solid var(--primary-color); }

.card-preview.flat { background: var(--app-surface); border: none; }
.card-preview.bordered { background: var(--app-surface); border: 1px solid var(--border-color); }
.card-preview.shadowed { background: var(--app-surface); border: none; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
.card-preview.elevated { background: var(--app-surface); border: 1px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }

.radius-preview { width: 20px; height: 20px; background: var(--primary-color); opacity: 0.5; margin: 0 auto; }
.option-card.active .radius-preview { opacity: 1; }

.font-preview { font-size: 16px; font-weight: 600; color: var(--text-primary); line-height: 1.2; }

.anim-icon { font-size: 18px; color: var(--text-muted); display: inline-block; }
.anim-icon.off { opacity: 0.3; }
.anim-icon.slow { animation: spin 2s linear infinite; }
.anim-icon.fast { animation: spin 0.5s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

.scrollbar-preview { width: 6px; height: 24px; background: var(--border-color); margin: 0 auto; border-radius: 3px; }
.scrollbar-preview.default { width: 10px; }
.scrollbar-preview.hidden { opacity: 0.2; width: 2px; }

.pattern-preview { width: 100%; height: 24px; border: 1px solid var(--border-color); border-radius: 2px; }
.pattern-preview.dots { background-image: radial-gradient(circle, var(--text-muted) 0.5px, transparent 0.5px); background-size: 6px 6px; opacity: 0.3; }
.pattern-preview.grid { background-image: linear-gradient(var(--border-color) 1px, transparent 1px), linear-gradient(90deg, var(--border-color) 1px, transparent 1px); background-size: 8px 8px; opacity: 0.5; }
.pattern-preview.diagonal { background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, var(--border-color) 4px, var(--border-color) 5px); opacity: 0.5; }
.pattern-preview.noise { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E"); opacity: 0.5; }

.toggle-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; font-size: 12px; color: var(--text-muted); background: var(--app-bg); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.toggle-btn:hover { border-color: var(--primary-color); }
.toggle-btn.active { border-color: var(--primary-color); color: var(--primary-color); background: var(--primary-light); }
.toggle-status { margin-left: auto; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; }
.toggle-btn.active .toggle-status { background: rgba(99,102,241,0.15); }

.action-row { display: flex; gap: 6px; margin-bottom: 8px; }
.action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px; font-size: 11px; font-weight: 500; color: var(--text-secondary); background: var(--app-bg); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.action-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }

.import-area { margin-bottom: 8px; }
.import-textarea { width: 100%; padding: 8px; font-size: 10px; font-family: monospace; background: var(--app-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); resize: vertical; outline: none; }
.import-textarea:focus { border-color: var(--primary-color); }

.danger-btn { display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; padding: 7px; font-size: 12px; font-weight: 500; color: #ef4444; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.danger-btn:hover { background: #ef4444; color: white; }
</style>
