import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserScript {
  id: string
  name: string
  description: string
  match: string[]
  code: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'userScripts'

function generateId(): string {
  return 'us_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function parseScriptHeader(code: string): { name: string; description: string; match: string[] } {
  const meta = { name: 'Unnamed', description: '', match: [] as string[] }
  const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)
  if (!headerMatch) return meta
  const header = headerMatch[1]
  const nameMatch = header.match(/@name\s+(.+)/)
  if (nameMatch) meta.name = nameMatch[1].trim()
  const descMatch = header.match(/@description\s+(.+)/)
  if (descMatch) meta.description = descMatch[1].trim()
  const matchRegex = /@match\s+(.+)/g
  let m
  while ((m = matchRegex.exec(header)) !== null) {
    meta.match.push(m[1].trim())
  }
  return meta
}

export const useUserScriptsStore = defineStore('userScripts', () => {
  const scripts = ref<UserScript[]>([])
  const showPanel = ref(false)

  async function loadScripts() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      const data = result[STORAGE_KEY]
      if (Array.isArray(data)) {
        scripts.value = data
      }
    } catch { /* ignore */ }
  }

  async function saveScripts() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: scripts.value })
    } catch { /* ignore */ }
  }

  function addScript(code: string): UserScript {
    const parsed = parseScriptHeader(code)
    const script: UserScript = {
      id: generateId(),
      name: parsed.name,
      description: parsed.description,
      match: parsed.match.length > 0 ? parsed.match : ['*://*/*'],
      code,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    scripts.value.push(script)
    saveScripts()
    return script
  }

  function updateScript(id: string, code: string) {
    const idx = scripts.value.findIndex(s => s.id === id)
    if (idx === -1) return
    const parsed = parseScriptHeader(code)
    scripts.value[idx] = {
      ...scripts.value[idx],
      name: parsed.name !== 'Unnamed' ? parsed.name : scripts.value[idx].name,
      description: parsed.description || scripts.value[idx].description,
      match: parsed.match.length > 0 ? parsed.match : scripts.value[idx].match,
      code,
      updatedAt: Date.now(),
    }
    saveScripts()
  }

  function removeScript(id: string) {
    scripts.value = scripts.value.filter(s => s.id !== id)
    saveScripts()
  }

  function toggleScript(id: string) {
    const script = scripts.value.find(s => s.id === id)
    if (script) {
      script.enabled = !script.enabled
      script.updatedAt = Date.now()
      saveScripts()
    }
  }

  function togglePanel() {
    showPanel.value = !showPanel.value
  }

  function getMatchingScripts(url: string): UserScript[] {
    return scripts.value.filter(s => {
      if (!s.enabled) return false
      return s.match.some(pattern => {
        try {
          const regexStr = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\/$/, '/?')
          return new RegExp('^' + regexStr + '$').test(url)
        } catch { return false }
      })
    })
  }

  return {
    scripts,
    showPanel,
    loadScripts,
    addScript,
    updateScript,
    removeScript,
    toggleScript,
    togglePanel,
    getMatchingScripts,
  }
})
