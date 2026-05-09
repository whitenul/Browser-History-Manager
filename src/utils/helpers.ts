import { parse } from 'tldts'
import {
  buildEntityIndex,
  getEntityForDomain,
  getEntityRelationships,
  getEntityById,
  getRegisteredDomain,
  extractDomainFeatures,
  buildDomainGraph,
  SessionCoVisitAnalyzer,
  AdaptiveConfidenceAdjuster,
  type DomainEntity,
  type DomainRelationship,
  type DomainFeatures,
  type DomainGraphNode,
  type DomainGraphEdge,
  type CoVisitRecord,
  type ConfidenceCorrection,
} from './domainEntity'
import type { TagRule, SubtagRule } from './tagRulesData'

type TagProductivityMap = Record<string, 'productive' | 'neutral' | 'unproductive'>

let _tagRules: TagRule[] | null = null
let _subtagRules: SubtagRule[] | null = null
let _urlSemanticPatterns: { pattern: string; tag: string; subtag?: string; confidence: number }[] | null = null
let _tagProductivity: TagProductivityMap | null = null
let _loadPromise: Promise<void> | null = null

async function ensureTagRulesLoaded(): Promise<void> {
  if (_tagRules) return
  if (_loadPromise) return _loadPromise
  _loadPromise = import('./tagRulesData').then(mod => {
    _tagRules = mod.TAG_RULES
    _subtagRules = mod.SUBTAG_RULES
    _urlSemanticPatterns = mod.URL_SEMANTIC_PATTERNS
    _tagProductivity = mod.TAG_PRODUCTIVITY
  }).finally(() => { _loadPromise = null })
  await _loadPromise
}

function getTagRulesSync(): TagRule[] {
  return _tagRules || []
}

function getSubtagRulesSync(): SubtagRule[] {
  return _subtagRules || []
}

function getUrlSemanticPatternsSync() {
  return _urlSemanticPatterns || []
}

function getTagProductivitySync(): TagProductivityMap {
  return _tagProductivity || {}
}

export {
  getRegisteredDomain,
  getPublicSuffix,
  getSubdomain,
  buildDomainGraph,
  SessionCoVisitAnalyzer,
  AdaptiveConfidenceAdjuster,
  getEntityForDomain,
  getAllEntities,
} from './domainEntity'
export type {
  DomainEntity,
  DomainRelationship,
  DomainFeatures,
  DomainGraphNode,
  DomainGraphEdge,
  CoVisitRecord,
  ConfidenceCorrection,
}

export { ensureTagRulesLoaded, ensureDomainTagIndexReady }

export function getDomain(url: string): string {
  try {
    const result = parse(url)
    if (result.domain) return result.domain
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function safeOpenUrl(url: string, active: boolean = true): boolean {
  try {
    const protocol = new URL(url).protocol
    if (protocol !== 'http:' && protocol !== 'https:') return false
    chrome.tabs.create({ url, active })
    return true
  } catch {
    return false
  }
}

export function isValidDomain(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(domain) && domain.length <= 253
}

const faviconDomainCache = new Map<string, string>()

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '')
    if (faviconDomainCache.has(domain)) return faviconDomainCache.get(domain)!
    const faviconUrl = `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`
    faviconDomainCache.set(domain, faviconUrl)
    return faviconUrl
  } catch {
    return ''
  }
}

export function getFaviconFallback(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return generateFaviconSvg(hostname)
  } catch {
    return ''
  }
}

export function onFaviconError(event: Event, url: string): void {
  const img = event.target as HTMLImageElement
  if (img && !img.dataset.fallback) {
    img.dataset.fallback = '1'
    img.src = getFaviconFallback(url)
  }
}

function generateFaviconSvg(domain: string): string {
  const color = stringToColor(domain)
  const letter = (domain[0] || '?').toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${color}"/><text x="16" y="22" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="white">${letter}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function stringToColor(str: string): string {
  if (!str) return '#94a3b8'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  const hue = Math.abs(hash % 360)
  const sat = 55 + Math.abs(hash % 25)
  const light = 45 + Math.abs(hash % 20)
  return hslToHex(hue, sat, light)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function escapeHtml(text: string): string {
  if (!text) return ''
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return text.replace(/[&<>"']/g, m => map[m])
}

const SENSITIVE_PARAMS = new Set([
  'token', 'access_token', 'refresh_token', 'auth', 'api_key', 'apikey',
  'password', 'passwd', 'secret', 'session_id', 'sessionid', 'sid',
  'key', 'private_key', 'code', 'oauth_token', 'openid', 'credential',
  'signature', 'sig', 'hash', 'nonce', 'state', 'sso', 'jwt',
  'authorization', 'bearer', 'ticket', 'ctoken', 'csrf_token', 'xsrf',
])

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const params = new URLSearchParams(parsed.search)
    let hasSensitive = false
    for (const [key, value] of params) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        params.set(key, '***')
        hasSensitive = true
      }
    }
    if (!hasSensitive) return url
    parsed.search = params.toString()
    return parsed.toString()
  } catch {
    return url
  }
}

export function urlStorageKey(url: string): string {
  try {
    const parsed = new URL(url)
    const params = new URLSearchParams(parsed.search)
    for (const key of [...params.keys()]) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        params.delete(key)
      }
    }
    parsed.search = params.toString()
    return parsed.toString()
  } catch {
    return url
  }
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

export function formatTime(timestamp: number, t?: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return t ? t('common.time.daysAgo', { count: days }) : `${days} days ago`
  if (hours > 0) return t ? t('common.time.hoursAgo', { count: hours }) : `${hours} hours ago`
  if (minutes > 0) return t ? t('common.time.minutesAgo', { count: minutes }) : `${minutes} minutes ago`
  return t ? t('common.time.justNow') : 'just now'
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${formatDate(timestamp)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatNumber(n: number, t?: (key: string, params?: Record<string, string | number>) => string): string {
  if (n >= 10000) return t ? t('common.number.tenThousand', { count: (n / 10000).toFixed(1) }) : (n / 10000).toFixed(1) + '0k'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export function getTimeRange(range: string): { startTime: number; endTime: number } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  switch (range) {
    case 'today': return { startTime: today, endTime: now.getTime() }
    case 'yesterday': return { startTime: today - 86400000, endTime: today }
    case '3days': return { startTime: today - 3 * 86400000, endTime: now.getTime() }
    case 'week': return { startTime: today - 7 * 86400000, endTime: now.getTime() }
    case 'month': return { startTime: today - 30 * 86400000, endTime: now.getTime() }
    case 'quarter': return { startTime: today - 90 * 86400000, endTime: now.getTime() }
    case 'year': return { startTime: today - 365 * 86400000, endTime: now.getTime() }
    default: return { startTime: 0, endTime: now.getTime() }
  }
}

export function highlightText(text: string, keyword: string): string {
  if (!keyword || !text) return escapeHtml(text || '')
  const escaped = escapeHtml(text)
  const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi')
  return escaped.replace(regex, '<mark>$1</mark>')
}

export function createCustomRule(name: string, pattern: string, type: string = 'domain') {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, pattern, type }
}

export function matchRule(url: string, rule: { pattern: string; type: string }): boolean {
  const domain = getDomain(url)
  switch (rule.type) {
    case 'domain': return domain === rule.pattern || domain.endsWith('.' + rule.pattern)
    case 'path': return url.includes(rule.pattern)
    case 'regex':
      try {
        if (rule.pattern.length > 200) return false
        return new RegExp(rule.pattern).test(url.slice(0, 2000))
      } catch { return false }
    default: return false
  }
}

export interface HistoryRecord {
  id: string
  url: string
  title: string
  lastVisitTime: number
  visitCount: number
  typedCount?: number
  domain: string
  domainColor: string
  tags?: string[]
}

export interface GroupResult {
  groups: Record<string, HistoryRecord[]>
  order: string[]
}

const GROUP_LABELS: Record<string, string> = {
  today: 'common.time.today',
  yesterday: 'common.time.yesterday',
  last7days: 'common.time.last7days',
  last30days: 'common.time.last30days',
  older: 'common.time.older',
  _other: 'common.time.other',
}

export function getGroupLabel(key: string, t?: (key: string, params?: Record<string, string | number>) => string): string {
  const i18nKey = GROUP_LABELS[key]
  if (i18nKey && t) return t(i18nKey)
  return i18nKey || key
}

export function groupByDomain(records: HistoryRecord[]): GroupResult {
  const groups: Record<string, HistoryRecord[]> = {}
  const order: string[] = []
  records.forEach(r => {
    if (!groups[r.domain]) { groups[r.domain] = []; order.push(r.domain) }
    groups[r.domain].push(r)
  })
  order.sort((a, b) => groups[b].length - groups[a].length)
  return { groups, order }
}

export function groupByTimeline(records: HistoryRecord[]): GroupResult {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const groups: Record<string, HistoryRecord[]> = { today: [], yesterday: [], last7days: [], last30days: [], older: [] }
  records.forEach(r => {
    if (r.lastVisitTime >= today) groups.today.push(r)
    else if (r.lastVisitTime >= today - 86400000) groups.yesterday.push(r)
    else if (r.lastVisitTime >= today - 7 * 86400000) groups.last7days.push(r)
    else if (r.lastVisitTime >= today - 30 * 86400000) groups.last30days.push(r)
    else groups.older.push(r)
  })
  const order = ['today', 'yesterday', 'last7days', 'last30days', 'older'].filter(k => groups[k].length > 0)
  return { groups, order }
}

export function groupByCustomRules(records: HistoryRecord[], rules: ReturnType<typeof createCustomRule>[]): GroupResult {
  const groups: Record<string, HistoryRecord[]> = { _other: [] }
  const order: string[] = ['_other']
  rules.forEach(rule => { groups[rule.name] = []; order.push(rule.name) })
  records.forEach(r => {
    let matched = false
    for (const rule of rules) {
      if (matchRule(r.url, rule)) { groups[rule.name].push(r); matched = true; break }
    }
    if (!matched) groups._other.push(r)
  })
  return { groups, order: order.filter(id => groups[id]?.length > 0) }
}

export function groupBySession(records: HistoryRecord[], gapMs: number = 30 * 60 * 1000): GroupResult {
  const sorted = [...records].sort((a, b) => b.lastVisitTime - a.lastVisitTime)
  if (!sorted.length) return { groups: {}, order: [] }
  const groups: Record<string, HistoryRecord[]> = {}
  const order: string[] = []
  let sessionIdx = 0
  let sessionStart = sorted[0].lastVisitTime
  let sessionKey = `session-${sessionIdx}`
  groups[sessionKey] = [sorted[0]]
  order.push(sessionKey)
  for (let i = 1; i < sorted.length; i++) {
    if (sessionStart - sorted[i].lastVisitTime > gapMs) {
      sessionIdx++
      sessionKey = `session-${sessionIdx}`
      groups[sessionKey] = []
      order.push(sessionKey)
    }
    groups[sessionKey].push(sorted[i])
    sessionStart = sorted[i].lastVisitTime
  }
  return { groups, order }
}

export function exportToCSV(records: HistoryRecord[], t?: (key: string, params?: Record<string, string | number>) => string): void {
  if (!records.length) return
  const headers = [
    t ? t('common.csv.title') : 'Title',
    t ? t('common.csv.url') : 'URL',
    t ? t('common.csv.domain') : 'Domain',
    t ? t('common.csv.lastVisitTime') : 'Last Visit Time',
    t ? t('common.csv.visitCount') : 'Visit Count',
  ]
  const escCSV = (v: string) => {
    let escaped = v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
    if (/^[=+\-@\t\r]/.test(escaped)) escaped = "'" + escaped
    return escaped
  }
  const rows = records.map(r => [
    escCSV(r.title || ''), escCSV(sanitizeUrl(r.url)), escCSV(r.domain),
    escCSV(new Date(r.lastVisitTime).toISOString()), String(r.visitCount || 0)
  ])
  const csv = '\ufeff' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `browser-history-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function getTagProductivity(tag: string): 'productive' | 'neutral' | 'unproductive' {
  return getTagProductivitySync()[tag] || 'neutral'
}

interface TagCandidate {
  tag: string
  confidence: number
  source: 'domain' | 'domain-suffix' | 'title' | 'url-pattern' | 'url-query' | 'entity-propagation' | 'feature-based'
}

export interface TagResult {
  tag: string
  confidence: number
  subtags: string[]
}

const TAG_CACHE = new Map<string, string[]>()
const TAG_DETAILED_CACHE = new Map<string, TagResult[]>()
const TAG_CACHE_MAX = 10000
let entityIndexInitialized = false

const domainToTagMap = new Map<string, { tag: string; confidence: number }>()
let domainTagIndexBuilt = false

function buildDomainTagIndex() {
  if (domainTagIndexBuilt) return
  domainTagIndexBuilt = true
  for (const rule of getTagRulesSync()) {
    for (const d of rule.domains) {
      if (!domainToTagMap.has(d)) {
        domainToTagMap.set(d, { tag: rule.tag, confidence: 0.95 })
      }
    }
  }
}

async function ensureDomainTagIndexReady() {
  await ensureTagRulesLoaded()
  buildDomainTagIndex()
}

function propagateEntityConfidence(domain: string, candidates: TagCandidate[]): void {
  const entity = getEntityForDomain(domain)
  if (!entity) return

  const hasEntityTag = candidates.some(c => c.tag === entity.primaryTag && c.confidence >= 0.6)
  if (!hasEntityTag) {
    candidates.push({
      tag: entity.primaryTag,
      confidence: 0.65,
      source: 'entity-propagation',
    })
  }

  const relationships = getEntityRelationships(entity.id)
  for (const rel of relationships) {
    if (rel.type === 'sibling' || rel.type === 'subsidiary') {
      const siblingEntity = getEntityById(rel.target)
      if (siblingEntity && rel.confidence > 0.7) {
        const hasSiblingTag = candidates.some(c => c.tag === siblingEntity.primaryTag)
        if (!hasSiblingTag) {
          candidates.push({
            tag: siblingEntity.primaryTag,
            confidence: 0.4 * rel.confidence,
            source: 'entity-propagation',
          })
        }
      }
    }
  }
}

function classifyByDomainFeatures(url: string, candidates: TagCandidate[]): void {
  const features = extractDomainFeatures(url)
  if (features.entityMatch) return

  const FEATURE_TAG_MAP: Array<{ condition: (f: DomainFeatures) => boolean; tag: string; confidence: number }> = [
    { condition: f => f.tldType === 'new-gtld' && ['dev', 'app', 'io', 'sh'].some(t => url.endsWith('.' + t)), tag: 'tech', confidence: 0.45 },
    { condition: f => f.tldType === 'new-gtld' && ['ai'].some(t => url.endsWith('.' + t)), tag: 'ai', confidence: 0.5 },
    { condition: f => f.tldType === 'new-gtld' && ['design', 'art'].some(t => url.endsWith('.' + t)), tag: 'design', confidence: 0.5 },
    { condition: f => f.tldType === 'new-gtld' && ['music', 'video'].some(t => url.endsWith('.' + t)), tag: 'music', confidence: 0.4 },
    { condition: f => f.tldType === 'new-gtld' && ['shop', 'store'].some(t => url.endsWith('.' + t)), tag: 'shopping', confidence: 0.45 },
    { condition: f => f.tldType === 'new-gtld' && ['game', 'games'].some(t => url.endsWith('.' + t)), tag: 'gaming', confidence: 0.45 },
    { condition: f => f.tldType === 'new-gtld' && ['blog'].some(t => url.endsWith('.' + t)), tag: 'blog', confidence: 0.45 },
    { condition: f => f.tldType === 'country' && f.domainLength <= 4, tag: 'search', confidence: 0.3 },
    { condition: f => f.pathDepth >= 4 && f.domainLength > 10, tag: 'tools', confidence: 0.3 },
  ]

  for (const rule of FEATURE_TAG_MAP) {
    if (rule.condition(features)) {
      const existing = candidates.find(c => c.tag === rule.tag)
      if (!existing || existing.confidence < rule.confidence) {
        candidates.push({ tag: rule.tag, confidence: rule.confidence, source: 'feature-based' })
      }
      break
    }
  }
}

export function autoTag(url: string, title: string): string[] {
  if (!_tagRules) return []
  const cacheKey = `${url}|${title}`
  const cached = TAG_CACHE.get(cacheKey)
  if (cached) return cached
  const results = autoTagDetailed(url, title)
  const tags = results.map(r => r.tag)
  if (TAG_CACHE.size < TAG_CACHE_MAX) {
    TAG_CACHE.set(cacheKey, tags)
  }
  return tags
}

export function autoTagDetailed(url: string, title: string, visitHour?: number): TagResult[] {
  if (!_tagRules) return []
  buildDomainTagIndex()
  const cacheKey = `${url}|${title}`
  const cached = TAG_DETAILED_CACHE.get(cacheKey)
  if (cached) return cached

  if (!entityIndexInitialized) {
    buildEntityIndex()
    entityIndexInitialized = true
  }

  const candidates: TagCandidate[] = []
  const domain = getDomain(url)
  const titleLower = (title || '').toLowerCase()
  const urlLower = url.toLowerCase()

  let urlPath = '/'
  try { urlPath = new URL(url).pathname.toLowerCase() } catch { /* ignore */ }

  const registeredDomain = getRegisteredDomain(url)

  const exactMatch = domainToTagMap.get(domain) || (registeredDomain ? domainToTagMap.get(registeredDomain) : undefined)
  if (exactMatch) {
    candidates.push({ tag: exactMatch.tag, confidence: exactMatch.confidence, source: 'domain' })
  }

  for (const rule of getTagRulesSync()) {
    if (exactMatch && rule.tag === exactMatch.tag) continue

    const suffixDomainMatch = rule.domains.some(d => domain.endsWith('.' + d) || registeredDomain?.endsWith('.' + d))
    if (suffixDomainMatch) {
      candidates.push({ tag: rule.tag, confidence: 0.85, source: 'domain' })
      continue
    }

    const domainSuffixMatch = rule.domainSuffixes?.some(s => domain.endsWith(s)) ?? false
    if (domainSuffixMatch) {
      candidates.push({ tag: rule.tag, confidence: 0.6, source: 'domain-suffix' })
      continue
    }

    const urlPatternMatch = rule.urlPatterns?.some(p => urlLower.includes(p)) ?? false
    const queryMatch = rule.queryPatterns?.some(p => urlLower.includes(p)) ?? false
    const titleMatch = rule.titleKeywords.some(kw => titleLower.includes(kw))

    if (urlPatternMatch && titleMatch) {
      candidates.push({ tag: rule.tag, confidence: 0.8, source: 'url-pattern' })
    } else if (urlPatternMatch) {
      candidates.push({ tag: rule.tag, confidence: 0.55, source: 'url-pattern' })
    } else if (queryMatch && titleMatch) {
      candidates.push({ tag: rule.tag, confidence: 0.75, source: 'url-query' })
    } else if (queryMatch) {
      candidates.push({ tag: rule.tag, confidence: 0.45, source: 'url-query' })
    } else if (titleMatch) {
      const kwLen = rule.titleKeywords.filter(kw => titleLower.includes(kw)).length
      const conf = Math.min(0.7, 0.3 + kwLen * 0.15)
      candidates.push({ tag: rule.tag, confidence: conf, source: 'title' })
    }
  }

  if (candidates.length === 0 || candidates.every(c => c.confidence < 0.5)) {
    for (const pattern of getUrlSemanticPatternsSync()) {
      if (urlPath.includes(pattern.pattern)) {
        const existing = candidates.find(c => c.tag === pattern.tag)
        if (!existing || existing.confidence < pattern.confidence) {
          candidates.push({ tag: pattern.tag, confidence: pattern.confidence, source: 'url-pattern' })
        }
      }
    }
  }

  propagateEntityConfidence(domain, candidates)

  if (candidates.length === 0 || candidates.every(c => c.confidence < 0.4)) {
    classifyByDomainFeatures(url, candidates)
  }

  const tagMap = new Map<string, { confidence: number; subtags: string[] }>()
  for (const c of candidates) {
    const existing = tagMap.get(c.tag)
    if (existing) {
      existing.confidence = Math.max(existing.confidence, c.confidence)
    } else {
      tagMap.set(c.tag, { confidence: c.confidence, subtags: [] })
    }
  }

  for (const [tag, data] of tagMap) {
    const matchedSubtags: string[] = []
    const subtagRules = getSubtagRulesSync().filter(r => r.parentTag === tag)

    for (const rule of subtagRules) {
      let matched = false
      let subConf = 0

      if (rule.domains) {
        const domainMatch = rule.domains.some(d => domain === d || domain.endsWith('.' + d))
        if (domainMatch) { matched = true; subConf = 0.9 }
      }

      if (!matched && rule.pathKeywords && urlPath) {
        const pathMatch = rule.pathKeywords.some(kw => urlPath.includes(kw))
        if (pathMatch) { matched = true; subConf = 0.65 }
      }

      if (!matched && rule.titleKeywords) {
        const titleMatch = rule.titleKeywords.some(kw => titleLower.includes(kw))
        if (titleMatch) { matched = true; subConf = 0.5 }
      }

      if (matched) {
        matchedSubtags.push(rule.subtag)
      }
    }

    if (matchedSubtags.length === 0) {
      for (const pattern of getUrlSemanticPatternsSync()) {
        if (pattern.subtag && pattern.tag === tag && urlPath.includes(pattern.pattern)) {
          if (!matchedSubtags.includes(pattern.subtag)) {
            matchedSubtags.push(pattern.subtag)
          }
        }
      }
    }

    data.subtags = matchedSubtags
  }

  const hour = visitHour ?? new Date().getHours()
  if (hour >= 22 || hour < 6) {
    tagMap.set('lateNight', { confidence: 0.9, subtags: [] })
  } else if (hour >= 6 && hour < 9) {
    tagMap.set('earlyMorning', { confidence: 0.7, subtags: [] })
  } else if (hour >= 9 && hour < 12) {
    tagMap.set('morningPeriod', { confidence: 0.5, subtags: [] })
  } else if (hour >= 14 && hour < 18) {
    tagMap.set('afternoonPeriod', { confidence: 0.5, subtags: [] })
  }

  if (title) {
    if (title.length > 80) tagMap.set('longArticle', { confidence: 0.9, subtags: [] })
    else if (title.length > 40) tagMap.set('mediumArticle', { confidence: 0.6, subtags: [] })
  }

  const depth = urlPath.split('/').filter(Boolean).length
  if (depth >= 5) tagMap.set('deepPage', { confidence: 0.4, subtags: [] })

  const sorted = Array.from(tagMap.entries())
    .sort((a, b) => b[1].confidence - a[1].confidence)
    .slice(0, 4)

  const result = sorted.map(([tag, data]) => ({
    tag,
    confidence: data.confidence,
    subtags: data.subtags,
  }))

  if (TAG_DETAILED_CACHE.size < TAG_CACHE_MAX) {
    TAG_DETAILED_CACHE.set(cacheKey, result)
  }

  return result
}

export const TAG_COLORS: Record<string, string> = {
  'social': '#3b82f6',
  'video': '#ef4444',
  'tech': '#10b981',
  'docs': '#6366f1',
  'shopping': '#f59e0b',
  'news': '#06b6d4',
  'design': '#ec4899',
  'learning': '#8b5cf6',
  'email': '#64748b',
  'music': '#14b8a6',
  'ai': '#a855f7',
  'gaming': '#22c55e',
  'finance': '#eab308',
  'blog': '#0ea5e9',
  'forum': '#f97316',
  'tools': '#8b5cf6',
  'cloud': '#6366f1',
  'health': '#10b981',
  'travel': '#14b8a6',
  'food': '#f43f5e',
  'government': '#475569',
  'search': '#3b82f6',
  'reading': '#818cf8',
  'dev': '#06b6d4',
  'photography': '#f472b6',
  'education': '#a78bfa',
  'sports': '#22d3ee',
  'automotive': '#fb923c',
  'realestate': '#34d399',
  'law': '#94a3b8',
  'jobs': '#2dd4bf',
  'lateNight': '#475569',
  'earlyMorning': '#fbbf24',
  'morningPeriod': '#fcd34d',
  'afternoonPeriod': '#fb923c',
  'longArticle': '#78716c',
  'mediumArticle': '#a8a29e',
  'deepPage': '#6b7280',
}

export const TAG_ICONS: Record<string, string> = {
  'social': 'i-lucide:users',
  'video': 'i-lucide:play-circle',
  'tech': 'i-lucide:code-2',
  'docs': 'i-lucide:file-text',
  'shopping': 'i-lucide:shopping-bag',
  'news': 'i-lucide:newspaper',
  'design': 'i-lucide:palette',
  'learning': 'i-lucide:graduation-cap',
  'email': 'i-lucide:mail',
  'music': 'i-lucide:music',
  'ai': 'i-lucide:brain',
  'gaming': 'i-lucide:gamepad-2',
  'finance': 'i-lucide:trending-up',
  'blog': 'i-lucide:pen-line',
  'forum': 'i-lucide:message-circle',
  'tools': 'i-lucide:wrench',
  'cloud': 'i-lucide:cloud',
  'health': 'i-lucide:heart-pulse',
  'travel': 'i-lucide:plane',
  'food': 'i-lucide:utensils',
  'government': 'i-lucide:landmark',
  'search': 'i-lucide:search',
  'reading': 'i-lucide:book-open',
  'dev': 'i-lucide:terminal',
  'photography': 'i-lucide:camera',
  'education': 'i-lucide:school',
  'sports': 'i-lucide:trophy',
  'automotive': 'i-lucide:car',
  'realestate': 'i-lucide:home',
  'law': 'i-lucide:scale',
  'jobs': 'i-lucide:briefcase',
  'lateNight': 'i-lucide:moon',
  'earlyMorning': 'i-lucide:sunrise',
  'morningPeriod': 'i-lucide:sun',
  'afternoonPeriod': 'i-lucide:cloud-sun',
  'longArticle': 'i-lucide:scroll-text',
  'mediumArticle': 'i-lucide:file-text',
  'deepPage': 'i-lucide:layers',
}
