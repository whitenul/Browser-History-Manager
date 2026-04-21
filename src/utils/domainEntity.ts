import { parse } from 'tldts'

export interface DomainEntity {
  id: string
  name: string
  names: { en: string; zh: string }
  domains: string[]
  primaryTag: string
  primarySubtag?: string
}

export interface DomainRelationship {
  source: string
  target: string
  type: 'parent' | 'subsidiary' | 'sibling' | 'partner' | 'competitor'
  confidence: number
}

export interface DomainGraphNode {
  domain: string
  entity?: DomainEntity
  tags: string[]
  visitCount: number
}

export interface DomainGraphEdge {
  source: string
  target: string
  type: 'same-entity' | 'parent-subsidiary' | 'sibling' | 'session-co-visit'
  weight: number
}

const DOMAIN_ENTITIES: DomainEntity[] = [
  {
    id: 'google',
    name: 'Google',
    names: { en: 'Google', zh: '谷歌' },
    domains: [
      'google.com', 'youtube.com', 'gmail.com', 'google.dev',
      'android.com', 'chromium.org', 'firebase.google.com',
      'cloud.google.com', 'ai.google', 'deepmind.com',
      'blogger.com', 'blogspot.com', 'googlemaps.com',
      'play.google.com', 'store.google.com', 'google.co.jp',
      'google.co.uk', 'google.de', 'google.fr', 'googleapis.com',
      'gstatic.com', 'google-analytics.com', 'googletagmanager.com',
      'googleadservices.com', 'doubleclick.net', 'adsense.com',
      'adwords.google.com', 'console.cloud.google.com',
      'developers.google.com', 'workspace.google.com',
      'chat.google.com', 'meet.google.com', 'drive.google.com',
      'docs.google.com', 'sheets.google.com', 'slides.google.com',
      'calendar.google.com', 'photos.google.com', 'maps.google.com',
      'news.google.com', 'translate.google.com',
    ],
    primaryTag: 'tech',
    primarySubtag: 'backend',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    names: { en: 'Microsoft', zh: '微软' },
    domains: [
      'microsoft.com', 'azure.microsoft.com', 'teams.microsoft.com',
      'office.com', 'outlook.com', 'live.com', 'skype.com',
      'github.com', 'linkedin.com', 'xbox.com', 'bing.com',
      'visualstudio.com', 'devblogs.microsoft.com', 'learn.microsoft.com',
      'msn.com', 'onenote.com', 'sharepoint.com', 'dynamics.com',
      'powerapps.com', 'powerbi.com', 'azure.com', 'nuget.org',
      'dotnet.microsoft.com', 'typescriptlang.org',
    ],
    primaryTag: 'tech',
    primarySubtag: 'devOps',
  },
  {
    id: 'meta',
    name: 'Meta',
    names: { en: 'Meta', zh: 'Meta' },
    domains: [
      'facebook.com', 'instagram.com', 'whatsapp.com', 'web.whatsapp.com',
      'messenger.com', 'meta.com', 'oculus.com', 'threads.net',
      'meta.ai', 'ai.meta.com',
    ],
    primaryTag: 'social',
    primarySubtag: 'photoSocial',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    names: { en: 'Amazon', zh: '亚马逊' },
    domains: [
      'amazon.com', 'aws.amazon.com', 'amazonaws.com',
      'primevideo.com', 'twitch.tv', 'imdb.com',
      'audible.com', 'goodreads.com', 'wholefoodsmarket.com',
      'amazon.co.jp', 'amazon.co.uk', 'amazon.de',
      'cloudfront.net', 'elasticbeanstalk.com',
    ],
    primaryTag: 'shopping',
    primarySubtag: 'ecommerce',
  },
  {
    id: 'apple',
    name: 'Apple',
    names: { en: 'Apple', zh: '苹果' },
    domains: [
      'apple.com', 'icloud.com', 'appsto.re', 'developer.apple.com',
      'support.apple.com', 'music.apple.com', 'tv.apple.com',
      'apps.apple.com', 'store.apple.com', 'mac.com',
    ],
    primaryTag: 'tech',
    primarySubtag: 'mobile',
  },
  {
    id: 'bytedance',
    name: 'ByteDance',
    names: { en: 'ByteDance', zh: '字节跳动' },
    domains: [
      'tiktok.com', 'douyin.com', 'bytedance.com',
      'toutiao.com', 'feishu.cn', 'larksuite.com',
      'doubao.com', 'volcengine.com',
    ],
    primaryTag: 'video',
    primarySubtag: 'shortVideo',
  },
  {
    id: 'alibaba',
    name: 'Alibaba',
    names: { en: 'Alibaba', zh: '阿里巴巴' },
    domains: [
      'taobao.com', 'tmall.com', 'alibaba.com', 'aliyun.com',
      '1688.com', 'alipay.com', 'dingtalk.com', 'ele.me',
      'amap.com', 'youku.com', 'uc.cn', 'aliexpress.com',
      'tongyi.aliyun.com', 'qwenlm.ai',
    ],
    primaryTag: 'shopping',
    primarySubtag: 'ecommerce',
  },
  {
    id: 'tencent',
    name: 'Tencent',
    names: { en: 'Tencent', zh: '腾讯' },
    domains: [
      'qq.com', 'weixin.qq.com', 'wx.qq.com', 'web.wechat.com',
      'tencent.com', 'wechat.com', 'v.qq.com', 'y.qq.com',
      'kugou.com', 'kuwo.cn', 'jianshu.com', 'meishichina.com',
      'pinduoduo.com', 'weread.qq.com', 'mail.qq.com',
      'yiyan.baidu.com',
    ],
    primaryTag: 'social',
    primarySubtag: 'instantMessaging',
  },
  {
    id: 'baidu',
    name: 'Baidu',
    names: { en: 'Baidu', zh: '百度' },
    domains: [
      'baidu.com', 'tieba.baidu.com', 'zhihuishu.com',
      'bilibili.com', 'iqiyi.com', 'hao123.com',
      'baidu.cn', 'yiyan.baidu.com',
    ],
    primaryTag: 'search',
  },
  {
    id: 'netease',
    name: 'NetEase',
    names: { en: 'NetEase', zh: '网易' },
    domains: [
      '163.com', 'netease.com', 'music.163.com', 'mail.163.com',
      '126.com', 'youdao.com', 'lofter.com',
    ],
    primaryTag: 'music',
    primarySubtag: 'streaming',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    names: { en: 'OpenAI', zh: 'OpenAI' },
    domains: [
      'openai.com', 'chat.openai.com', 'chatgpt.com',
      'platform.openai.com', 'api.openai.com',
    ],
    primaryTag: 'ai',
    primarySubtag: 'chat',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    names: { en: 'Anthropic', zh: 'Anthropic' },
    domains: ['anthropic.com', 'claude.ai'],
    primaryTag: 'ai',
    primarySubtag: 'chat',
  },
  {
    id: 'xai',
    name: 'xAI',
    names: { en: 'xAI', zh: 'xAI' },
    domains: ['x.ai', 'grok.x.ai'],
    primaryTag: 'ai',
    primarySubtag: 'chat',
  },
  {
    id: 'x_corp',
    name: 'X Corp',
    names: { en: 'X Corp', zh: 'X公司' },
    domains: ['x.com', 'twitter.com', 't.co', 'periscope.tv'],
    primaryTag: 'social',
    primarySubtag: 'communityForum',
  },
  {
    id: 'samsung',
    name: 'Samsung',
    names: { en: 'Samsung', zh: '三星' },
    domains: ['samsung.com', 'samsungcloud.com', 'smartthings.com'],
    primaryTag: 'tech',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    names: { en: 'Oracle', zh: '甲骨文' },
    domains: ['oracle.com', 'java.com', 'mysql.com', 'virtualbox.org', 'grafana.com'],
    primaryTag: 'tech',
    primarySubtag: 'backend',
  },
  {
    id: 'ibm',
    name: 'IBM',
    names: { en: 'IBM', zh: 'IBM' },
    domains: ['ibm.com', 'redhat.com', 'weather.com', 'stackoverflow.com', 'stackexchange.com'],
    primaryTag: 'tech',
    primarySubtag: 'backend',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    names: { en: 'Salesforce', zh: 'Salesforce' },
    domains: ['salesforce.com', 'slack.com', 'heroku.com', 'tableau.com', 'mulesoft.com'],
    primaryTag: 'tools',
  },
  {
    id: 'adobe',
    name: 'Adobe',
    names: { en: 'Adobe', zh: 'Adobe' },
    domains: ['adobe.com', 'behance.net', 'figma.com', 'fonts.adobe.com'],
    primaryTag: 'design',
    primarySubtag: 'designTools',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    names: { en: 'Spotify', zh: 'Spotify' },
    domains: ['spotify.com', 'scdn.co', 'spotifycdn.com'],
    primaryTag: 'music',
    primarySubtag: 'streaming',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    names: { en: 'Netflix', zh: 'Netflix' },
    domains: ['netflix.com', 'nflximg.com', 'nflxvideo.net'],
    primaryTag: 'video',
    primarySubtag: 'longVideo',
  },
  {
    id: 'disney',
    name: 'Disney',
    names: { en: 'The Walt Disney Company', zh: '迪士尼' },
    domains: ['disneyplus.com', 'espn.com', 'hulu.com', 'disney.com', 'marvel.com'],
    primaryTag: 'video',
    primarySubtag: 'longVideo',
  },
  {
    id: 'warner_bros',
    name: 'Warner Bros. Discovery',
    names: { en: 'Warner Bros. Discovery', zh: '华纳兄弟探索' },
    domains: ['hbomax.com', 'cnn.com', 'tbs.com', 'tntdrama.com', 'dc.com'],
    primaryTag: 'video',
    primarySubtag: 'longVideo',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    names: { en: 'NVIDIA', zh: '英伟达' },
    domains: ['nvidia.com', 'geforce.com', 'nvidia.cn'],
    primaryTag: 'tech',
  },
  {
    id: 'intel',
    name: 'Intel',
    names: { en: 'Intel', zh: '英特尔' },
    domains: ['intel.com', 'intel.cn'],
    primaryTag: 'tech',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    names: { en: 'Cloudflare', zh: 'Cloudflare' },
    domains: ['cloudflare.com', 'workers.cloudflare.com', 'pages.cloudflare.com', '1.1.1.1'],
    primaryTag: 'tech',
    primarySubtag: 'devOps',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    names: { en: 'Vercel', zh: 'Vercel' },
    domains: ['vercel.com', 'nextjs.org', 'vercel.app', 'now.sh'],
    primaryTag: 'tech',
    primarySubtag: 'frontend',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    names: { en: 'GitLab', zh: 'GitLab' },
    domains: ['gitlab.com', 'about.gitlab.com'],
    primaryTag: 'tech',
    primarySubtag: 'opensource',
  },
  {
    id: 'atlassian',
    name: 'Atlassian',
    names: { en: 'Atlassian', zh: 'Atlassian' },
    domains: ['atlassian.com', 'jira.atlassian.net', 'trello.com', 'confluence.atlassian.net'],
    primaryTag: 'docs',
    primarySubtag: 'projectManagement',
  },
  {
    id: 'notion',
    name: 'Notion',
    names: { en: 'Notion', zh: 'Notion' },
    domains: ['notion.so', 'notion.site', 'notionusercontent.com'],
    primaryTag: 'docs',
    primarySubtag: 'notes',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    names: { en: 'Stripe', zh: 'Stripe' },
    domains: ['stripe.com', 'stripe.dev'],
    primaryTag: 'finance',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    names: { en: 'Shopify', zh: 'Shopify' },
    domains: ['shopify.com', 'myshopify.com', 'shopify.dev'],
    primaryTag: 'shopping',
    primarySubtag: 'ecommerce',
  },
  {
    id: 'didi',
    name: 'DiDi',
    names: { en: 'DiDi', zh: '滴滴' },
    domains: ['didiglobal.com', 'xiaojukeji.com', 'didichuxing.com'],
    primaryTag: 'travel',
  },
  {
    id: 'meituan',
    name: 'Meituan',
    names: { en: 'Meituan', zh: '美团' },
    domains: ['meituan.com', 'dianping.com', 'meituan.cn'],
    primaryTag: 'food',
    primarySubtag: 'delivery',
  },
  {
    id: 'jd',
    name: 'JD.com',
    names: { en: 'JD.com', zh: '京东' },
    domains: ['jd.com', 'jd.hk', 'jdcdn.com'],
    primaryTag: 'shopping',
    primarySubtag: 'ecommerce',
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi',
    names: { en: 'Xiaomi', zh: '小米' },
    domains: ['mi.com', 'xiaomi.com', 'miui.com'],
    primaryTag: 'tech',
  },
  {
    id: 'huawei',
    name: 'Huawei',
    names: { en: 'Huawei', zh: '华为' },
    domains: ['huawei.com', 'vmall.com', 'harmonyos.com', 'huaweicloud.com'],
    primaryTag: 'tech',
  },
  {
    id: 'bilibili',
    name: 'Bilibili',
    names: { en: 'Bilibili', zh: '哔哩哔哩' },
    domains: ['bilibili.com', 'live.bilibili.com', 'b23.tv', 'biligc.com'],
    primaryTag: 'video',
    primarySubtag: 'longVideo',
  },
  {
    id: 'zhihu',
    name: 'Zhihu',
    names: { en: 'Zhihu', zh: '知乎' },
    domains: ['zhihu.com', 'zhuanlan.zhihu.com'],
    primaryTag: 'social',
    primarySubtag: 'communityForum',
  },
  {
    id: 'douban',
    name: 'Douban',
    names: { en: 'Douban', zh: '豆瓣' },
    domains: ['douban.com'],
    primaryTag: 'social',
    primarySubtag: 'communityForum',
  },
  {
    id: 'steam',
    name: 'Valve (Steam)',
    names: { en: 'Valve', zh: 'Valve' },
    domains: ['steampowered.com', 'steamcommunity.com', 'steamstore.com', 'valvesoftware.com'],
    primaryTag: 'gaming',
    primarySubtag: 'pcGaming',
  },
  {
    id: 'epic_games',
    name: 'Epic Games',
    names: { en: 'Epic Games', zh: 'Epic Games' },
    domains: ['epicgames.com', 'unrealengine.com', 'fortnite.com'],
    primaryTag: 'gaming',
    primarySubtag: 'pcGaming',
  },
  {
    id: 'mozilla',
    name: 'Mozilla',
    names: { en: 'Mozilla', zh: 'Mozilla' },
    domains: ['mozilla.org', 'firefox.com', 'mdn.dev', 'developer.mozilla.org', 'bugzilla.mozilla.org'],
    primaryTag: 'tech',
    primarySubtag: 'opensource',
  },
  {
    id: 'canonical',
    name: 'Canonical',
    names: { en: 'Canonical', zh: 'Canonical' },
    domains: ['ubuntu.com', 'canonical.com', 'launchpad.net', 'snapcraft.io'],
    primaryTag: 'tech',
    primarySubtag: 'devOps',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    names: { en: 'DigitalOcean', zh: 'DigitalOcean' },
    domains: ['digitalocean.com'],
    primaryTag: 'cloud',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    names: { en: 'Supabase', zh: 'Supabase' },
    domains: ['supabase.com'],
    primaryTag: 'tech',
    primarySubtag: 'backend',
  },
  {
    id: 'docker',
    name: 'Docker',
    names: { en: 'Docker', zh: 'Docker' },
    domains: ['docker.com', 'hub.docker.com', 'docker.io'],
    primaryTag: 'tech',
    primarySubtag: 'devOps',
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    names: { en: 'Kubernetes', zh: 'Kubernetes' },
    domains: ['kubernetes.io', 'k8s.io'],
    primaryTag: 'tech',
    primarySubtag: 'devOps',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains',
    names: { en: 'JetBrains', zh: 'JetBrains' },
    domains: ['jetbrains.com', 'intellij.net', 'kotlinlang.org'],
    primaryTag: 'tech',
    primarySubtag: 'devOps',
  },
  {
    id: 'wikipedia',
    name: 'Wikimedia',
    names: { en: 'Wikimedia', zh: '维基媒体' },
    domains: ['wikipedia.org', 'wikimedia.org', 'wikidata.org', 'wikivoyage.org', 'wiktionary.org'],
    primaryTag: 'education',
    primarySubtag: 'selfLearning',
  },
  {
    id: 'coursera',
    name: 'Coursera',
    names: { en: 'Coursera', zh: 'Coursera' },
    domains: ['coursera.org'],
    primaryTag: 'education',
    primarySubtag: 'onlineCourse',
  },
  {
    id: 'booking_holdings',
    name: 'Booking Holdings',
    names: { en: 'Booking Holdings', zh: 'Booking集团' },
    domains: ['booking.com', 'kayak.com', 'priceline.com', 'agoda.com', 'opentable.com'],
    primaryTag: 'travel',
    primarySubtag: 'booking',
  },
  {
    id: 'expedia_group',
    name: 'Expedia Group',
    names: { en: 'Expedia Group', zh: 'Expedia集团' },
    domains: ['expedia.com', 'hotels.com', 'vrbo.com', 'trivago.com', 'orbitz.com'],
    primaryTag: 'travel',
    primarySubtag: 'booking',
  },
  {
    id: 'ctrip',
    name: 'Trip.com Group',
    names: { en: 'Trip.com Group', zh: '携程集团' },
    domains: ['ctrip.com', 'trip.com', 'qunar.com', 'skyscanner.com', 'makemytrip.com'],
    primaryTag: 'travel',
    primarySubtag: 'booking',
  },
]

const DOMAIN_RELATIONSHIPS: DomainRelationship[] = [
  { source: 'google', target: 'alphabet', type: 'subsidiary', confidence: 1.0 },
  { source: 'microsoft', target: 'openai', type: 'partner', confidence: 0.8 },
  { source: 'meta', target: 'x_corp', type: 'competitor', confidence: 0.9 },
  { source: 'meta', target: 'bytedance', type: 'competitor', confidence: 0.85 },
  { source: 'amazon', target: 'microsoft', type: 'competitor', confidence: 0.7 },
  { source: 'amazon', target: 'google', type: 'competitor', confidence: 0.75 },
  { source: 'alibaba', target: 'jd', type: 'competitor', confidence: 0.9 },
  { source: 'alibaba', target: 'pinduoduo', type: 'competitor', confidence: 0.85 },
  { source: 'tencent', target: 'alibaba', type: 'competitor', confidence: 0.8 },
  { source: 'tencent', target: 'bytedance', type: 'competitor', confidence: 0.85 },
  { source: 'bytedance', target: 'x_corp', type: 'competitor', confidence: 0.8 },
  { source: 'openai', target: 'anthropic', type: 'competitor', confidence: 0.9 },
  { source: 'openai', target: 'google', type: 'competitor', confidence: 0.85 },
  { source: 'openai', target: 'xai', type: 'competitor', confidence: 0.8 },
  { source: 'anthropic', target: 'google', type: 'partner', confidence: 0.7 },
  { source: 'vercel', target: 'cloudflare', type: 'competitor', confidence: 0.6 },
  { source: 'vercel', target: 'netlify', type: 'competitor', confidence: 0.7 },
  { source: 'steam', target: 'epic_games', type: 'competitor', confidence: 0.9 },
  { source: 'booking_holdings', target: 'expedia_group', type: 'competitor', confidence: 0.85 },
  { source: 'booking_holdings', target: 'ctrip', type: 'competitor', confidence: 0.7 },
  { source: 'netflix', target: 'disney', type: 'competitor', confidence: 0.9 },
  { source: 'netflix', target: 'warner_bros', type: 'competitor', confidence: 0.85 },
  { source: 'spotify', target: 'netease', type: 'competitor', confidence: 0.7 },
  { source: 'spotify', target: 'apple', type: 'competitor', confidence: 0.75 },
  { source: 'adobe', target: 'figma', type: 'subsidiary', confidence: 1.0 },
  { source: 'ibm', target: 'redhat', type: 'subsidiary', confidence: 1.0 },
  { source: 'salesforce', target: 'slack', type: 'subsidiary', confidence: 1.0 },
  { source: 'salesforce', target: 'heroku', type: 'subsidiary', confidence: 1.0 },
  { source: 'atlassian', target: 'trello', type: 'subsidiary', confidence: 1.0 },
  { source: 'microsoft', target: 'github', type: 'subsidiary', confidence: 1.0 },
  { source: 'microsoft', target: 'linkedin', type: 'subsidiary', confidence: 1.0 },
  { source: 'microsoft', target: 'skype', type: 'subsidiary', confidence: 1.0 },
  { source: 'google', target: 'youtube', type: 'subsidiary', confidence: 1.0 },
  { source: 'google', target: 'android', type: 'subsidiary', confidence: 1.0 },
  { source: 'amazon', target: 'twitch', type: 'subsidiary', confidence: 1.0 },
  { source: 'amazon', target: 'imdb', type: 'subsidiary', confidence: 1.0 },
  { source: 'bytedance', target: 'tiktok', type: 'subsidiary', confidence: 1.0 },
  { source: 'bytedance', target: 'douyin', type: 'subsidiary', confidence: 1.0 },
  { source: 'alibaba', target: 'taobao', type: 'subsidiary', confidence: 1.0 },
  { source: 'alibaba', target: 'tmall', type: 'subsidiary', confidence: 1.0 },
  { source: 'alibaba', target: 'aliyun', type: 'subsidiary', confidence: 1.0 },
  { source: 'tencent', target: 'qq', type: 'subsidiary', confidence: 1.0 },
  { source: 'tencent', target: 'wechat', type: 'subsidiary', confidence: 1.0 },
  { source: 'disney', target: 'hulu', type: 'subsidiary', confidence: 0.67 },
  { source: 'disney', target: 'espn', type: 'subsidiary', confidence: 0.8 },
  { source: 'xiaomi', target: 'huawei', type: 'competitor', confidence: 0.8 },
  { source: 'xiaomi', target: 'samsung', type: 'competitor', confidence: 0.75 },
  { source: 'huawei', target: 'samsung', type: 'competitor', confidence: 0.8 },
  { source: 'docker', target: 'kubernetes', type: 'sibling', confidence: 0.7 },
  { source: 'canonical', target: 'redhat', type: 'competitor', confidence: 0.7 },
]

let entityIndexBuilt = false
const DOMAIN_ENTITY_INDEX = new Map<string, DomainEntity>()
const ENTITY_RELATIONSHIP_INDEX = new Map<string, DomainRelationship[]>()

export function buildEntityIndex(): void {
  if (entityIndexBuilt) return
  for (const entity of DOMAIN_ENTITIES) {
    for (const domain of entity.domains) {
      DOMAIN_ENTITY_INDEX.set(domain, entity)
    }
  }
  for (const rel of DOMAIN_RELATIONSHIPS) {
    const existing = ENTITY_RELATIONSHIP_INDEX.get(rel.source) || []
    existing.push(rel)
    ENTITY_RELATIONSHIP_INDEX.set(rel.source, existing)
  }
  entityIndexBuilt = true
}

export function getEntityForDomain(domain: string): DomainEntity | undefined {
  if (!entityIndexBuilt) buildEntityIndex()
  return DOMAIN_ENTITY_INDEX.get(domain)
}

export function getEntityRelationships(entityId: string): DomainRelationship[] {
  if (!entityIndexBuilt) buildEntityIndex()
  return ENTITY_RELATIONSHIP_INDEX.get(entityId) || []
}

export function getEntityById(id: string): DomainEntity | undefined {
  return DOMAIN_ENTITIES.find(e => e.id === id)
}

export function getAllEntities(): DomainEntity[] {
  return DOMAIN_ENTITIES
}

export function getAllRelationships(): DomainRelationship[] {
  return DOMAIN_RELATIONSHIPS
}

export function getRegisteredDomain(url: string): string {
  try {
    const result = parse(url)
    return result.domain || ''
  } catch {
    return ''
  }
}

export function getPublicSuffix(url: string): string {
  try {
    const result = parse(url)
    return result.publicSuffix || ''
  } catch {
    return ''
  }
}

export function getSubdomain(url: string): string {
  try {
    const result = parse(url)
    return result.subdomain || ''
  } catch {
    return ''
  }
}

export function getDomainFromTldts(url: string): string {
  try {
    const result = parse(url)
    if (result.domain) return result.domain
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export interface DomainFeatures {
  tldType: 'generic' | 'country' | 'new-gtld' | 'unknown'
  domainLength: number
  hasHyphen: boolean
  digitRatio: number
  vowelRatio: number
  pathDepth: number
  entityMatch: string | null
}

const COUNTRY_TLDS = new Set([
  'cn', 'jp', 'uk', 'de', 'fr', 'kr', 'ru', 'br', 'in', 'au',
  'ca', 'it', 'es', 'mx', 'nl', 'se', 'no', 'ch', 'at', 'be',
  'dk', 'fi', 'ie', 'pt', 'pl', 'cz', 'hu', 'ro', 'bg', 'hr',
  'sg', 'hk', 'tw', 'th', 'vn', 'my', 'id', 'ph', 'ar', 'cl',
  'co', 'pe', 've', 'za', 'ng', 'eg', 'ke', 'ma', 'il', 'ae',
  'sa', 'tr', 'gr', 'nz',
])

const NEW_GTLDS = new Set([
  'dev', 'app', 'io', 'ai', 'co', 'sh', 'so', 'me', 'tv', 'cloud',
  'tech', 'design', 'art', 'blog', 'shop', 'store', 'online', 'site',
  'website', 'fun', 'game', 'games', 'code', 'tools', 'world', 'space',
  'link', 'click', 'one', 'life', 'live', 'news', 'music', 'video',
])

export function extractDomainFeatures(url: string): DomainFeatures {
  const parsed = parse(url)
  const domain = parsed.domain || ''
  const publicSuffix = parsed.publicSuffix || ''
  const tld = publicSuffix.split('.').pop() || ''

  let tldType: DomainFeatures['tldType'] = 'unknown'
  if (COUNTRY_TLDS.has(tld)) tldType = 'country'
  else if (NEW_GTLDS.has(tld)) tldType = 'new-gtld'
  else if (tld.length > 0) tldType = 'generic'

  const entity = getEntityForDomain(domain)
  const label = parsed.hostname || ''
  const vowels = (label.match(/[aeiou]/gi) || []).length
  const digits = (label.match(/[0-9]/g) || []).length

  let pathDepth = 0
  try {
    pathDepth = new URL(url).pathname.split('/').filter(Boolean).length
  } catch { /* ignore */ }

  return {
    tldType,
    domainLength: domain.length,
    hasHyphen: domain.includes('-'),
    digitRatio: label.length > 0 ? digits / label.length : 0,
    vowelRatio: label.length > 0 ? vowels / label.length : 0,
    pathDepth,
    entityMatch: entity?.id || null,
  }
}

export function buildDomainGraph(
  domainVisitCounts: Map<string, number>,
  topN: number = 15
): { nodes: DomainGraphNode[]; edges: DomainGraphEdge[] } {
  if (!entityIndexBuilt) buildEntityIndex()

  const sortedDomains = Array.from(domainVisitCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)

  const nodes: DomainGraphNode[] = sortedDomains.map(([domain, visitCount]) => {
    const entity = DOMAIN_ENTITY_INDEX.get(domain)
    return {
      domain,
      entity,
      tags: [],
      visitCount,
    }
  })

  const edges: DomainGraphEdge[] = []
  const nodeDomains = new Set(nodes.map(n => n.domain))

  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i]
    const entityA = nodeA.entity

    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j]
      const entityB = nodeB.entity

      if (entityA && entityB) {
        if (entityA.id === entityB.id) {
          edges.push({
            source: nodeA.domain,
            target: nodeB.domain,
            type: 'same-entity',
            weight: 1.0,
          })
          continue
        }

        const relsA = ENTITY_RELATIONSHIP_INDEX.get(entityA.id) || []
        const relAB = relsA.find(r => r.target === entityB.id)
        if (relAB) {
          const edgeType: DomainGraphEdge['type'] =
            relAB.type === 'parent' || relAB.type === 'subsidiary'
              ? 'parent-subsidiary'
              : 'sibling'
          edges.push({
            source: nodeA.domain,
            target: nodeB.domain,
            type: edgeType,
            weight: relAB.confidence,
          })
        }
      }
    }
  }

  return { nodes, edges }
}

export interface CoVisitRecord {
  domainA: string
  domainB: string
  coVisitCount: number
  avgTimeGapMs: number
}

export class SessionCoVisitAnalyzer {
  private coVisitMatrix = new Map<string, Map<string, { count: number; totalGap: number }>>()
  private readonly sessionWindowMs: number

  constructor(sessionWindowMs: number = 5 * 60 * 1000) {
    this.sessionWindowMs = sessionWindowMs
  }

  analyzeSessions(
    records: Array<{ domain: string; lastVisitTime: number }>,
    maxDomains: number = 50
  ): void {
    this.coVisitMatrix.clear()

    const domainCount = new Map<string, number>()
    for (const r of records) {
      domainCount.set(r.domain, (domainCount.get(r.domain) || 0) + 1)
    }

    const topDomains = new Set(
      Array.from(domainCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxDomains)
        .map(([d]) => d)
    )

    const sorted = [...records].sort((a, b) => a.lastVisitTime - b.lastVisitTime)

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]
      if (!topDomains.has(a.domain)) continue

      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]
        const gap = b.lastVisitTime - a.lastVisitTime
        if (gap > this.sessionWindowMs) break
        if (!topDomains.has(b.domain)) continue
        if (a.domain === b.domain) continue

        const key1 = a.domain < b.domain ? a.domain : b.domain
        const key2 = a.domain < b.domain ? b.domain : a.domain

        let inner = this.coVisitMatrix.get(key1)
        if (!inner) {
          inner = new Map()
          this.coVisitMatrix.set(key1, inner)
        }
        const existing = inner.get(key2) || { count: 0, totalGap: 0 }
        existing.count++
        existing.totalGap += gap
        inner.set(key2, existing)
      }
    }
  }

  getAffinity(domainA: string, domainB: string): number {
    const key1 = domainA < domainB ? domainA : domainB
    const key2 = domainA < domainB ? domainB : domainA
    const inner = this.coVisitMatrix.get(key1)
    if (!inner) return 0
    const record = inner.get(key2)
    if (!record) return 0
    return Math.min(1, record.count / 10)
  }

  getRelatedDomains(domain: string, topK: number = 5): CoVisitRecord[] {
    const results: CoVisitRecord[] = []

    for (const [key1, inner] of this.coVisitMatrix) {
      for (const [key2, data] of inner) {
        if (key1 === domain || key2 === domain) {
          const other = key1 === domain ? key2 : key1
          results.push({
            domainA: domain,
            domainB: other,
            coVisitCount: data.count,
            avgTimeGapMs: data.count > 0 ? Math.round(data.totalGap / data.count) : 0,
          })
        }
      }
    }

    return results.sort((a, b) => b.coVisitCount - a.coVisitCount).slice(0, topK)
  }

  getCoVisitEdges(minCount: number = 2): DomainGraphEdge[] {
    const edges: DomainGraphEdge[] = []
    for (const [key1, inner] of this.coVisitMatrix) {
      for (const [key2, data] of inner) {
        if (data.count >= minCount) {
          edges.push({
            source: key1,
            target: key2,
            type: 'session-co-visit',
            weight: Math.min(1, data.count / 10),
          })
        }
      }
    }
    return edges.sort((a, b) => b.weight - a.weight)
  }
}

export interface ConfidenceCorrection {
  domain: string
  fromTag: string
  toTag: string
  timestamp: number
}

const CORRECTIONS_KEY = 'domain_tag_corrections'

export class AdaptiveConfidenceAdjuster {
  private corrections = new Map<string, ConfidenceCorrection>()

  async load(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(CORRECTIONS_KEY)
      if (data[CORRECTIONS_KEY]) {
        const arr: ConfidenceCorrection[] = JSON.parse(data[CORRECTIONS_KEY] as string)
        for (const c of arr) {
          this.corrections.set(c.domain, c)
        }
      }
    } catch { /* ignore */ }
  }

  async recordCorrection(domain: string, fromTag: string, toTag: string): Promise<void> {
    const correction: ConfidenceCorrection = {
      domain,
      fromTag,
      toTag,
      timestamp: Date.now(),
    }
    this.corrections.set(domain, correction)
    await this.persist()
  }

  adjustConfidence(domain: string, candidates: Array<{ tag: string; confidence: number }>): Array<{ tag: string; confidence: number }> {
    const correction = this.corrections.get(domain)
    if (!correction) return candidates

    return candidates.map(c => {
      if (c.tag === correction.fromTag) {
        return { ...c, confidence: c.confidence * 0.5 }
      }
      if (c.tag === correction.toTag) {
        return { ...c, confidence: Math.min(1, c.confidence * 1.3) }
      }
      return c
    })
  }

  getCorrection(domain: string): ConfidenceCorrection | undefined {
    return this.corrections.get(domain)
  }

  private async persist(): Promise<void> {
    try {
      const arr = Array.from(this.corrections.values())
      await chrome.storage.local.set({ [CORRECTIONS_KEY]: JSON.stringify(arr) })
    } catch { /* ignore */ }
  }
}
