import { ref, computed } from 'vue'

export interface DiagnosticIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  category: string
  message: string
  details?: string
  timestamp: number
  resolved: boolean
}

export interface SystemStatus {
  storageAvailable: boolean
  permissionsGranted: boolean
  extensionEnabled: boolean
  chromeVersion: string
  manifestVersion: number
  lastUpdate: number
}

const issues = ref<DiagnosticIssue[]>([])
const systemStatus = ref<SystemStatus | null>(null)
const isDiagnosticEnabled = ref(true)

let issueIdCounter = 0

function generateIssueId(): string {
  return `issue-${Date.now()}-${++issueIdCounter}`
}

export function useDiagnostics() {
  const activeIssues = computed(() => issues.value.filter(i => !i.resolved))
  
  function addIssue(
    severity: 'error' | 'warning' | 'info',
    category: string,
    message: string,
    details?: string
  ): string {
    if (!isDiagnosticEnabled.value) return ''
    
    const issue: DiagnosticIssue = {
      id: generateIssueId(),
      severity,
      category,
      message,
      details,
      timestamp: Date.now(),
      resolved: false,
    }
    
    issues.value.unshift(issue)
    
    if (issues.value.length > 100) {
      issues.value = issues.value.slice(0, 100)
    }
    
    console.log(`[Diagnostics] [${severity.toUpperCase()}] ${category}: ${message}`, details)
    
    return issue.id
  }
  
  function resolveIssue(issueId: string): boolean {
    const index = issues.value.findIndex(i => i.id === issueId)
    if (index !== -1) {
      issues.value[index].resolved = true
      return true
    }
    return false
  }
  
  function resolveAllIssues(): void {
    issues.value.forEach(i => { i.resolved = true })
  }
  
  function removeIssue(issueId: string): boolean {
    const index = issues.value.findIndex(i => i.id === issueId)
    if (index !== -1) {
      issues.value.splice(index, 1)
      return true
    }
    return false
  }
  
  async function checkSystemStatus(): Promise<SystemStatus> {
    let storageAvailable = true
    let permissionsGranted = true
    let extensionEnabled = true
    
    try {
      await chrome.storage.local.get('__diagnostics_test__')
    } catch {
      storageAvailable = false
      addIssue('error', 'storage', 'Chrome storage API unavailable', 'Cannot access chrome.storage.local')
    }
    
    try {
      const permissions = await chrome.permissions.getAll()
      const requiredPermissions = ['history', 'storage', 'bookmarks', 'sidePanel'] as const
      permissionsGranted = requiredPermissions.every(
        p => (permissions.permissions as string[])?.includes(p) || permissions.origins?.some(o => o === '<all_urls>')
      )
    } catch {
      permissionsGranted = false
      addIssue('warning', 'permissions', 'Cannot check permissions', 'Cannot access chrome.permissions API')
    }
    
    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'
    const manifestVersion = chrome.runtime.getManifest().manifest_version || 3
    
    systemStatus.value = {
      storageAvailable,
      permissionsGranted,
      extensionEnabled,
      chromeVersion,
      manifestVersion,
      lastUpdate: Date.now(),
    }
    
    return systemStatus.value
  }
  
  function logError(context: string, message: string, details?: string): void {
    addIssue('error', context, message, details)
  }
  
  function logWarning(context: string, message: string, details?: string): void {
    addIssue('warning', context, message, details)
  }
  
  function logInfo(context: string, message: string): void {
    addIssue('info', context, message)
  }
  
  function getIssueSummary() {
    const counts = {
      total: issues.value.length,
      active: activeIssues.value.length,
      errors: activeIssues.value.filter(i => i.severity === 'error').length,
      warnings: activeIssues.value.filter(i => i.severity === 'warning').length,
      info: activeIssues.value.filter(i => i.severity === 'info').length,
    }
    return counts
  }
  
  function exportLogs(): string {
    const logData = {
      timestamp: Date.now(),
      systemStatus: systemStatus.value,
      issues: issues.value,
      chromeVersion: navigator.userAgent,
    }
    return JSON.stringify(logData, null, 2)
  }
  
  function enableDiagnostics(): void {
    isDiagnosticEnabled.value = true
  }
  
  function disableDiagnostics(): void {
    isDiagnosticEnabled.value = false
  }
  
  return {
    issues,
    activeIssues,
    systemStatus,
    isDiagnosticEnabled,
    addIssue,
    resolveIssue,
    resolveAllIssues,
    removeIssue,
    checkSystemStatus,
    logError,
    logWarning,
    logInfo,
    getIssueSummary,
    exportLogs,
    enableDiagnostics,
    disableDiagnostics,
  }
}

export function useErrorBoundary() {
  const errors = ref<Error[]>([])
  
  function handleError(error: Error, info: { componentStack?: string }) {
    errors.value.push(error)
    
    console.error('[ErrorBoundary] Caught error:', error)
    if (info.componentStack) {
      console.error('[ErrorBoundary] Component stack:', info.componentStack)
    }
    
    const diagnostics = useDiagnostics()
    diagnostics.logError('component', error.message, info.componentStack)
    
    if (errors.value.length > 50) {
      errors.value = errors.value.slice(-50)
    }
  }
  
  function clearErrors(): void {
    errors.value = []
  }
  
  return {
    errors,
    handleError,
    clearErrors,
  }
}