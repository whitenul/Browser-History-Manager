<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useStatsStore } from '@/stores/stats'
import { useHistoryStore } from '@/stores/history'

const ui = useUIStore()
const stats = useStatsStore()
const history = useHistoryStore()

const isActive = ref(false)
const remainingSeconds = ref(0)
const totalSeconds = ref(0)
const timer = ref<ReturnType<typeof setInterval> | null>(null)

const durationOptions = [
  { label: '25分钟', value: 25 },
  { label: '45分钟', value: 45 },
  { label: '60分钟', value: 60 },
  { label: '90分钟', value: 90 },
]

const selectedDuration = ref(25)

const progressPercent = computed(() => {
  if (totalSeconds.value === 0) return 0
  return ((totalSeconds.value - remainingSeconds.value) / totalSeconds.value) * 100
})

const remainingDisplay = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60)
  const s = remainingSeconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const blockedDomains = computed(() => stats.productivity.topUnproductive)

function startFocus() {
  totalSeconds.value = selectedDuration.value * 60
  remainingSeconds.value = totalSeconds.value
  isActive.value = true

  blockedDomains.value.forEach(d => {
    if (!history.blacklistedDomains.includes(d)) {
      history.addBlacklistDomain(d)
    }
  })

  timer.value = setInterval(() => {
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) {
      stopFocus(true)
    }
  }, 1000)
}

function stopFocus(completed: boolean = false) {
  if (timer.value) { clearInterval(timer.value); timer.value = null }
  isActive.value = false
  remainingSeconds.value = 0
  totalSeconds.value = 0

  blockedDomains.value.forEach(d => {
    history.removeBlacklistDomain(d)
  })

  if (completed) {
    ui.notify('🎉 专注时间结束！休息一下吧', 'success')
  } else {
    ui.notifyWithUndo('已退出专注模式', () => {
      blockedDomains.value.forEach(d => history.addBlacklistDomain(d))
    })
  }
}

onUnmounted(() => {
  if (timer.value) clearInterval(timer.value)
})
</script>

<template>
  <div class="focus-card">
    <div class="focus-header">
      <span class="i-lucide:target focus-header-icon" />
      <span class="focus-title">专注模式</span>
      <span v-if="isActive" class="focus-badge active">进行中</span>
    </div>

    <div v-if="!isActive" class="focus-setup">
      <div class="focus-desc">屏蔽低效网站，专注工作</div>
      <div v-if="blockedDomains.length > 0" class="focus-blocked-preview">
        <span class="i-lucide:shield-ban" />
        将屏蔽 {{ blockedDomains.length }} 个低效网站：
        <span v-for="d in blockedDomains.slice(0, 3)" :key="d" class="blocked-tag">{{ d }}</span>
        <span v-if="blockedDomains.length > 3">等{{ blockedDomains.length }}个</span>
      </div>
      <div v-else class="focus-blocked-preview">
        <span class="i-lucide:info" />
        暂无低效网站数据，请先浏览一段时间
      </div>
      <div class="duration-options">
        <button
          v-for="opt in durationOptions"
          :key="opt.value"
          class="duration-btn"
          :class="{ active: selectedDuration === opt.value }"
          @click="selectedDuration = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
      <button class="start-btn" :disabled="blockedDomains.length === 0" @click="startFocus">
        <span class="i-lucide:play" />
        开始专注
      </button>
    </div>

    <div v-else class="focus-active">
      <div class="focus-timer">
        <svg viewBox="0 0 120 120" class="timer-svg">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" stroke-width="4" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="#10b981" stroke-width="4"
            :stroke-dasharray="`${progressPercent * 3.27} 327`"
            stroke-linecap="round" transform="rotate(-90 60 60)" class="timer-ring" />
        </svg>
        <div class="timer-display">{{ remainingDisplay }}</div>
      </div>
      <div class="focus-blocked-info">
        <span class="i-lucide:shield-check" />
        已屏蔽 {{ blockedDomains.length }} 个低效网站
      </div>
      <button class="stop-btn" @click="stopFocus(false)">
        <span class="i-lucide:square" />
        结束专注
      </button>
    </div>
  </div>
</template>

<style scoped>
.focus-card {
  padding: 14px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
}
.focus-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
}
.focus-header-icon { font-size: 16px; color: #10b981; }
.focus-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.focus-badge {
  font-size: 10px; font-weight: 600; padding: 1px 8px;
  border-radius: 4px; margin-left: auto;
}
.focus-badge.active { background: rgba(16,185,129,0.15); color: #10b981; }

.focus-setup { text-align: center; }
.focus-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.focus-blocked-preview {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  flex-wrap: wrap; font-size: 10px; color: var(--text-muted);
  margin-bottom: 10px; line-height: 1.6;
}
.blocked-tag {
  display: inline-block; padding: 1px 5px; font-size: 9px;
  background: rgba(239,68,68,0.1); color: #ef4444;
  border-radius: 3px; max-width: 80px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.duration-options { display: flex; gap: 4px; justify-content: center; margin-bottom: 10px; }
.duration-btn {
  padding: 4px 12px; font-size: 11px; font-weight: 500;
  color: var(--text-muted); background: var(--app-bg);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
}
.duration-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
.duration-btn.active {
  background: var(--primary-light); color: var(--primary-color);
  border-color: var(--primary-color);
}
.start-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 24px; font-size: 13px; font-weight: 600;
  color: white; background: #10b981; border: none;
  border-radius: var(--radius-md); cursor: pointer;
  transition: all var(--transition-fast);
}
.start-btn:hover { background: #059669; }
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.focus-active { text-align: center; }
.focus-timer { position: relative; width: 100px; height: 100px; margin: 0 auto 8px; }
.timer-svg { width: 100%; height: 100%; }
.timer-ring { transition: stroke-dasharray 1s linear; }
.timer-display {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 22px; font-weight: 700; color: #10b981;
  font-variant-numeric: tabular-nums;
}
.focus-blocked-info {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  font-size: 11px; color: var(--text-muted); margin-bottom: 8px;
}
.stop-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 20px; font-size: 12px; font-weight: 500;
  color: #ef4444; background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-md);
  cursor: pointer; transition: all var(--transition-fast);
}
.stop-btn:hover { background: #ef4444; color: white; }
</style>
