<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const history = useHistoryStore()
const { t } = useI18n()

const ruleName = ref('')
const rulePattern = ref('')
const ruleType = ref('domain')
const editingId = ref<string | null>(null)
const regexError = ref('')

const TYPE_OPTIONS = computed(() => [
  { value: 'domain', label: t('groupRule.typeDomain'), hint: t('groupRule.typeDomainHint') },
  { value: 'path', label: t('groupRule.typePath'), hint: t('groupRule.typePathHint') },
  { value: 'regex', label: t('groupRule.typeRegex'), hint: t('groupRule.typeRegexHint') },
])

const selectedTypeHint = computed(() => TYPE_OPTIONS.value.find(o => o.value === ruleType.value)?.hint || '')

const isDuplicate = computed(() => {
  const name = ruleName.value.trim()
  if (!name) return false
  return history.customRules.some(r => r.name === name && r.id !== editingId.value)
})

const matchPreview = computed(() => {
  if (!rulePattern.value.trim()) return { total: 0, sample: [] as string[] }
  const rule = { pattern: rulePattern.value.trim(), type: ruleType.value }
  if (ruleType.value === 'regex') {
    try { new RegExp(rule.pattern) } catch { return { total: -1, sample: [] } }
  }
  let count = 0
  const samples: string[] = []
  for (const r of history.allRecords) {
    const domain = r.domain
    let matched = false
    switch (rule.type) {
      case 'domain': matched = domain === rule.pattern || domain.endsWith('.' + rule.pattern); break
      case 'path': matched = r.url.includes(rule.pattern); break
      case 'regex':
        try { matched = new RegExp(rule.pattern).test(r.url) } catch { matched = false }
        break
    }
    if (matched) {
      count++
      if (samples.length < 3) samples.push(r.domain)
    }
  }
  return { total: count, sample: samples }
})

function validateRegex() {
  regexError.value = ''
  if (ruleType.value !== 'regex' || !rulePattern.value.trim()) return true
  try {
    new RegExp(rulePattern.value.trim())
    return true
  } catch (e) {
    regexError.value = t('groupRule.regexInvalid')
    return false
  }
}

function addRule() {
  const name = ruleName.value.trim()
  const pattern = rulePattern.value.trim()
  if (!name || !pattern || isDuplicate.value) return
  if (!validateRegex()) return

  if (editingId.value) {
    const idx = history.customRules.findIndex(r => r.id === editingId.value)
    if (idx >= 0) {
      const updated = [...history.customRules]
      updated[idx] = { ...updated[idx], name, pattern, type: ruleType.value }
      history.customRules = updated
      history.saveCustomRules()
      if (history.groupMode === 'custom') history.applyFilters()
    }
    editingId.value = null
  } else {
    history.addCustomRule(name, pattern, ruleType.value)
  }
  ruleName.value = ''
  rulePattern.value = ''
  regexError.value = ''
}

function editRule(rule: { id: string; name: string; pattern: string; type: string }) {
  editingId.value = rule.id
  ruleName.value = rule.name
  rulePattern.value = rule.pattern
  ruleType.value = rule.type
  regexError.value = ''
}

function cancelEdit() {
  editingId.value = null
  ruleName.value = ''
  rulePattern.value = ''
  ruleType.value = 'domain'
  regexError.value = ''
}

function moveRuleUp(index: number) {
  if (index <= 0) return
  const rules = [...history.customRules]
  ;[rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]
  history.customRules = rules
  history.saveCustomRules()
  if (history.groupMode === 'custom') history.applyFilters()
}

function moveRuleDown(index: number) {
  const rules = [...history.customRules]
  if (index >= rules.length - 1) return
  ;[rules[index], rules[index + 1]] = [rules[index + 1], rules[index]]
  history.customRules = rules
  history.saveCustomRules()
  if (history.groupMode === 'custom') history.applyFilters()
}

function clearAllRules() {
  history.customRules = []
  history.saveCustomRules()
  if (history.groupMode === 'custom') history.applyFilters()
}

function getTypeLabel(type: string) {
  return TYPE_OPTIONS.value.find(o => o.value === type)?.label || type
}
</script>

<template>
  <div class="modal-overlay" @click.self="ui.showGroupRuleModal = false">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ t('groupRule.modalTitle') }}</h3>
        <button class="close-btn" @click="ui.showGroupRuleModal = false">
          <span class="i-lucide:x" />
        </button>
      </div>

      <div class="rule-form">
        <input v-model="ruleName" type="text" :placeholder="t('groupRule.ruleNamePlaceholder')" class="rule-input"
          :class="{ error: isDuplicate }" maxlength="20" />
        <span v-if="isDuplicate" class="field-error">{{ t('groupRule.ruleNameDuplicate') }}</span>

        <select v-model="ruleType" class="rule-select">
          <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <span class="type-hint">{{ selectedTypeHint }}</span>

        <input v-model="rulePattern" type="text" :placeholder="t('groupRule.matchContentPlaceholder')" class="rule-input"
          :class="{ error: !!regexError }" @input="validateRegex" />
        <span v-if="regexError" class="field-error">{{ regexError }}</span>

        <div v-if="rulePattern.trim() && matchPreview.total >= 0" class="match-preview">
          <span class="i-lucide:search preview-icon" />
          <span>{{ t('groupRule.matchWillMatch') }} <strong>{{ matchPreview.total }}</strong> {{ t('groupRule.matchRecords') }}</span>
          <span v-if="matchPreview.sample.length" class="preview-samples">
            （{{ matchPreview.sample.join(t('groupRule.matchPreviewSeparator')) }}{{ matchPreview.total > 3 ? t('groupRule.matchPreviewEtc') : '' }}）
          </span>
        </div>

        <div class="form-actions">
          <button class="btn-primary" @click="addRule" :disabled="!ruleName.trim() || !rulePattern.trim() || isDuplicate || !!regexError">
            {{ editingId ? t('groupRule.saveEdit') : t('groupRule.addRule') }}
          </button>
          <button v-if="editingId" class="btn-secondary" @click="cancelEdit">{{ t('groupRule.cancel') }}</button>
        </div>
      </div>

      <div class="rule-list-header">
        <span class="list-title">{{ t('groupRule.existingRules', { count: history.customRules.length }) }}</span>
        <button v-if="history.customRules.length" class="clear-all-btn" @click="clearAllRules">{{ t('groupRule.clearAll') }}</button>
      </div>

      <div class="rule-list">
        <div v-if="!history.customRules.length" class="empty-hint">{{ t('groupRule.emptyHint') }}</div>
        <div v-for="(rule, idx) in history.customRules" :key="rule.id" class="rule-row" :class="{ editing: editingId === rule.id }">
          <div class="rule-order">
            <button class="order-btn" :disabled="idx === 0" @click="moveRuleUp(idx)">
              <span class="i-lucide:chevron-up" />
            </button>
            <button class="order-btn" :disabled="idx === history.customRules.length - 1" @click="moveRuleDown(idx)">
              <span class="i-lucide:chevron-down" />
            </button>
          </div>
          <div class="rule-info">
            <span class="rule-name">{{ rule.name }}</span>
            <span class="rule-pattern">{{ rule.pattern }} · {{ getTypeLabel(rule.type) }}</span>
          </div>
          <button class="edit-btn" @click="editRule(rule)" :title="t('groupRule.editTitle')">
            <span class="i-lucide:pencil" />
          </button>
          <button class="remove-btn" @click="history.removeCustomRule(rule.id)" :title="t('groupRule.deleteTitle')">
            <span class="i-lucide:trash-2" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: var(--color-bg-overlay);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; animation: fadeIn var(--transition-hover);
}
.modal-content {
  width: 360px; max-height: 480px; overflow-y: auto;
  background: var(--color-bg-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); padding: 20px;
  animation: slideUp var(--transition-modal);
}

.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.modal-header h3 { font-size: var(--fs-2xl); font-weight: 600; margin: 0; color: var(--color-text-primary); }
.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-2xl);
}
.close-btn:hover { background: var(--color-primary-light); }

.rule-form { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.rule-input {
  padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  font-size: var(--fs-md); outline: none; background: var(--color-bg-surface); color: var(--color-text-primary);
}
.rule-input:focus { border-color: var(--color-primary); }
.rule-input.error { border-color: var(--color-danger); }
.rule-select {
  padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  font-size: var(--fs-md); outline: none; background: var(--color-bg-surface); color: var(--color-text-primary);
}
.type-hint { font-size: var(--fs-sm); color: var(--color-text-muted); margin-top: -2px; }
.field-error { font-size: var(--fs-sm); color: var(--color-danger); margin-top: -2px; }

.match-preview {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 10px; background: var(--color-primary-light);
  border-radius: var(--radius-sm); font-size: var(--fs-base); color: var(--color-text-secondary);
}
.preview-icon { font-size: var(--fs-md); color: var(--color-primary); flex-shrink: 0; }
.preview-samples { color: var(--color-text-muted); }

.form-actions { display: flex; gap: 6px; margin-top: 4px; }
.btn-primary {
  flex: 1; padding: 7px 14px; border: none; border-radius: var(--radius-sm);
  background: var(--color-primary); color: var(--color-text-inverse); font-size: var(--fs-md); font-weight: 500;
  cursor: pointer; transition: all var(--transition-hover);
}
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.9; }
.btn-secondary {
  padding: 7px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-bg-surface); color: var(--color-text-secondary); font-size: var(--fs-md);
  cursor: pointer; transition: all var(--transition-hover);
}
.btn-secondary:hover { border-color: var(--color-primary); color: var(--color-primary); }

.rule-list-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; padding-top: 8px; border-top: 1px solid var(--color-border);
}
.list-title { font-size: var(--fs-md); font-weight: 600; color: var(--color-text-secondary); }
.clear-all-btn {
  font-size: var(--fs-base); color: var(--color-danger); background: none; border: none;
  cursor: pointer; padding: 2px 6px; border-radius: var(--radius-sm);
}
.clear-all-btn:hover { background: var(--color-danger-light); }

.rule-list {}
.empty-hint { font-size: var(--fs-lg); color: var(--color-text-muted); text-align: center; padding: 16px; }
.rule-row {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 4px; border-bottom: 1px solid var(--color-border);
  transition: background var(--transition-hover);
}
.rule-row.editing { background: var(--color-primary-light); }
.rule-order { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
.order-btn {
  width: 18px; height: 14px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; cursor: pointer;
  color: var(--color-text-muted); font-size: var(--fs-sm); border-radius: 2px;
}
.order-btn:hover { background: var(--color-primary-light); color: var(--color-primary); }
.order-btn:disabled { opacity: 0.2; cursor: not-allowed; }
.rule-info { flex: 1; min-width: 0; }
.rule-name { font-size: var(--fs-lg); font-weight: 500; color: var(--color-text-primary); display: block; }
.rule-pattern { font-size: var(--fs-base); color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.edit-btn {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: var(--radius-sm);
  cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-md);
}
.edit-btn:hover { background: var(--color-primary-light); color: var(--color-primary); }
.remove-btn {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: var(--radius-sm);
  cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-lg);
}
.remove-btn:hover { color: var(--color-danger); background: var(--color-danger-light); }
</style>
