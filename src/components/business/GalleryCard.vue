<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const props = defineProps<{
  icon: string
  title: string
  themeColor: string
  value: string | number
  subtitle: string
  index: number
  active: boolean
  dragging?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const cardRef = ref<HTMLElement | null>(null)
const tiltX = ref(0)
const tiltY = ref(0)
const isHovered = ref(false)

const cardStyle = computed(() => {
  const angle = props.index * 45
  return {
    '--card-angle': `${angle}deg`,
    '--theme': props.themeColor,
    '--tilt-x': `${props.dragging ? 0 : tiltX.value}deg`,
    '--tilt-y': `${props.dragging ? 0 : tiltY.value}deg`,
  }
})

function onMouseMove(e: MouseEvent) {
  if (props.dragging || !cardRef.value) return
  const rect = cardRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width - 0.5
  const y = (e.clientY - rect.top) / rect.height - 0.5
  tiltX.value = -y * 12
  tiltY.value = x * 12
  isHovered.value = true
}

function onMouseLeave() {
  tiltX.value = 0
  tiltY.value = 0
  isHovered.value = false
}
</script>

<template>
  <div
    ref="cardRef"
    class="gallery-card"
    :class="{ 'is-active': active, 'is-hovered': isHovered }"
    :style="cardStyle"
    @click="emit('click')"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="card-glow" />
    <div class="card-shine" />
    <div class="card-content">
      <div class="card-header">
        <div class="card-icon-wrap" :style="{ background: themeColor + '20' }">
          <span :class="icon" class="card-icon" :style="{ color: themeColor }" />
        </div>
        <span class="card-title">{{ title }}</span>
      </div>
      <div class="card-value-row">
        <span class="card-value" :style="{ color: themeColor }">{{ value }}</span>
        <span class="card-subtitle">{{ subtitle }}</span>
      </div>
      <div class="card-peek">
        <slot />
      </div>
      <div v-if="active" class="card-enter-hint">
        <span class="i-lucide:arrow-right" />
        {{ t('stats.clickToView') }}
      </div>
    </div>
    <div class="card-border-glow" :style="{ '--theme': themeColor }" />
  </div>
</template>

<style scoped>
.gallery-card {
  position: absolute;
  width: 240px;
  height: 180px;
  left: 50%;
  top: 50%;
  margin-left: -120px;
  margin-top: -90px;
  transform: rotateY(var(--card-angle)) translateZ(240px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
  backface-visibility: hidden;
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1),
              box-shadow 0.4s ease,
              opacity 0.5s ease;
  will-change: transform;
  opacity: 1;
  pointer-events: none;
}

.gallery-card.is-active {
  pointer-events: auto;
}

.gallery-card:hover {
  transform: rotateY(var(--card-angle)) translateZ(270px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) scale(1.06);
}

.gallery-card.is-active {
  pointer-events: auto;
  transform: rotateY(var(--card-angle)) translateZ(290px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) scale(1.1);
}

.card-glow {
  position: absolute;
  inset: -2px;
  border-radius: 18px;
  background: conic-gradient(from var(--card-angle), var(--theme), transparent 40%, transparent 60%, var(--theme));
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: 0;
  animation: glowRotate 4s linear infinite;
}

.gallery-card.is-active .card-glow {
  opacity: 0.6;
}

.gallery-card:hover .card-glow {
  opacity: 0.4;
}

@keyframes glowRotate {
  to { filter: hue-rotate(30deg); }
}

.card-shine {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(255,255,255,0.15) 0%,
    rgba(255,255,255,0.02) 40%,
    transparent 60%
  );
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.gallery-card:hover .card-shine,
.gallery-card.is-active .card-shine {
  opacity: 1;
}

.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  height: 100%;
  background: rgba(var(--app-surface-rgb, 255,255,255), 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon {
  font-size: 14px;
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.card-value-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.card-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.card-subtitle {
  font-size: 9px;
  color: var(--text-muted);
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}

.card-peek {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.card-enter-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 0 0;
  font-size: 9px;
  font-weight: 500;
  color: var(--theme);
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.3s ease;
}

.gallery-card.is-active .card-enter-hint {
  opacity: 1;
  transform: translateX(0);
  animation: hintPulse 2s ease-in-out infinite;
}

@keyframes hintPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.card-border-glow {
  position: absolute;
  inset: -1px;
  border-radius: 17px;
  border: 1.5px solid transparent;
  pointer-events: none;
  z-index: 3;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.gallery-card:hover .card-border-glow {
  border-color: var(--theme);
  box-shadow: 0 0 12px var(--theme)40;
}

.gallery-card.is-active .card-border-glow {
  border-color: var(--theme);
  box-shadow: 0 0 20px var(--theme)50, 0 0 40px var(--theme)20;
  animation: borderPulse 2s ease-in-out infinite;
}

@keyframes borderPulse {
  0%, 100% { box-shadow: 0 0 20px var(--theme)50, 0 0 40px var(--theme)20; }
  50% { box-shadow: 0 0 30px var(--theme)60, 0 0 60px var(--theme)30; }
}
</style>
