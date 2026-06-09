import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserScript {
  id: string
  name: string
  description: string
  match: string[]
  include: string[]
  exclude: string[]
  grant: string[]
  runAt: string
  code: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'userScripts'

function generateId(): string {
  return 'us_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function parseScriptHeader(code: string): Partial<UserScript> {
  const meta: Partial<UserScript> = {
    name: 'Unnamed',
    description: '',
    match: [],
    include: [],
    exclude: [],
    grant: [],
    runAt: 'document-idle',
  }
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
    meta.match!.push(m[1].trim())
  }

  const includeRegex = /@include\s+(.+)/g
  while ((m = includeRegex.exec(header)) !== null) {
    meta.include!.push(m[1].trim())
  }

  const excludeRegex = /@exclude\s+(.+)/g
  while ((m = excludeRegex.exec(header)) !== null) {
    meta.exclude!.push(m[1].trim())
  }

  const runAtMatch = header.match(/@run-at\s+(document-start|document-body|document-end|document-idle)/)
  if (runAtMatch) meta.runAt = runAtMatch[1]

  const grantRegex = /@grant\s+(.+)/g
  while ((m = grantRegex.exec(header)) !== null) {
    meta.grant!.push(m[1].trim())
  }

  return meta
}

async function notifyBackground() {
  try {
    await chrome.runtime.sendMessage({ action: 'registerUserScripts' })
  } catch { /* ignore if background not ready */ }
}

export const useUserScriptsStore = defineStore('userScripts', () => {
  const scripts = ref<UserScript[]>([])
  const showPanel = ref(false)
  const isLoaded = ref(false)
  let loadPromise: Promise<void> | null = null

  async function loadScripts(): Promise<void> {
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY)
        const data = result[STORAGE_KEY]
        if (Array.isArray(data) && data.length > 0) {
          scripts.value = data.map((s: any) => ({
            include: [],
            exclude: [],
            grant: [],
            runAt: 'document-idle',
            ...s,
          }))
        }
        isLoaded.value = true
      } catch (e) {
        console.error('[UserScripts] loadScripts error:', e)
        isLoaded.value = true
      }
    })()
    return loadPromise
  }

  async function saveScripts() {
    try {
      const dataToSave = JSON.parse(JSON.stringify(scripts.value))
      await chrome.storage.local.set({ [STORAGE_KEY]: dataToSave })
    } catch (e) {
      console.error('[UserScripts] saveScripts error:', e)
    }
  }

  async function addScript(code: string): Promise<UserScript> {
    const parsed = parseScriptHeader(code)
    const script: UserScript = {
      id: generateId(),
      name: parsed.name || 'Unnamed',
      description: parsed.description || '',
      match: parsed.match && parsed.match.length > 0 ? parsed.match : ['*://*/*'],
      include: parsed.include || [],
      exclude: parsed.exclude || [],
      grant: parsed.grant || [],
      runAt: parsed.runAt || 'document-idle',
      code,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    scripts.value.push(script)
    await saveScripts()
    notifyBackground()
    return script
  }

  async function updateScript(id: string, code: string) {
    const idx = scripts.value.findIndex(s => s.id === id)
    if (idx === -1) return
    const parsed = parseScriptHeader(code)
    scripts.value[idx] = {
      ...scripts.value[idx],
      name: parsed.name !== 'Unnamed' ? parsed.name! : scripts.value[idx].name,
      description: parsed.description || scripts.value[idx].description,
      match: parsed.match && parsed.match.length > 0 ? parsed.match : scripts.value[idx].match,
      include: parsed.include && parsed.include.length > 0 ? parsed.include : scripts.value[idx].include,
      exclude: parsed.exclude && parsed.exclude.length > 0 ? parsed.exclude : scripts.value[idx].exclude,
      grant: parsed.grant && parsed.grant.length > 0 ? parsed.grant : scripts.value[idx].grant,
      runAt: parsed.runAt || scripts.value[idx].runAt,
      code,
      updatedAt: Date.now(),
    }
    await saveScripts()
    notifyBackground()
  }

  async function removeScript(id: string) {
    scripts.value = scripts.value.filter(s => s.id !== id)
    await saveScripts()
    notifyBackground()
  }

  async function toggleScript(id: string) {
    const script = scripts.value.find(s => s.id === id)
    if (script) {
      script.enabled = !script.enabled
      script.updatedAt = Date.now()
      await saveScripts()
      notifyBackground()
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
    isLoaded,
    loadScripts,
    addScript,
    updateScript,
    removeScript,
    toggleScript,
    togglePanel,
    getMatchingScripts,
  }
})
