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

export function getFaviconUrl(url: string): string {
  try {
    return `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`
  } catch {
    return ''
  }
}

export function getFaviconUrlWithHint(url: string, _favIconUrl?: string): string {
  try {
    return `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`
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

interface TagRule {
  tag: string
  subtags?: string[]
  domains: string[]
  domainSuffixes?: string[]
  titleKeywords: string[]
  urlPatterns?: string[]
  queryPatterns?: string[]
  priority?: number
}

const TAG_RULES: TagRule[] = [
  {
    tag: 'social',
    subtags: ['instantMessaging', 'communityForum', 'professionalSocial', 'photoSocial'],
    domains: [
      'twitter.com', 'x.com', 'weibo.com', 'facebook.com', 'instagram.com', 'reddit.com',
      'douban.com', 'linkedin.com', 'mastodon.social', 'threads.net', 'tumblr.com',
      'zhihu.com', 'tieba.baidu.com', 'discord.com', 'telegram.org', 'slack.com',
      'clubhouse.com', 'vk.com', 'snapchat.com', 'xiaohongshu.com', 'pinterest.com',
      'quora.com', 'stackexchange.com', 'zhihuishu.com', 'weixin.qq.com', 'wx.qq.com',
      'web.wechat.com', 'messenger.com', 'whatsapp.com', 'web.whatsapp.com',
      'line.me', 'kakao.com', 'signal.org', 'teams.microsoft.com', 'skype.com',
      'icq.com', 'irc', 'gitter.im', 'matrix.org', 'element.io',
      'bluesky.social', 'bsky.app', 'cohost.org', 'post.news',
      'misskey.io', 'pleroma.social', 'friendica', 'diaspora',
    ],
    domainSuffixes: ['.social', '.chat', '.moe'],
    titleKeywords: [
      '社交', 'social', '关注', '粉丝', '动态', '朋友圈', '帖子', '讨论',
      '私信', '群聊', '好友', '评论', '转发', '点赞', '关注',
      'inbox', 'message', 'chat', 'follow', 'follower',
    ],
    urlPatterns: ['/feed', '/timeline', '/status/', '/post/', '/comment/', '/messages/', '/dm/', '/chat/'],
    queryPatterns: ['tab=messages', 'action=chat', 'view=feed'],
    priority: 8,
  },
  {
    tag: 'video',
    subtags: ['shortVideo', 'longVideo', 'liveStream', 'streaming'],
    domains: [
      'youtube.com', 'bilibili.com', 'netflix.com', 'vimeo.com', 'tiktok.com', 'douyin.com',
      'hulu.com', 'disneyplus.com', 'primevideo.com', 'hbomax.com', 'iqiyi.com', 'youku.com',
      'mgtv.com', 'acfun.cn', 'nicovideo.jp', 'dailymotion.com',
      'twitch.tv', 'live.bilibili.com', 'douyu.com', 'huya.com', 'cc.163.com',
      'peertube', 'odysee.com', 'rumble.com', 'kick.com', 'trovo.live',
      'youtube.com/shorts', 'youtube.com/live',
      'crunchyroll.com', 'funimation.com', 'vrv.co', 'animelab.com',
      'paramountplus.com', 'peacocktv.com', 'appletv.apple.com',
      'm.youtube.com', 'studio.youtube.com',
      'v.qq.com', 'v.youku.com', 'film.sohu.com', 'tv.sohu.com',
      'le.com', 'pptv.com', 'wasu.cn',
    ],
    domainSuffixes: ['.tv'],
    titleKeywords: [
      '视频', 'video', 'watch', '直播', 'live', '番剧', '动漫', '动画',
      'movie', 'film', '剧集', '综艺', '短视频', 'vlog', 'stream',
      '纪录片', 'documentary', '预告', 'trailer', '弹幕', 'danmaku',
    ],
    urlPatterns: ['/watch', '/video/', '/live/', '/play/', '/episode/', '/shorts/', '/stream/', '/clip/'],
    queryPatterns: ['v=', 'video_id=', 'bvid=', 'aid=', 'ep_id='],
    priority: 9,
  },
  {
    tag: 'tech',
    subtags: ['frontend', 'backend', 'mobile', 'devops', 'database', 'security', 'opensource'],
    domains: [
      'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
      'developer.mozilla.org', 'npmjs.com', 'pypi.org', 'crates.io', 'rubygems.org',
      'csdn.net', 'juejin.cn', 'segmentfault.com', 'dev.to', 'hashnode.dev', 'hackernoon.com',
      'news.ycombinator.com', 'lobste.rs', 'v2ex.com', 'infoq.cn', 'oschina.net',
      'cnblogs.com', 'iteye.com', '51cto.com', 'linux.cn', 'rust-lang.org',
      'python.org', 'nodejs.org', 'go.dev', 'vuejs.org', 'react.dev', 'angular.io',
      'webpack.js.org', 'vitejs.dev', 'typescriptlang.org', 'docs.rs',
      'pkg.go.dev', 'docs.python.org', 'kubernetes.io', 'docker.com',
      'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com',
      'digitalocean.com', 'heroku.com', 'vercel.com', 'netlify.app',
      'cloudflare.com', 'firebase.google.com', 'supabase.com',
      'codepen.io', 'codesandbox.io', 'jsfiddle.net', 'replit.com',
      'leetcode.com', 'codeforces.com', 'hackerrank.com', 'codewars.com',
      'atcoder.jp', 'topcoder.com', 'spoj.com', 'projecteuler.net',
      'svelte.dev', 'nextjs.org', 'nuxt.com', 'astro.build', 'remix.run',
      'tailwindcss.com', 'unocss.dev', 'mui.com', 'ant.design',
      'expressjs.com', 'fastapi.tiangolo.com', 'django.com', 'flask.palletsprojects.com',
      'spring.io', 'laravel.com', 'rails.org', 'gin-gonic.com',
      'mongodb.com', 'redis.com', 'postgresql.org', 'mysql.com',
      'elastic.co', 'grafana.com', 'prometheus.io', 'jenkins.io',
      'owasp.org', 'portswigger.net', 'hackthebox.com', 'tryhackme.com',
      'android.com/developers', 'developer.apple.com', 'developer.android.com',
      'docs.flutter.dev', 'reactnative.dev', 'capacitorjs.com',
      'deno.land', 'bun.sh', 'prisma.io', 'drizzle.team',
      'trpc.io', 'graphql.org', 'hasura.io', 'supabase.com/docs',
    ],
    domainSuffixes: ['.dev', '.io', '.rs', '.sh', '.app'],
    titleKeywords: [
      'api', 'sdk', '代码', '编程', '开发', 'debug', 'react', 'vue', 'python', 'typescript',
      'javascript', 'rust', 'golang', 'java', 'c++', '算法', '数据结构', '框架', '库',
      '部署', 'deploy', '容器', 'docker', 'k8s', '微服务', 'serverless',
      '前端', '后端', 'fullstack', 'devops', 'ci/cd', 'git', '数据库',
      '编程题', '刷题', 'leetcode', 'oj', '竞赛', 'runtime', 'compiler',
      'middleware', 'orm', 'cache', 'queue', 'websocket', 'grpc',
      'component', 'hook', 'state', 'render', 'bundle', 'webpack', 'vite',
      'sql', 'nosql', 'migration', 'schema', 'index', 'query',
      'authentication', 'authorization', 'jwt', 'oauth', 'cors',
      'ssh', 'tls', 'ssl', 'encryption', 'vulnerability', 'xss', 'csrf',
    ],
    urlPatterns: [
      '/issues/', '/pull/', '/commit/', '/blob/', '/tree/', '/releases/',
      '/questions/', '/answers/', '/tags/', '/repos/', '/packages/',
      '/api/', '/sdk/', '/cli/', '/config/', '/env/',
    ],
    queryPatterns: ['tab=repositories', 'q=repo', 'sort=stars', 'language='],
    priority: 9,
  },
  {
    tag: 'docs',
    subtags: ['collaboration', 'knowledgeBase', 'apiDocs', 'notes'],
    domains: [
      'docs.google.com', 'notion.so', 'notion.site', 'confluence', 'wiki',
      'readthedocs.io', 'gitbook.com', 'docusaurus.io', 'mkdocs.org',
      'swagger.io', 'postman.com', 'insomnia.rest', 'typora.io',
      'feishu.cn', 'dingtalk.com', 'yuque.com', 'shimo.im', 'mubu.com',
      'processon.com', 'draw.io', 'miro.com', 'lucidchart.com',
      'coda.io', 'airtable.com', 'clickup.com', 'asana.com',
      'atlassian.net', 'atlassian.com', 'jira', 'trello.com',
      'obsidian.md', 'logseq.com', 'roamresearch.com',
      'craft.do', 'bear.app', 'ulysses.app', 'ia.net',
      'dropbox.com', 'drive.google.com', 'onedrive.com',
      'overleaf.com', 'sharelatex.com', 'latex',
      'hackmd.io', 'markmap.js.org', 'mindmup.com',
    ],
    titleKeywords: [
      '文档', 'docs', 'documentation', '手册', '指南', 'wiki', '知识库', '笔记', '协作',
      '规范', '标准', 'rfc', 'specification', 'markdown', 'latex', '表格',
      'spreadsheet', 'presentation', 'slides', '模板', 'template',
    ],
    urlPatterns: ['/docs/', '/wiki/', '/guide/', '/manual/', '/reference/', '/handbook/', '/note/', '/page/'],
    queryPatterns: ['edit=', 'view=edit', 'mode=edit'],
    priority: 7,
  },
  {
    tag: 'shopping',
    subtags: ['ecommerce', 'priceComparison', 'secondhand', 'brand'],
    domains: [
      'taobao.com', 'jd.com', 'amazon.com', 'pinduoduo.com', 'tmall.com', 'ebay.com',
      'suning.com', 'vip.com', 'kaola.com', 'mi.com', 'apple.com/shop',
      'walmart.com', 'target.com', 'bestbuy.com', 'costco.com',
      'shein.com', 'shopee.com', 'lazada.com', 'aliexpress.com',
      'etsy.com', 'zara.com', 'uniqlo.com', 'nike.com', 'adidas.com',
      'smzdm.com', 'manmanbuy.com', 'gwdang.com',
      'xianyu.com', 'idle.taobao.com', 'poizon.com', 'zhuanzhuan.com',
      'dangdang.com', 'yanxuan.com', 'you.163.com',
      'samsung.com', 'huawei.com', 'oppo.com', 'vivo.com',
      'newegg.com', 'microcenter.com', 'bhphotovideo.com',
      'farfetch.com', 'ssense.com', 'matchesfashion.com',
      'sephora.com', 'macys.com', 'nordstrom.com',
      'mercari.com', 'rakuten.co.jp', 'yahoo.co.jp/shopping',
    ],
    domainSuffixes: ['.shop', '.store', '.market'],
    titleKeywords: [
      '购买', '价格', '优惠', '折扣', '秒杀', '优惠券', '比价', '包邮', '下单', '购物车',
      '促销', '特价', '打折', '满减', '好价', '值得买', 'review', '测评',
      '开箱', 'unboxing', '种草', '拔草', '正品', '假货', '物流', '快递',
    ],
    urlPatterns: ['/product/', '/item/', '/cart', '/checkout', '/order/', '/deal/', '/coupon/', '/shop/', '/goods/'],
    queryPatterns: ['item_id=', 'product_id=', 'sku=', 'spu=', 'category_id='],
    priority: 8,
  },
  {
    tag: 'news',
    subtags: ['techNews', 'financeNews', 'international', 'society'],
    domains: [
      'news.ycombinator.com', 'bbc.com', 'cnn.com', 'sina.com.cn', '163.com', 'thepaper.cn',
      'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com',
      'wsj.com', 'ft.com', 'economist.com', 'time.com', 'newsweek.com',
      'ifeng.com', 'sohu.com', 'qq.com/news', 'caixin.com', 'jiemian.com',
      'guancha.cn', 'zaobao.com', 'chinadaily.com.cn', 'people.com.cn',
      'xinhuanet.com', 'cctv.com', 'ithome.com', '36kr.com', 'huxiu.com',
      'tmtpost.com', 'ifanr.com', 'cnbeta.com', 'solidot.org',
      'aljazeera.com', 'dw.com', 'france24.com', 'nhk.or.jp',
      'foxnews.com', 'nbcnews.com', 'abcnews.go.com', 'cbsnews.com',
      'apnews.com', 'usatoday.com', 'npr.org', 'bbc.co.uk',
      'theverge.com', 'wired.com', 'arstechnica.com', 'techcrunch.com',
      'engadget.com', 'gizmodo.com', 'mashable.com',
      'zaobao.com.sg', 'scmp.com', 'thestraitstimes.com',
    ],
    titleKeywords: [
      '新闻', 'news', '报道', '快讯', '头条', '突发', '时事', '热点', '评论', '社论',
      'breaking', 'headline', 'exclusive', '深度', '调查', '专题',
    ],
    urlPatterns: ['/news/', '/article/', '/story/', '/breaking/', '/headline/', '/report/', '/column/'],
    queryPatterns: ['section=news', 'category=news', 'type=article'],
    priority: 7,
  },
  {
    tag: 'design',
    subtags: ['uiux', 'graphic', '3d', 'motion', 'assets'],
    domains: [
      'dribbble.com', 'behance.net', 'figma.com', 'canva.com', 'unsplash.com', 'pinterest.com',
      'adobe.com', 'sketch.com', 'invisionapp.com', 'framer.com', 'spline.design',
      'coolors.co', 'color.adobe.com', 'fontawesome.com', 'fonts.google.com',
      'iconfont.cn', 'iconify.design', 'flaticon.com', 'iconfinder.com',
      'shutterstock.com', 'gettyimages.com', 'pexels.com', 'pixabay.com',
      'freepik.com', 'awwwards.com', 'cssdesignawards.com',
      'zcool.com.cn', 'uisdc.com', 'seeseed.com',
      'blender.org', 'sketchfab.com', 'poly.food', 'threejs.org',
      'lottiefiles.com', 'rive.app', 'haiku.ai',
      'penpot.app', 'plasmic.app', 'webflow.com', 'bubble.io',
      'creativemarket.com', 'envato.com', 'themeforest.net',
      'dribbble.com/shots', 'mobbin.com', 'pageflows.com',
    ],
    domainSuffixes: ['.design', '.art'],
    titleKeywords: [
      '设计', 'design', 'ui', 'ux', '配色', '字体', '排版', '原型', '交互', '视觉',
      'icon', '插画', 'illustration', 'mockup', 'wireframe', 'gradient',
      'figma', 'sketch', '组件', 'component', 'token', '色板', 'palette',
      '响应式', 'responsive', '动画', 'motion', '3d', '建模',
    ],
    urlPatterns: ['/design/', '/prototype/', '/canvas/', '/editor/', '/template/', '/shot/', '/portfolio/'],
    queryPatterns: ['file=', 'node-id=', 'type=design'],
    priority: 7,
  },
  {
    tag: 'learning',
    subtags: ['courses', 'academic', 'language', 'codingLearning'],
    domains: [
      'coursera.org', 'udemy.com', 'khan', 'edu.cn', 'mooc',
      'edx.org', 'mit.edu', 'stanford.edu', 'harvard.edu', 'ocw.mit.edu',
      'skillshare.com', 'pluralsight.com', 'linkedin.com/learning',
      'duolingo.com', 'babbel.com', 'rosettastone.com',
      'icourse163.org', 'xuetangx.com', 'imooc.com', 'jikexueyuan.com',
      'runoob.com', 'w3schools.com', 'tutorialspoint.com', 'geeksforgeeks.org',
      'brilliant.org', 'khanacademy.org', 'scratch.mit.edu',
      'scholar.google.com', 'arxiv.org', 'researchgate.net', 'semanticscholar.org',
      'academia.edu', 'core.ac.uk', 'doi.org', 'springer.com', 'ieee.org',
      'udacity.com', 'datacamp.com', 'codecademy.com',
      'futurelearn.com', 'coursera.org', 'khanacademy.org',
      'quizlet.com', 'ankiweb.net', 'memrise.com',
      'z-library.org', 'libgen.is', 'sci-hub',
    ],
    domainSuffixes: ['.edu', '.ac.uk', '.ac.jp'],
    titleKeywords: [
      '教程', 'tutorial', '课程', 'course', '学习', '入门', '进阶', '实战', '培训',
      '论文', 'paper', '研究', 'research', '学术', 'academic', '学位', 'thesis',
      '考试', 'exam', '认证', 'certification', '练习', 'exercise', 'quiz',
    ],
    urlPatterns: ['/learn/', '/course/', '/lesson/', '/lecture/', '/tutorial/', '/paper/', '/class/'],
    queryPatterns: ['course_id=', 'lesson=', 'chapter='],
    priority: 8,
  },
  {
    tag: 'email',
    domains: [
      'mail.google.com', 'outlook.com', 'outlook.live.com', 'mail.qq.com', 'mail.163.com',
      'mail.yahoo.com', 'proton.me', 'protonmail.com', 'zoho.com/mail',
      'fastmail.com', 'tutanota.com', 'gmx.com', 'mail.ru',
      'mail.sina.com', 'mail.126.com', 'mail.sohu.com', 'ym.163.com',
      'mail.139.com', 'mail.exmail.qq.com',
    ],
    titleKeywords: ['邮件', 'email', 'inbox', '收件箱', '发件', 'draft', 'sent'],
    urlPatterns: ['/mail/', '/inbox/', '/compose/'],
    priority: 6,
  },
  {
    tag: 'music',
    subtags: ['streaming', 'podcast', 'lyrics'],
    domains: [
      'spotify.com', 'music.163.com', 'soundcloud.com', 'apple.com/music',
      'music.apple.com', 'tidal.com', 'deezer.com', 'pandora.com',
      'y.qq.com', 'kugou.com', 'kuwo.cn', 'xiami.com',
      'bandcamp.com', 'last.fm', 'genius.com', 'azlyrics.com',
      'music.youtube.com', 'audius.co', 'reverbnation.com',
      'podcasts.apple.com', 'podcasts.google.com', 'overcast.fm',
      'pocketcasts.com', 'castro.fm', 'breakers.fm',
      'kuaishou.com', '5sing.kugou.com',
    ],
    domainSuffixes: ['.fm', '.radio'],
    titleKeywords: [
      '音乐', 'music', 'playlist', '歌单', '专辑', 'album', '歌词', 'lyrics',
      '播客', 'podcast', '单曲', '歌手', 'singer', 'band',
    ],
    urlPatterns: ['/track/', '/album/', '/playlist/', '/artist/', '/podcast/', '/song/'],
    queryPatterns: ['id=', 'track=', 'album='],
    priority: 7,
  },
  {
    tag: 'ai',
    subtags: ['chat', 'imageGeneration', 'model', 'aiTools'],
    domains: [
      'chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'huggingface.co',
      'midjourney.com', 'perplexity.ai', 'poe.com', 'character.ai',
      'stability.ai', 'runwayml.com', 'replicate.com', 'together.ai',
      'anthropic.com', 'openai.com', 'deepmind.com', 'deepmind.google',
      'copilot.microsoft.com', 'bing.com/chat', 'bard.google.com',
      'civitai.com', 'ollama.com', 'langchain.com', 'lmstudio.ai',
      'chat.zhipu.ai', 'yiyan.baidu.com', 'tongyi.aliyun.com',
      'xinghuo.xfyun.cn', 'kimi.moonshot.cn', 'doubao.com',
      'tiangong.cn', 'baichuan-ai.com', 'minimaxi.com',
      'suno.com', 'udio.com', 'elevenlabs.io',
      'leonardo.ai', 'playground.ai', 'nightcafe.studio',
      'huggingface.co/spaces', 'huggingface.co/models',
      'openrouter.ai', 'groq.com', 'cerebras.ai', 'sambanova.ai',
      'dify.ai', 'coze.com', 'fastgpt.in', 'lobechat.com',
      'cursor.com', 'windsurf.ai', 'augmentcode.com',
      'v0.dev', 'bolt.new', 'lovable.dev', 'replit.com/ai',
      'comfyui.com', 'automatic1111.com', 'fooocus.ai',
    ],
    titleKeywords: [
      'chatgpt', 'gpt', 'ai', '人工智能', 'llm', 'prompt', '大模型', '生成式',
      'diffusion', 'transformer', 'neural', '机器学习', '深度学习',
      'stable diffusion', 'midjourney', 'dall-e', 'copilot',
      'embedding', 'fine-tune', 'rag', 'agent', 'chain-of-thought',
      '文生图', '图生图', '文生视频', 'ai绘画', 'ai写作',
    ],
    urlPatterns: ['/chat/', '/generate/', '/model/', '/inference/', '/completions/', '/playground/'],
    queryPatterns: ['model=', 'prompt=', 'q=', 'chat='],
    priority: 10,
  },
  {
    tag: 'gaming',
    subtags: ['pc', 'console', 'mobileGame', 'guide', 'esports'],
    domains: [
      'store.steampowered.com', 'steampowered.com', 'epicgames.com', 'playstation.com',
      'xbox.com', 'twitch.tv', 'nintendo.com', 'gog.com', 'origin.com',
      'blizzard.com', 'riotgames.com', 'ubisoft.com', 'ea.com',
      'taptap.com', '4399.com', '7k7k.com', '3dmgame.com',
      'ign.com', 'gamespot.com', 'polygon.com', 'kotaku.com',
      'nexusmods.com', 'moddb.com', 'curseforge.com',
      'speedrun.com', 'howlongtobeat.com', 'metacritic.com',
      'op.gg', 'u.gg', 'mobafire.com', 'lol.qq.com',
      'pvp.qq.com', 'cg.163.com', 'hs.blizzard.com',
      'playvalorant.com', 'playapex.com', 'playoverwatch.com',
      'genshin.hoyoverse.com', 'hoyolab.com', 'starrail.hoyoverse.com',
      'roblox.com', 'mojang.com', 'minecraft.net',
      'gamefaqs.gamespot.com', 'trueachievements.com',
      'deckbuilder', 'mmorpg.com', 'rockpapershotgun.com',
      'biligame.com', 'game.bilibili.com',
    ],
    domainSuffixes: ['.gg'],
    titleKeywords: [
      '游戏', 'game', 'gaming', '攻略', 'walkthrough', 'mod', '通关', '副本',
      'fps', 'rpg', 'moba', '开放世界', '角色扮演', 'steam',
      '电竞', 'esports', '排位', 'ranked', '赛季', 'season',
      '抽卡', 'gacha', '装备', 'build', '天赋', 'skill',
    ],
    urlPatterns: ['/game/', '/app/', '/store/', '/play/', '/mods/', '/wiki/'],
    queryPatterns: ['app_id=', 'game_id=', 'rank='],
    priority: 8,
  },
  {
    tag: 'finance',
    subtags: ['stocks', 'crypto', 'funds', 'banking'],
    domains: [
      'bloomberg.com', 'finance.yahoo.com', 'xueqiu.com', 'eastmoney.com',
      'coinmarketcap.com', 'binance.com', 'okx.com', 'huobi.com',
      'tradingview.com', 'investing.com', 'seekingalpha.com',
      'robinhood.com', 'fidelity.com', 'vanguard.com', 'schwab.com',
      'wallstreetcn.com', 'jinse.com', '8btc.com', 'mifengcha.com',
      'fund.eastmoney.com', 'laohu8.com', 'longbridgeapp.com',
      'rich.baidu.com', 'finance.sina.com.cn', 'stock.xueqiu.com',
      'icbc.com.cn', 'ccb.com', 'boc.cn', 'abchina.com', 'bankcomm.com',
      'cmbchina.com', 'spdb.com.cn', 'cib.com.cn',
      'paypal.com', 'wise.com', 'revolut.com',
      'coinbase.com', 'kraken.com', 'gate.io', 'bybit.com',
      'dune.com', 'defillama.com', 'etherscan.io', 'bscscan.com',
    ],
    titleKeywords: [
      '股票', '基金', '投资', '行情', '加密', 'crypto', 'bitcoin', 'btc', 'eth',
      '区块链', 'blockchain', 'defi', 'nft', '交易', 'trading', 'k线',
      '估值', '财报', 'ipo', '市值', '涨幅', '跌幅', '涨停',
      '利率', '通胀', '美联储', 'fed', 'bond', '期货', 'futures',
    ],
    urlPatterns: ['/quote/', '/stock/', '/crypto/', '/trade/', '/portfolio/', '/market/', '/fund/'],
    queryPatterns: ['symbol=', 'ticker=', 'pair='],
    priority: 8,
  },
  {
    tag: 'blog',
    subtags: ['techBlog', 'personalBlog', 'column'],
    domains: [
      'medium.com', 'substack.com', 'wordpress.com', 'ghost.org',
      'dev.to', 'hashnode.dev', 'hackernoon.com',
      'blog.cloudflare.com', 'blog.google', 'netflixtechblog.com',
      'engineering.fb.com', 'twobithistory.org', 'danluu.com',
      'paulgraham.com', 'blog.ycombinator.com', 'martinfowler.com',
      'joelonsoftware.com', 'vercel.com/blog', 'stripe.com/blog',
      'shopify.engineering', 'uber.com/blog',
      'cnblogs.com', 'iteye.com', 'oschina.net/blog',
      'sspai.com', 'ruanyifeng.com', 'coolshell.cn',
      'overreacted.io', 'kentcdodds.com', 'joshwcomeau.com',
    ],
    titleKeywords: ['博客', 'blog', '博文', '随笔', '思考', '心得', '经验分享', '踩坑', '专栏', 'column'],
    urlPatterns: ['/blog/', '/post/', '/article/', '/archive/', '/essays/'],
    priority: 5,
  },
  {
    tag: 'forum',
    subtags: ['techCommunity', 'interestCommunity', 'qna'],
    domains: [
      'v2ex.com', 'reddit.com', 'tieba.baidu.com',
      'douban.com/group', 'nga.cn', 'nga.178.com', 'colg.cn',
      'bbs.nga.cn', 'hostloc.com', 'linux.do',
      'testerhome.com', 'ruby-china.org', 'elixir-cn.org',
      'golangtc.com', 'python-china.org', 'cnodejs.org',
      '4chan.org', '8kun.top', 'discourse',
      'lesswrong.com', 'effectivealtruism.org',
      'chiphell.com', 'bbs.pcbeta.com', 'bbs.kafan.cn',
    ],
    domainSuffixes: ['.forum'],
    titleKeywords: ['论坛', 'forum', '社区', 'community', '讨论区', '板块', '帖子', '回帖', '问答', 'q&a'],
    urlPatterns: ['/forum/', '/board/', '/thread/', '/topic/', '/t/', '/c/', '/r/'],
    priority: 6,
  },
  {
    tag: 'tools',
    subtags: ['devTools', 'productivityTools', 'converterTools'],
    domains: [
      'translate.google.com', 'deepl.com', 'grammarly.com',
      '1password.com', 'bitwarden.com', 'lastpass.com',
      'wolframalpha.com', 'desmos.com', 'geogebra.org',
      'regex101.com', 'jsonformatter.org', 'codebeautify.org',
      'caniuse.com', 'bundlephobia.com', 'npm.anvaka.com',
      'speedtest.net', 'fast.com', 'whatismyip.com',
      'remove.bg', 'tinypng.com', 'squoosh.app', 'compressor.io',
      'carbon.now.sh', 'ray.so', 'snappify.com',
      'excalidraw.com', 'tldraw.com', 'whimsical.com',
      'mermaid.live', 'plantuml.com', 'websequencediagrams.com',
      'diffchecker.com', 'vim-adventures.com', 'typing.com',
      'jwt.io', 'base64encode.org', 'urlencoder.org',
      'cyberchef.org', 'gchq.github.io/CyberChef',
      'transform.tools', 'convertio.co', 'cloudconvert.com',
      'pdf24.org', 'ilovepdf.com', 'smallpdf.com',
      'temp-mail.org', 'guerrillamail.com',
      'downforeveryoneorjustme.com', 'isitdownrightnow.com',
    ],
    titleKeywords: [
      '工具', 'tool', '转换', 'converter', '计算器', 'calculator', '生成器', 'generator',
      '格式化', 'formatter', '压缩', 'compress', '加密', 'decrypt', 'encrypt',
      '编码', 'decode', 'encode', '校验', 'validate', '解析', 'parse',
    ],
    urlPatterns: ['/tool/', '/utils/', '/convert/', '/generate/', '/calculate/', '/format/', '/encode/'],
    priority: 6,
  },
  {
    tag: 'cloud',
    subtags: ['cloudPlatform', 'monitoring', 'cdn', 'serverless'],
    domains: [
      'console.aws.amazon.com', 'console.cloud.google.com', 'portal.azure.com',
      'dash.cloudflare.com', 'app.vercel.com', 'app.netlify.com',
      'dashboard.heroku.com', 'console.firebase.google.com',
      'manage.digitalocean.com', 'app.supabase.com',
      'oci.oraclecloud.com', 'console.alibabacloud.com',
      'console.tencentcloud.com', 'console.huaweicloud.com',
      'dashboard.stripe.com', 'dashboard.paypal.com',
      'analytics.google.com', 'search.google.com/search-console',
      'app.datadoghq.com', 'app.newrelic.com', 'grafana.com',
      'sentry.io', 'logrocket.com', 'pagerduty.com',
      'updown.io', 'pingdom.com', 'statuspage.io',
      'railway.app', 'render.com', 'fly.io',
      'planetscale.com', 'neon.tech', 'cockroachlabs.com',
      'turso.tech', 'xata.io', 'nhost.io',
    ],
    titleKeywords: [
      '云服务', 'cloud', '部署', 'deploy', '运维', 'devops', '监控', 'monitoring',
      '服务器', 'server', '域名', 'dns', 'cdn', '负载均衡', 'load balancer',
    ],
    urlPatterns: ['/console/', '/dashboard/', '/admin/', '/manage/', '/portal/', '/project/'],
    priority: 7,
  },
  {
    tag: 'health',
    subtags: ['medical', 'fitness', 'mental', 'diet'],
    domains: [
      'webmd.com', 'mayoclinic.org', 'healthline.com', 'nih.gov',
      'who.int', 'cdc.gov', 'medlineplus.gov',
      'dxy.com', 'chunyuyisheng.com', 'guahao.com',
      'keep.com', 'codoon.com', 'joyrun.com',
      'myfitnesspal.com', 'strava.com', 'fitbit.com',
      'calm.com', 'headspace.com', 'noom.com',
      'peloton.com', 'nike.com/nrc', 'adidas.com/running',
      'bodybuilding.com', 'muscleandstrength.com',
      'psychologytoday.com', 'betterhelp.com', 'talkspace.com',
    ],
    titleKeywords: [
      '健康', 'health', '医疗', '医学', '症状', '诊断', '养生', '运动', 'fitness',
      '减肥', '饮食', '营养', '睡眠', '心理', '冥想', 'meditation',
      '卡路里', 'calorie', '增肌', '减脂', '有氧', '无氧',
    ],
    urlPatterns: ['/health/', '/medical/', '/symptom/', '/fitness/', '/workout/', '/exercise/'],
    priority: 5,
  },
  {
    tag: 'travel',
    subtags: ['flights', 'hotels', 'travelGuide', 'visa'],
    domains: [
      'booking.com', 'airbnb.com', 'tripadvisor.com', 'expedia.com',
      'ctrip.com', 'qunar.com', 'mafengwo.cn', 'tuniu.com',
      'agoda.com', 'hotels.com', 'priceline.com',
      'skyscanner.com', 'kayak.com', 'google.com/travel',
      'rome2rio.com', 'lonelyplanet.com', 'wikivoyage.org',
      'viator.com', 'getyourguide.com', 'klook.com',
      'hostelworld.com', 'couchsurfing.com',
    ],
    titleKeywords: [
      '旅行', 'travel', '旅游', '机票', '酒店', '民宿', '景点', '攻略', '签证',
      'flight', 'hotel', 'booking', 'vacation', '度假', '行程', 'itinerary',
    ],
    urlPatterns: ['/travel/', '/hotel/', '/flight/', '/booking/', '/destination/', '/attraction/'],
    priority: 5,
  },
  {
    tag: 'food',
    subtags: ['delivery', 'recipes', 'restaurant', 'drinks'],
    domains: [
      'meituan.com', 'ele.me', 'dianping.com',
      'yelp.com', 'opentable.com', 'just-eat.com', 'deliveroo.com',
      'ubereats.com', 'doordash.com', 'grubhub.com',
      'xiachufang.com', 'cookpad.com', 'allrecipes.com',
      'foodnetwork.com', 'seriouseats.com', 'bonappetit.com',
      'starbucks.com', 'luckincoffee.com',
    ],
    titleKeywords: [
      '美食', '食谱', 'recipe', '烹饪', 'cooking', '餐厅', 'restaurant', '外卖',
      '菜单', 'menu', '烘焙', 'baking', '料理', '小吃', '咖啡', 'coffee',
    ],
    urlPatterns: ['/recipe/', '/restaurant/', '/food/', '/menu/', '/dish/'],
    priority: 5,
  },
  {
    tag: 'government',
    subtags: ['governmentAffairs', 'transportation', 'tax', 'socialSecurity'],
    domains: [
      'gov.cn', 'gov.uk', 'usa.gov', 'whitehouse.gov',
      'nhs.uk', 'irs.gov', 'ssa.gov',
      '12306.cn', 'gjj.beijing.gov.cn', 'bjzwfw.gov.cn',
      'shanghai.gov.cn', 'gd.gov.cn', 'sz.gov.cn',
      'nhs.uk', 'service.gov.uk', 'usa.gov',
      'chengdu.gov.cn', 'hangzhou.gov.cn', 'nanjing.gov.cn',
      'chongqing.gov.cn', 'tianjin.gov.cn', 'wuhan.gov.cn',
    ],
    domainSuffixes: ['.gov', '.gov.cn', '.gov.uk', '.gov.us'],
    titleKeywords: ['政府', '政务', '办事', '公积金', '社保', '税务', '工商', '民政', '户籍', '护照', '签证'],
    urlPatterns: ['/gov/', '/public/', '/service/', '/portal/', '/zwfw/'],
    priority: 4,
  },
  {
    tag: 'search',
    domains: [
      'google.com', 'google.com.hk', 'baidu.com', 'bing.com', 'sogou.com',
      'so.com', 'duckduckgo.com', 'yandex.com', 'ecosia.org',
      'search.yahoo.com', 'startpage.com', 'brave.com/search',
      'google.co.jp', 'google.co.kr', 'google.de', 'google.fr',
    ],
    titleKeywords: ['搜索', 'search', '查找', 'query', '搜索结果'],
    urlPatterns: ['/search?', '/s?', '/webhp?', '/results', '/search/'],
    queryPatterns: ['q=', 'query=', 'wd=', 'word=', 'text='],
    priority: 3,
  },
  {
    tag: 'reading',
    subtags: ['novel', 'info', 'rss'],
    domains: [
      'readwise.io', 'pocket.com', 'instapaper.com', 'readability.com',
      'feedly.com', 'inoreader.com', 'theoldreader.com', 'miniflux',
      'qidian.com', 'jjwxc.net', 'zongheng.com', '17k.com',
      'kindle.amazon.com', 'goodreads.com', 'book.douban.com',
      'z-library.org', 'gutenberg.org', 'archive.org',
      'weread.qq.com', 'duokan.com', 'dushu.baidu.com',
      'medium.com', 'substack.com', 'sspai.com',
    ],
    titleKeywords: [
      '阅读', 'reading', '小说', 'novel', '书评', 'book review',
      '章节', 'chapter', '连载', 'serial', 'rss', '订阅', 'subscribe',
    ],
    urlPatterns: ['/read/', '/book/', '/chapter/', '/article/', '/feed/', '/novel/'],
    priority: 5,
  },
  {
    tag: 'dev',
    subtags: ['ide', 'cicd', 'testing'],
    domains: [
      'github.com', 'gitlab.com', 'bitbucket.org',
      'code.visualstudio.com', 'jetbrains.com', 'eclipse.org',
      'circleci.com', 'travis-ci.org', 'github.com/features/actions',
      'jenkins.io', 'buildkite.com', 'teamcity',
      'sonarqube.org', 'snyk.io', 'codacy.com',
      'browserstack.com', 'saucelabs.com', 'cypress.io',
      'playwright.dev', 'selenium.dev',
      'figma.com/dev', 'storybook.js.org',
      'linear.app', 'shortcut.com', 'jira.atlassian.net',
    ],
    titleKeywords: [
      'ide', '编辑器', 'editor', '编译', 'compile', '构建', 'build',
      '测试', 'test', '部署', 'deploy', '发布', 'release',
      '代码审查', 'code review', '合并', 'merge', '分支', 'branch',
    ],
    urlPatterns: ['/dev/', '/build/', '/test/', '/deploy/', '/release/', '/pipeline/'],
    priority: 7,
  },
  {
    tag: 'photography',
    subtags: ['gallery', 'postProcessing', 'equipment'],
    domains: [
      'flickr.com', '500px.com', 'unsplash.com', 'pexels.com', 'pixabay.com',
      'adobe.com/lightroom', 'captureone.com', 'darkroom.co',
      'dpreview.com', 'petapixel.com', 'fstoppers.com',
      'lensculture.com', '1x.com', 'viewbug.com',
      'vsco.co', 'lightroom.adobe.com', 'snapseed',
    ],
    titleKeywords: [
      '摄影', 'photography', 'photo', '相机', 'camera', '镜头', 'lens',
      '曝光', 'exposure', '光圈', 'aperture', '快门', 'shutter',
      '后期', 'retouch', '修图', '滤镜', 'filter',
    ],
    urlPatterns: ['/photo/', '/gallery/', '/album/', '/portfolio/', '/shots/'],
    priority: 4,
  },
  {
    tag: 'education',
    subtags: ['k12', 'university', 'gradExam', 'vocational'],
    domains: [
      'edu.cn', 'mooc.cn', 'chaoxing.com', 'xueersi.com',
      'zhangmen.com', 'yuanfudao.com', 'hujiang.com',
      'koolearn.com', 'neworiental.org', 'offcn.com',
      'kaoyan.com', 'chinakaoyan.com',
      'collegeboard.org', 'ets.org', 'ielts.org',
      'toefl.org', 'gre.org',
      'wikipedia.org', 'britannica.com', 'wikihow.com',
    ],
    domainSuffixes: ['.edu'],
    titleKeywords: [
      '教育', 'education', '学校', 'school', '考试', 'exam', '成绩', 'grade',
      '课程', 'curriculum', '学期', 'semester', '招生', 'admission',
      '考研', '考公', '雅思', '托福', 'gre', 'gmat',
    ],
    urlPatterns: ['/edu/', '/school/', '/exam/', '/admission/', '/course/'],
    priority: 6,
  },
  {
    tag: 'sports',
    subtags: ['football', 'basketball', 'esports', 'fitness'],
    domains: [
      'espn.com', 'sports.yahoo.com', 'skysports.com', 'bbc.com/sport',
      'nba.com', 'fifa.com', 'uefa.com',
      'dongqiudi.com', 'zhibo8.com', 'hupu.com',
      '懂球帝', '直播吧', '虎扑',
      'strava.com', 'garmin.com', 'mapmyrun.com',
      'bodybuilding.com', 'muscleandstrength.com',
    ],
    titleKeywords: [
      '体育', 'sport', '足球', 'football', 'soccer', '篮球', 'basketball',
      'nba', '比分', 'score', '联赛', 'league', '冠军', 'champion',
      '奥运', 'olympics', '世界杯', 'world cup',
    ],
    urlPatterns: ['/sport/', '/match/', '/score/', '/league/', '/player/'],
    priority: 4,
  },
  {
    tag: 'automotive',
    subtags: ['carPurchase', 'review', 'maintenance', 'newEnergy'],
    domains: [
      'autohome.com.cn', 'dongchedi.com', 'yiche.com',
      'pcauto.com.cn', 'xcar.com.cn', 'cheshi.com',
      'caranddriver.com', 'motortrend.com', 'edmunds.com',
      'tesla.com', 'byd.com', 'nio.com', 'xiaopeng.com', 'lixiang.com',
      'evspecifications.com', 'insideevs.com',
    ],
    titleKeywords: [
      '汽车', 'car', 'auto', '购车', '买车', '试驾', '评测',
      '电动车', 'ev', '新能源', '充电桩', '续航', '油耗',
      '保养', '维修', '改装', 'suv', '轿车',
    ],
    urlPatterns: ['/car/', '/auto/', '/model/', '/spec/', '/review/'],
    priority: 4,
  },
  {
    tag: 'realestate',
    subtags: ['renting', 'buying', 'renovation'],
    domains: [
      'lianjia.com', 'ke.com', 'anjuke.com', 'fang.com',
      'ziroom.com', 'danke.com', 'mogoroom.com',
      'zillow.com', 'realtor.com', 'redfin.com', 'trulia.com',
      'rightmove.co.uk', 'zoopla.co.uk',
      'tubatu.com', 'qijia.com', 'jia.com',
    ],
    titleKeywords: [
      '房产', '房子', '租房', '买房', '房价', '房贷', '装修',
      'real estate', 'apartment', 'house', 'rent', 'mortgage',
      '二手房', '新房', '楼盘', '户型', '学区房',
    ],
    urlPatterns: ['/house/', '/rent/', '/property/', '/apartment/', '/community/'],
    priority: 4,
  },
  {
    tag: 'law',
    domains: [
      'court.gov.cn', 'wenshu.court.gov.cn', 'chinacourt.org',
      'lawyer.com', 'legalzoom.com', 'avvo.com',
      'findlaw.com', 'justia.com', 'law.cornell.edu',
    ],
    domainSuffixes: ['.law'],
    titleKeywords: [
      '法律', 'law', '律师', 'lawyer', '诉讼', 'litigation',
      '合同', 'contract', '法规', 'regulation', '判例', 'case',
    ],
    urlPatterns: ['/law/', '/legal/', '/case/', '/statute/'],
    priority: 3,
  },
  {
    tag: 'jobs',
    subtags: ['jobSearch', 'resume', 'interview'],
    domains: [
      'zhipin.com', 'liepin.com', '51job.com', 'zhaopin.com',
      'linkedin.com/jobs', 'indeed.com', 'glassdoor.com',
      'monster.com', 'dice.com', 'simplyhired.com',
      'maimai.cn', 'lagou.com', 'neitui.me',
      'angel.co', 'wellfound.com', 'ycombinator.com/jobs',
    ],
    titleKeywords: [
      '招聘', '求职', 'job', 'career', '简历', 'resume', '面试', 'interview',
      '薪资', 'salary', 'offer', '跳槽', '校招', '实习', 'intern',
    ],
    urlPatterns: ['/job/', '/career/', '/position/', '/resume/', '/company/'],
    queryPatterns: ['job_id=', 'position=', 'location='],
    priority: 5,
  },
]

interface SubtagRule {
  subtag: string
  parentTag: string
  domains?: string[]
  pathKeywords?: string[]
  titleKeywords?: string[]
  productivity: 'productive' | 'neutral' | 'unproductive'
}

const SUBTAG_RULES: SubtagRule[] = [
  { subtag: 'frontend', parentTag: 'tech', domains: ['vuejs.org', 'react.dev', 'angular.io', 'svelte.dev', 'nextjs.org', 'nuxt.com', 'tailwindcss.com', 'unocss.dev', 'mui.com', 'ant.design', 'vitejs.dev', 'webpack.js.org'], pathKeywords: ['vue', 'react', 'angular', 'svelte', 'css', 'html', 'dom', 'webpack', 'vite', 'component', 'hook', 'render', 'bundle'], titleKeywords: ['前端', 'frontend', 'vue', 'react', 'angular', 'css', '组件', 'component'], productivity: 'productive' },
  { subtag: 'backend', parentTag: 'tech', domains: ['expressjs.com', 'fastapi.tiangolo.com', 'django.com', 'flask.palletsprojects.com', 'spring.io', 'laravel.com', 'gin-gonic.com', 'graphql.org', 'hasura.io', 'trpc.io', 'prisma.io', 'drizzle.team'], pathKeywords: ['api', 'server', 'database', 'rest', 'graphql', 'microservice', 'middleware', 'orm', 'sql', 'nosql'], titleKeywords: ['后端', 'backend', 'api', '数据库', 'server'], productivity: 'productive' },
  { subtag: 'competitiveProgramming', parentTag: 'tech', domains: ['leetcode.com', 'codeforces.com', 'hackerrank.com', 'codewars.com', 'atcoder.jp', 'topcoder.com', 'spoj.com', 'projecteuler.net'], pathKeywords: ['problem', 'contest', 'challenge', 'solution', 'submit'], titleKeywords: ['刷题', 'leetcode', '算法题', '竞赛', 'oj', '编程题'], productivity: 'productive' },
  { subtag: 'devOps', parentTag: 'tech', domains: ['docker.com', 'kubernetes.io', 'jenkins.io', 'grafana.com', 'prometheus.io', 'sentry.io', 'circleci.com'], pathKeywords: ['deploy', 'pipeline', 'container', 'docker', 'k8s', 'ci/cd', 'monitoring'], titleKeywords: ['部署', 'deploy', '运维', 'devops', '容器', 'docker'], productivity: 'productive' },
  { subtag: 'opensource', parentTag: 'tech', domains: ['github.com', 'gitlab.com', 'bitbucket.org', 'npmjs.com', 'pypi.org', 'crates.io'], pathKeywords: ['repos', 'packages', 'issues', 'pull', 'commit', 'releases', 'fork'], titleKeywords: ['开源', 'opensource', '仓库', 'repository', '贡献', 'contributing'], productivity: 'productive' },
  { subtag: 'documentation', parentTag: 'tech', domains: ['developer.mozilla.org', 'docs.rs', 'pkg.go.dev', 'docs.python.org', 'typescriptlang.org', 'readthedocs.io'], pathKeywords: ['docs', 'documentation', 'reference', 'guide', 'manual', 'api-docs'], titleKeywords: ['文档', 'docs', '手册', '指南', 'reference'], productivity: 'productive' },
  { subtag: 'security', parentTag: 'tech', domains: ['owasp.org', 'portswigger.net', 'hackthebox.com', 'tryhackme.com'], pathKeywords: ['vulnerability', 'exploit', 'pentest', 'cve'], titleKeywords: ['安全', 'security', '漏洞', '渗透', 'xss', 'csrf'], productivity: 'productive' },
  { subtag: 'shortVideo', parentTag: 'video', domains: ['tiktok.com', 'douyin.com'], pathKeywords: ['shorts', 'short-video', 'reels'], titleKeywords: ['短视频', 'short video', '抖音', 'tiktok'], productivity: 'unproductive' },
  { subtag: 'longVideo', parentTag: 'video', domains: ['youtube.com', 'bilibili.com', 'netflix.com', 'vimeo.com', 'iqiyi.com', 'youku.com'], pathKeywords: ['watch', 'video', 'episode', 'season'], titleKeywords: ['视频', 'video', '电影', 'movie', '番剧', '纪录片'], productivity: 'unproductive' },
  { subtag: 'liveStream', parentTag: 'video', domains: ['twitch.tv', 'live.bilibili.com', 'douyu.com', 'huya.com'], pathKeywords: ['live', 'stream', 'broadcast'], titleKeywords: ['直播', 'live', 'stream'], productivity: 'unproductive' },
  { subtag: 'instantMessaging', parentTag: 'social', domains: ['discord.com', 'telegram.org', 'slack.com', 'weixin.qq.com', 'web.whatsapp.com', 'messenger.com', 'teams.microsoft.com', 'skype.com'], pathKeywords: ['chat', 'dm', 'messages', 'channel'], titleKeywords: ['聊天', 'chat', '私信', '群聊', '消息'], productivity: 'neutral' },
  { subtag: 'communityForum', parentTag: 'social', domains: ['reddit.com', 'zhihu.com', 'tieba.baidu.com', 'v2ex.com', 'douban.com', 'quora.com', 'stackexchange.com'], pathKeywords: ['forum', 'thread', 'topic', 'post', 'comment', 'discussion'], titleKeywords: ['论坛', '社区', '讨论', '问答', '帖子'], productivity: 'neutral' },
  { subtag: 'professionalSocial', parentTag: 'social', domains: ['linkedin.com'], pathKeywords: ['profile', 'network', 'connection'], titleKeywords: ['职场', '人脉', 'professional'], productivity: 'productive' },
  { subtag: 'photoSocial', parentTag: 'social', domains: ['instagram.com', 'pinterest.com', 'xiaohongshu.com'], pathKeywords: ['photo', 'pin', 'post', 'feed'], titleKeywords: ['图片', '照片', '分享'], productivity: 'unproductive' },
  { subtag: 'onlineCourse', parentTag: 'education', domains: ['coursera.org', 'udemy.com', 'edx.org', 'pluralsight.com', 'skillshare.com', 'udacity.com', 'codecademy.com', 'datacamp.com', 'imooc.com', 'xuetangx.com', 'icourse163.org'], pathKeywords: ['course', 'lesson', 'lecture', 'enroll'], titleKeywords: ['课程', 'course', '在线课', 'mooc'], productivity: 'productive' },
  { subtag: 'selfLearning', parentTag: 'education', domains: ['wikipedia.org', 'wikihow.com', 'runoob.com', 'w3schools.com', 'tutorialspoint.com', 'geeksforgeeks.org', 'brilliant.org', 'khanacademy.org'], pathKeywords: ['wiki', 'learn', 'tutorial', 'guide', 'how-to'], titleKeywords: ['学习', '教程', '入门', '指南', '百科'], productivity: 'productive' },
  { subtag: 'academic', parentTag: 'education', domains: ['scholar.google.com', 'arxiv.org', 'researchgate.net', 'semanticscholar.org', 'academia.edu', 'springer.com', 'ieee.org', 'doi.org'], pathKeywords: ['paper', 'article', 'citation', 'abstract', 'research'], titleKeywords: ['论文', 'paper', '研究', '学术', '期刊'], productivity: 'productive' },
  { subtag: 'ecommerce', parentTag: 'shopping', domains: ['taobao.com', 'jd.com', 'amazon.com', 'pinduoduo.com', 'tmall.com', 'ebay.com', 'walmart.com', 'suning.com', 'vip.com'], pathKeywords: ['product', 'item', 'cart', 'checkout', 'order', 'goods'], titleKeywords: ['购物', '购买', '下单', '商品'], productivity: 'unproductive' },
  { subtag: 'reviews', parentTag: 'shopping', domains: ['smzdm.com', 'zol.com.cn', 'dianping.com'], pathKeywords: ['review', 'rating', 'compare'], titleKeywords: ['测评', '评测', '比价', '推荐'], productivity: 'neutral' },
  { subtag: 'streaming', parentTag: 'music', domains: ['spotify.com', 'music.163.com', 'music.apple.com', 'tidal.com', 'deezer.com', 'y.qq.com', 'kugou.com', 'kuwo.cn'], pathKeywords: ['track', 'album', 'playlist', 'artist', 'song'], titleKeywords: ['音乐', 'music', '歌单', '专辑'], productivity: 'unproductive' },
  { subtag: 'creation', parentTag: 'music', domains: ['soundcloud.com', 'bandcamp.com'], pathKeywords: ['upload', 'create', 'studio'], titleKeywords: ['创作', '原创', '制作'], productivity: 'productive' },
  { subtag: 'pcGaming', parentTag: 'gaming', domains: ['store.steampowered.com', 'epicgames.com', 'gog.com'], pathKeywords: ['store', 'app', 'game', 'library'], titleKeywords: ['steam', 'pc游戏', '单机'], productivity: 'unproductive' },
  { subtag: 'mobileGaming', parentTag: 'gaming', domains: ['taptap.com', '4399.com', '7k7k.com'], pathKeywords: ['mobile', 'android', 'ios'], titleKeywords: ['手游', '手机游戏'], productivity: 'unproductive' },
  { subtag: 'trading', parentTag: 'finance', domains: ['xueqiu.com', 'tradingview.com', 'robinhood.com', 'binance.com', 'coinmarketcap.com', 'okx.com', 'eastmoney.com', 'finance.yahoo.com'], pathKeywords: ['quote', 'stock', 'crypto', 'trade', 'chart', 'kline'], titleKeywords: ['股票', '行情', '交易', 'k线', '加密'], productivity: 'neutral' },
  { subtag: 'banking', parentTag: 'finance', domains: ['icbc.com.cn', 'ccb.com', 'boc.cn', 'cmbchina.com', 'paypal.com', 'wise.com'], pathKeywords: ['account', 'transfer', 'payment'], titleKeywords: ['银行', '转账', '支付'], productivity: 'neutral' },
  { subtag: 'novel', parentTag: 'reading', domains: ['qidian.com', 'jjwxc.net', 'zongheng.com', '17k.com', 'weread.qq.com', 'kindle.amazon.com'], pathKeywords: ['chapter', 'novel', 'book', 'read'], titleKeywords: ['小说', 'novel', '章节', '连载'], productivity: 'unproductive' },
  { subtag: 'articles', parentTag: 'reading', domains: ['medium.com', 'substack.com', 'sspai.com', 'pocket.com', 'readwise.io', 'feedly.com'], pathKeywords: ['article', 'post', 'blog', 'feed'], titleKeywords: ['文章', '阅读', 'rss', '订阅'], productivity: 'neutral' },
  { subtag: 'uiDesign', parentTag: 'design', domains: ['figma.com', 'dribbble.com', 'behance.net', 'framer.com', 'penpot.app', 'sketch.com', 'awwwards.com'], pathKeywords: ['design', 'prototype', 'canvas', 'shot', 'portfolio'], titleKeywords: ['ui', 'ux', '设计', '原型', '交互'], productivity: 'productive' },
  { subtag: 'designTools', parentTag: 'design', domains: ['canva.com', 'adobe.com', 'unsplash.com', 'pexels.com', 'pixabay.com', 'freepik.com'], pathKeywords: ['template', 'asset', 'image', 'icon', 'font'], titleKeywords: ['素材', '模板', '图标', '字体'], productivity: 'productive' },
  { subtag: 'booking', parentTag: 'travel', domains: ['booking.com', 'ctrip.com', 'airbnb.com', 'agoda.com', 'hotels.com', 'qunar.com', 'expedia.com'], pathKeywords: ['booking', 'hotel', 'flight', 'reservation'], titleKeywords: ['预订', '机票', '酒店', '民宿'], productivity: 'neutral' },
  { subtag: 'travelInfo', parentTag: 'travel', domains: ['tripadvisor.com', 'mafengwo.cn', 'lonelyplanet.com', 'wikivoyage.org'], pathKeywords: ['destination', 'attraction', 'guide', 'review'], titleKeywords: ['攻略', '景点', '旅行'], productivity: 'neutral' },
  { subtag: 'delivery', parentTag: 'food', domains: ['meituan.com', 'ele.me', 'ubereats.com', 'doordash.com', 'dianping.com'], pathKeywords: ['order', 'delivery', 'restaurant'], titleKeywords: ['外卖', '配送', '点餐'], productivity: 'neutral' },
  { subtag: 'recipes', parentTag: 'food', domains: ['xiachufang.com', 'cookpad.com', 'allrecipes.com', 'foodnetwork.com', 'seriouseats.com'], pathKeywords: ['recipe', 'cook', 'ingredient', 'dish'], titleKeywords: ['食谱', '烹饪', '做法', '菜谱'], productivity: 'neutral' },
  { subtag: 'fitness', parentTag: 'health', domains: ['keep.com', 'myfitnesspal.com', 'strava.com', 'bodybuilding.com'], pathKeywords: ['workout', 'exercise', 'training', 'fitness'], titleKeywords: ['健身', '运动', '锻炼', '减肥'], productivity: 'neutral' },
  { subtag: 'medical', parentTag: 'health', domains: ['webmd.com', 'mayoclinic.org', 'dxy.com', 'chunyuyisheng.com', 'guahao.com'], pathKeywords: ['symptom', 'diagnosis', 'treatment', 'doctor'], titleKeywords: ['医疗', '症状', '诊断', '医生'], productivity: 'neutral' },
  { subtag: 'notes', parentTag: 'docs', domains: ['notion.so', 'obsidian.md', 'logseq.com', 'roamresearch.com', 'evernote.com', 'craft.do', 'bear.app'], pathKeywords: ['note', 'page', 'block', 'journal'], titleKeywords: ['笔记', '笔记', '知识库', 'notion'], productivity: 'productive' },
  { subtag: 'projectManagement', parentTag: 'docs', domains: ['jira.atlassian.net', 'trello.com', 'asana.com', 'clickup.com', 'linear.app', 'shortcut.com'], pathKeywords: ['board', 'sprint', 'task', 'issue', 'project'], titleKeywords: ['项目管理', '看板', '任务', 'sprint'], productivity: 'productive' },
  { subtag: 'email', parentTag: 'social', domains: ['mail.google.com', 'outlook.com', 'outlook.live.com', 'mail.qq.com', 'mail.163.com', 'proton.me', 'mail.yahoo.com'], pathKeywords: ['mail', 'inbox', 'compose', 'draft', 'sent'], titleKeywords: ['邮件', 'email', '收件箱'], productivity: 'productive' },
  { subtag: 'meeting', parentTag: 'social', domains: ['zoom.us', 'teams.microsoft.com', 'meet.google.com', 'webex.com'], pathKeywords: ['meeting', 'conference', 'call', 'video-call'], titleKeywords: ['会议', '视频会议', 'meeting'], productivity: 'productive' },
  { subtag: 'chat', parentTag: 'ai', domains: ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'poe.com', 'character.ai', 'copilot.microsoft.com', 'chat.zhipu.ai', 'kimi.moonshot.cn', 'doubao.com', 'tongyi.aliyun.com', 'yiyan.baidu.com'], pathKeywords: ['chat', 'conversation', 'prompt', 'completions'], titleKeywords: ['对话', 'chat', 'gpt', '大模型', 'ai助手'], productivity: 'productive' },
  { subtag: 'imageGeneration', parentTag: 'ai', domains: ['midjourney.com', 'stability.ai', 'leonardo.ai', 'playground.ai', 'civitai.com', 'comfyui.com'], pathKeywords: ['generate', 'image', 'create', 'art'], titleKeywords: ['文生图', 'ai绘画', '图像生成', 'diffusion'], productivity: 'productive' },
  { subtag: 'codeAssistant', parentTag: 'ai', domains: ['cursor.com', 'github.com/features/copilot', 'windsurf.ai', 'augmentcode.com', 'v0.dev', 'bolt.new', 'lovable.dev'], pathKeywords: ['code', 'suggest', 'complete', 'generate'], titleKeywords: ['代码助手', 'ai编程', 'copilot', '代码生成'], productivity: 'productive' },
]

const URL_SEMANTIC_PATTERNS: { pattern: string; tag: string; subtag?: string; confidence: number }[] = [
  { pattern: '/docs/', tag: 'tech', subtag: 'documentation', confidence: 0.6 },
  { pattern: '/documentation/', tag: 'tech', subtag: 'documentation', confidence: 0.6 },
  { pattern: '/api/', tag: 'tech', subtag: 'backend', confidence: 0.5 },
  { pattern: '/sdk/', tag: 'tech', confidence: 0.5 },
  { pattern: '/tutorial/', tag: 'education', subtag: 'selfLearning', confidence: 0.6 },
  { pattern: '/course/', tag: 'education', subtag: 'onlineCourse', confidence: 0.65 },
  { pattern: '/learn/', tag: 'education', subtag: 'selfLearning', confidence: 0.5 },
  { pattern: '/wiki/', tag: 'education', subtag: 'selfLearning', confidence: 0.55 },
  { pattern: '/blog/', tag: 'reading', subtag: 'articles', confidence: 0.5 },
  { pattern: '/post/', tag: 'reading', subtag: 'articles', confidence: 0.45 },
  { pattern: '/article/', tag: 'reading', subtag: 'articles', confidence: 0.5 },
  { pattern: '/questions/', tag: 'tech', subtag: 'opensource', confidence: 0.55 },
  { pattern: '/issues/', tag: 'tech', subtag: 'opensource', confidence: 0.5 },
  { pattern: '/watch', tag: 'video', subtag: 'longVideo', confidence: 0.5 },
  { pattern: '/video/', tag: 'video', subtag: 'longVideo', confidence: 0.55 },
  { pattern: '/live/', tag: 'video', subtag: 'liveStream', confidence: 0.55 },
  { pattern: '/shorts/', tag: 'video', subtag: 'shortVideo', confidence: 0.6 },
  { pattern: '/shop/', tag: 'shopping', subtag: 'ecommerce', confidence: 0.5 },
  { pattern: '/product/', tag: 'shopping', subtag: 'ecommerce', confidence: 0.45 },
  { pattern: '/recipe/', tag: 'food', subtag: 'recipes', confidence: 0.55 },
  { pattern: '/booking/', tag: 'travel', subtag: 'booking', confidence: 0.55 },
  { pattern: '/hotel/', tag: 'travel', subtag: 'booking', confidence: 0.55 },
  { pattern: '/flight/', tag: 'travel', subtag: 'booking', confidence: 0.55 },
  { pattern: '/search', tag: 'search', confidence: 0.4 },
  { pattern: '/mail/', tag: 'social', subtag: 'email', confidence: 0.5 },
  { pattern: '/inbox/', tag: 'social', subtag: 'email', confidence: 0.55 },
  { pattern: '/chat/', tag: 'ai', subtag: 'chat', confidence: 0.45 },
  { pattern: '/game/', tag: 'gaming', confidence: 0.5 },
  { pattern: '/news/', tag: 'news', confidence: 0.5 },
  { pattern: '/music/', tag: 'music', confidence: 0.5 },
  { pattern: '/health/', tag: 'health', confidence: 0.5 },
  { pattern: '/fitness/', tag: 'health', subtag: 'fitness', confidence: 0.55 },
  { pattern: '/design/', tag: 'design', confidence: 0.5 },
]

const TAG_PRODUCTIVITY: Record<string, 'productive' | 'neutral' | 'unproductive'> = {
  tech: 'productive', education: 'productive', docs: 'productive', cloud: 'productive',
  design: 'productive', dev: 'productive', tools: 'productive', ai: 'productive',
  search: 'neutral', news: 'neutral', health: 'neutral', government: 'neutral',
  law: 'neutral', realestate: 'neutral', automotive: 'neutral', reading: 'neutral',
  finance: 'neutral', travel: 'neutral', food: 'neutral', jobs: 'neutral',
  sports: 'neutral', photography: 'neutral', forum: 'neutral', email: 'productive',
  social: 'unproductive', video: 'unproductive', gaming: 'unproductive',
  music: 'unproductive', shopping: 'unproductive', blog: 'neutral',
}

export function getTagProductivity(tag: string): 'productive' | 'neutral' | 'unproductive' {
  return TAG_PRODUCTIVITY[tag] || 'neutral'
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

export function autoTagDetailed(url: string, title: string): TagResult[] {
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

  for (const rule of TAG_RULES) {
    const exactDomainMatch = rule.domains.some(d => domain === d || registeredDomain === d)
    if (exactDomainMatch) {
      candidates.push({ tag: rule.tag, confidence: 0.95, source: 'domain' })
      continue
    }

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
    for (const pattern of URL_SEMANTIC_PATTERNS) {
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
    const subtagRules = SUBTAG_RULES.filter(r => r.parentTag === tag)

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
      for (const pattern of URL_SEMANTIC_PATTERNS) {
        if (pattern.subtag && pattern.tag === tag && urlPath.includes(pattern.pattern)) {
          if (!matchedSubtags.includes(pattern.subtag)) {
            matchedSubtags.push(pattern.subtag)
          }
        }
      }
    }

    data.subtags = matchedSubtags
  }

  const hour = new Date().getHours()
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
