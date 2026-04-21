import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { murmurHash3 } from '@/utils/murmurHash3'
import { collectAllFingerprints, getCachedFingerprint, setCachedFingerprint, clearFingerprintCache } from '@/composables/useFingerprint'
import { useStatsStore } from '@/stores/stats'
import { useHistoryStore } from '@/stores/history'
import { autoTagDetailed, getTagProductivity, getEntityForDomain, getAllEntities } from '@/utils/helpers'
import type { FingerprintResult, SuperDNA, BehavioralDimension, MatchResult, Archetype } from '@/types/fingerprint'

const ARCHETYPES: Archetype[] = [
  {
    id: 'scholar',
    labelKey: 'dna.archetypes.scholar',
    descKey: 'dna.archetypes.scholarDesc',
    center: { knowledgeDepth: 0.7, contentRatio: 0.6, focusIndex: 0.6, stability: 0.5 },
  },
  {
    id: 'explorer',
    labelKey: 'dna.archetypes.explorer',
    descKey: 'dna.archetypes.explorerDesc',
    center: { diversityIndex: 0.7, curiosity: 0.7, explorationBreadth: 0.6, shiftFrequency: 0.5 },
  },
  {
    id: 'specialist',
    labelKey: 'dna.archetypes.specialist',
    descKey: 'dna.archetypes.specialistDesc',
    center: { knowledgeDepth: 0.8, loyalty: 0.7, focusIndex: 0.7, stability: 0.6 },
  },
  {
    id: 'socializer',
    labelKey: 'dna.archetypes.socializer',
    descKey: 'dna.archetypes.socializerDesc',
    center: { socialEngagement: 0.7, interactivity: 0.6, diversityIndex: 0.5, shiftFrequency: 0.4 },
  },
  {
    id: 'creator',
    labelKey: 'dna.archetypes.creator',
    descKey: 'dna.archetypes.creatorDesc',
    center: { productivityRatio: 0.6, focusIndex: 0.7, knowledgeDepth: 0.5, rhythmicity: 0.5 },
  },
  {
    id: 'consumer',
    labelKey: 'dna.archetypes.consumer',
    descKey: 'dna.archetypes.consumerDesc',
    center: { entertainmentRatio: 0.7, contentRatio: 0.5, nightOwlIndex: 0.4, interactivity: 0.3 },
  },
  {
    id: 'nightOwl',
    labelKey: 'dna.archetypes.nightOwl',
    descKey: 'dna.archetypes.nightOwlDesc',
    center: { nightOwlIndex: 0.8, shiftFrequency: 0.5, intensity: 0.5, entertainmentRatio: 0.4 },
  },
  {
    id: 'rhythmic',
    labelKey: 'dna.archetypes.rhythmic',
    descKey: 'dna.archetypes.rhythmicDesc',
    center: { rhythmicity: 0.8, stability: 0.7, morningIndex: 0.5, focusIndex: 0.5 },
  },
]

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let dotProduct = 0, normA = 0, normB = 0
  for (const key of keys) {
    const va = a[key] || 0
    const vb = b[key] || 0
    dotProduct += va * vb
    normA += va * va
    normB += vb * vb
  }
  return normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0
}

function computeArchetype(dimensions: BehavioralDimension[]): string {
  const userVector: Record<string, number> = {}
  for (const d of dimensions) userVector[d.key] = d.value

  let bestMatch = ARCHETYPES[0]
  let bestSimilarity = -1

  for (const archetype of ARCHETYPES) {
    const similarity = cosineSimilarity(userVector, archetype.center)
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestMatch = archetype
    }
  }

  return bestMatch.id
}

function compareCanvasRegions(currentRaw: unknown, cachedRaw: unknown): number {
  try {
    const curr = JSON.parse(currentRaw as string)
    const cached = JSON.parse(cachedRaw as string)
    const currRegions: string[] = curr.regionHashes || []
    const cachedRegions: string[] = cached.regionHashes || []

    if (currRegions.length === 0 || cachedRegions.length === 0) return 0

    let matched = 0
    for (let i = 0; i < Math.min(currRegions.length, cachedRegions.length); i++) {
      if (currRegions[i] === cachedRegions[i]) matched++
    }

    return matched / Math.max(currRegions.length, cachedRegions.length)
  } catch {
    return 0
  }
}

function matchFingerprint(current: SuperDNA, cached: SuperDNA): MatchResult {
  let matchedWeight = 0
  let totalWeight = 0
  const changedDimensions: string[] = []

  for (const curr of current.hardware.dimensions) {
    const cached2 = cached.hardware.dimensions.find(d => d.key === curr.key)
    if (!cached2 || !curr.hash || !cached2.hash) continue
    totalWeight += curr.weight

    if (curr.key === 'canvas') {
      const similarity = compareCanvasRegions(curr.raw, cached2.raw)
      if (similarity >= 0.75) {
        matchedWeight += curr.weight
      } else {
        changedDimensions.push(curr.key)
      }
    } else {
      if (curr.hash === cached2.hash) {
        matchedWeight += curr.weight
      } else {
        changedDimensions.push(curr.key)
      }
    }
  }

  const similarity = totalWeight > 0 ? matchedWeight / totalWeight : 0

  if (similarity >= 0.75) return { match: 'same', similarity, changedDimensions }
  if (similarity >= 0.5) return { match: 'changed', similarity, changedDimensions }
  return { match: 'different', similarity, changedDimensions }
}

function updateStability(current: SuperDNA, cached: SuperDNA | null): number {
  if (!cached) return 1.0

  const matchResult = matchFingerprint(current, cached)

  switch (matchResult.match) {
    case 'same':
      return Math.min(1.0, cached.fusion.stability + 0.1)
    case 'changed':
      return cached.fusion.stability * 0.8
    case 'different':
      return 0.2
  }
}

function computeSuperDNA(
  hardwareResults: FingerprintResult[],
  behavioralDims: BehavioralDimension[],
  cachedDna: SuperDNA | null
): SuperDNA {
  const successfulResults = hardwareResults.filter(r => r.confidence > 0)
  const totalOriginalWeight = hardwareResults.reduce((s, r) => s + r.weight, 0)
  const totalSuccessfulWeight = successfulResults.reduce((s, r) => s + r.weight, 0)

  const normalizedResults = successfulResults.map(r => ({
    ...r,
    weight: totalSuccessfulWeight > 0
      ? (r.weight / totalSuccessfulWeight) * totalOriginalWeight
      : 0,
  }))

  const hwHashes = normalizedResults.map(d => d.hash).join('')
  const hardwareHash = murmurHash3(hwHashes)

  const bhValues = behavioralDims.map(d => `${d.key}:${d.value.toFixed(4)}`).join('|')
  const behavioralHash = murmurHash3(bhValues)

  const superId = murmurHash3(hardwareHash + behavioralHash)

  const confidence = totalOriginalWeight > 0 ? totalSuccessfulWeight / totalOriginalWeight : 0

  const archetype = computeArchetype(behavioralDims)

  const uniqueness = normalizedResults.reduce(
    (sum, r) => sum + r.value * r.weight, 0
  )

  const result: SuperDNA = {
    id: superId,
    hardware: { dimensions: normalizedResults, hash: hardwareHash, confidence },
    behavioral: { dimensions: behavioralDims, hash: behavioralHash },
    fusion: { archetype, stability: 1.0, uniqueness },
    timestamp: Date.now(),
    version: '3.0',
  }

  result.fusion.stability = updateStability(result, cachedDna)

  return result
}

interface TagVisit {
  tag: string
  subtag: string | undefined
  count: number
  productivity: 'productive' | 'neutral' | 'unproductive'
}

function computeTagDistribution(records: { url: string; title: string }[]): {
  tagMap: Map<string, TagVisit>
  totalTagged: number
} {
  const tagMap = new Map<string, TagVisit>()

  for (const r of records) {
    const results = autoTagDetailed(r.url, r.title || '')
    for (const result of results) {
      const key = result.subtags.length > 0 ? `${result.tag}:${result.subtags[0]}` : result.tag
      const existing = tagMap.get(key)
      if (existing) {
        existing.count++
      } else {
        tagMap.set(key, {
          tag: result.tag,
          subtag: result.subtags[0],
          count: 1,
          productivity: getTagProductivity(result.tag),
        })
      }
    }
  }

  let totalTagged = 0
  for (const v of tagMap.values()) totalTagged += v.count

  return { tagMap, totalTagged }
}

function computeBehavioralDimensions(): BehavioralDimension[] {
  const stats = useStatsStore()
  const history = useHistoryStore()
  const records = history.allRecords
  const total = stats.overview.totalVisits || 1

  const { tagMap, totalTagged } = computeTagDistribution(records)

  let productiveCount = 0
  let unproductiveCount = 0
  let neutralCount = 0
  let techCount = 0
  let eduCount = 0
  let videoCount = 0
  let socialCount = 0
  let gamingCount = 0
  let readingCount = 0
  let musicCount = 0

  for (const [, tv] of tagMap) {
    switch (tv.productivity) {
      case 'productive': productiveCount += tv.count; break
      case 'unproductive': unproductiveCount += tv.count; break
      default: neutralCount += tv.count; break
    }
    switch (tv.tag) {
      case 'tech': case 'dev': case 'docs': techCount += tv.count; break
      case 'education': eduCount += tv.count; break
      case 'video': videoCount += tv.count; break
      case 'social': socialCount += tv.count; break
      case 'gaming': gamingCount += tv.count; break
      case 'reading': readingCount += tv.count; break
      case 'music': musicCount += tv.count; break
    }
  }

  const productivityRatio = Math.min(1, productiveCount / Math.max(1, totalTagged))
  const entertainmentRatio = Math.min(1, unproductiveCount / Math.max(1, totalTagged))
  const contentRatio = Math.min(1, (techCount + eduCount + readingCount) / Math.max(1, totalTagged))
  const knowledgeDepth = Math.min(1, (techCount + eduCount) / Math.max(1, totalTagged) * 1.5)

  const tagCounts = Array.from(tagMap.values()).map(tv => tv.count)
  let shannonDiversity = 0
  for (const count of tagCounts) {
    const p = count / Math.max(1, totalTagged)
    if (p > 0) shannonDiversity -= p * Math.log(p)
  }
  const tagCount = tagMap.size
  const diversityIndex = tagCount > 1 ? Math.min(1, shannonDiversity / Math.log(tagCount)) : 0

  const uniqueTags = new Set(Array.from(tagMap.values()).map(tv => tv.tag))
  const explorationBreadth = Math.min(1, uniqueTags.size / 15)

  const sortedByCount = [...tagMap.values()].sort((a, b) => b.count - a.count)
  const topCount = sortedByCount.slice(0, 3).reduce((s, tv) => s + tv.count, 0)
  const focusIndex = totalTagged > 0 ? Math.min(1, topCount / totalTagged) : 0

  const sortedCounts2 = [...tagCounts].sort((a, b) => a - b)
  let giniNumerator = 0
  let giniDenominator = 0
  for (let i = 0; i < sortedCounts2.length; i++) {
    giniNumerator += (i + 1) * sortedCounts2[i]
    giniDenominator += sortedCounts2[i]
  }
  const n = sortedCounts2.length
  const gini = giniDenominator > 0 && n > 0
    ? (2 * giniNumerator) / (n * giniDenominator) - (n + 1) / n
    : 0
  const loyalty = Math.max(0, Math.min(1, gini))

  const domainMap = new Map<string, number>()
  for (const r of records) {
    domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1)
  }
  const domainCounts = Array.from(domainMap.values())
  const siteCount = domainMap.size

  let shannonDomain = 0
  for (const count of domainCounts) {
    const p = count / total
    if (p > 0) shannonDomain -= p * Math.log(p)
  }
  const curiosity = siteCount > 1 ? Math.min(1, shannonDomain / Math.log(siteCount)) : 0

  const weekAgo = Date.now() - 7 * 86400000
  const twoWeeksAgo = Date.now() - 14 * 86400000
  const recentTags = new Map<string, number>()
  const olderTags = new Map<string, number>()
  for (const r of records) {
    const results = autoTagDetailed(r.url, r.title || '')
    const target = r.lastVisitTime >= weekAgo ? recentTags : (r.lastVisitTime >= twoWeeksAgo ? olderTags : null)
    if (target) {
      for (const result of results) {
        target.set(result.tag, (target.get(result.tag) || 0) + 1)
      }
    }
  }
  let trendSimilarity = 0
  const allTrendTags = new Set([...recentTags.keys(), ...olderTags.keys()])
  if (allTrendTags.size > 0) {
    let dotProd = 0, normA2 = 0, normB2 = 0
    for (const tag of allTrendTags) {
      const va = (recentTags.get(tag) || 0) / Math.max(1, recentTags.size)
      const vb = (olderTags.get(tag) || 0) / Math.max(1, olderTags.size)
      dotProd += va * vb
      normA2 += va * va
      normB2 += vb * vb
    }
    trendSimilarity = normA2 > 0 && normB2 > 0 ? dotProd / (Math.sqrt(normA2) * Math.sqrt(normB2)) : 0
  }
  const stability = Math.min(1, trendSimilarity)

  const recentTagCount = recentTags.size
  const olderTagCount = olderTags.size
  const shiftFrequency = olderTagCount > 0 ? Math.min(1, Math.abs(recentTagCount - olderTagCount) / olderTagCount) : 0

  let nightCount = 0
  let morningCount = 0
  let workCount = 0
  const nightHours = new Set([22, 23, 0, 1, 2, 3, 4, 5])
  const morningHours = new Set([6, 7, 8, 9, 10, 11])
  const workHours = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17, 18])

  for (const c of stats.heatmap) {
    if (c.count > 0) {
      if (nightHours.has(c.hour)) nightCount += c.count
      if (morningHours.has(c.hour)) morningCount += c.count
      if (workHours.has(c.hour)) workCount += c.count
    }
  }

  const nightOwlIndex = Math.min(1, nightCount / total)
  const morningIndex = Math.min(1, morningCount / total)

  const heatSequence: number[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = stats.heatmap.find(c => c.day === day && c.hour === hour)
      heatSequence.push(cell?.count || 0)
    }
  }
  let rhythmicity = 0
  if (heatSequence.length > 0) {
    const mean = heatSequence.reduce((a, b) => a + b, 0) / heatSequence.length
    let totalPower = 0
    let maxFreqPower = 0
    for (let k = 1; k < heatSequence.length / 2; k++) {
      let realPart = 0
      let imagPart = 0
      for (let t = 0; t < heatSequence.length; t++) {
        const angle = (2 * Math.PI * k * t) / heatSequence.length
        realPart += (heatSequence[t] - mean) * Math.cos(angle)
        imagPart += (heatSequence[t] - mean) * Math.sin(angle)
      }
      const power = (realPart * realPart + imagPart * imagPart) / (heatSequence.length * heatSequence.length)
      totalPower += power
      if (power > maxFreqPower) maxFreqPower = power
    }
    rhythmicity = totalPower > 0 ? Math.min(1, maxFreqPower / totalPower * 2) : 0
  }

  const intensity = Math.min(1, stats.overview.dailyAvg / 100)

  const socialEngagement = Math.min(1, socialCount / Math.max(1, totalTagged))

  const sorted = [...records].sort((a, b) => a.lastVisitTime - b.lastVisitTime)
  const sessions: { domains: Set<string>; tags: Set<string> }[] = []
  if (sorted.length > 0) {
    let currentSession: { domains: Set<string>; tags: Set<string> } = { domains: new Set([sorted[0].domain]), tags: new Set() }
    const initTags = autoTagDetailed(sorted[0].url, sorted[0].title || '')
    for (const t of initTags) currentSession.tags.add(t.tag)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].lastVisitTime - sorted[i - 1].lastVisitTime > 30 * 60 * 1000) {
        sessions.push(currentSession)
        currentSession = { domains: new Set([sorted[i].domain]), tags: new Set() }
      } else {
        currentSession.domains.add(sorted[i].domain)
      }
      const sTags = autoTagDetailed(sorted[i].url, sorted[i].title || '')
      for (const t of sTags) currentSession.tags.add(t.tag)
    }
    sessions.push(currentSession)
  }

  const sessionBreadth = sessions.length > 0
    ? Math.min(1, sessions.reduce((s, sess) => s + sess.tags.size, 0) / sessions.length / 8)
    : 0

  const avgSessionDomains = sessions.length > 0
    ? sessions.reduce((s, sess) => s + sess.domains.size, 0) / sessions.length
    : 0
  const interactivity = Math.min(1, avgSessionDomains / 8)

  const sessionLengths = sessions.map(s => s.domains.size)
  const avgSessionLen = sessionLengths.length > 0
    ? sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length
    : 0
  const sessionVariance = sessionLengths.length > 1
    ? sessionLengths.reduce((s, l) => s + Math.pow(l - avgSessionLen, 2), 0) / (sessionLengths.length - 1)
    : 0
  const sessionConsistency = Math.min(1, 1 - Math.sqrt(sessionVariance) / Math.max(1, avgSessionLen))

  const entityVisitMap = new Map<string, number>()
  for (const r of records) {
    const entity = getEntityForDomain(r.domain)
    if (entity) {
      entityVisitMap.set(entity.id, (entityVisitMap.get(entity.id) || 0) + 1)
    }
  }
  const entityCount = entityVisitMap.size
  const totalEntities = getAllEntities().length
  const entityDiversity = totalEntities > 0 ? Math.min(1, entityCount / Math.min(totalEntities, 20)) : 0

  const entityCounts = Array.from(entityVisitMap.values())
  let entityGini = 0
  if (entityCounts.length > 1) {
    const sortedEntity = [...entityCounts].sort((a, b) => a - b)
    let eNum = 0, eDen = 0
    for (let i = 0; i < sortedEntity.length; i++) {
      eNum += (i + 1) * sortedEntity[i]
      eDen += sortedEntity[i]
    }
    const en = sortedEntity.length
    entityGini = eDen > 0 ? Math.max(0, Math.min(1, (2 * eNum) / (en * eDen) - (en + 1) / en)) : 0
  }
  const entityConcentration = entityGini

  return [
    { key: 'productivityRatio', label: '', value: productivityRatio, color: '#10b981' },
    { key: 'entertainmentRatio', label: '', value: entertainmentRatio, color: '#ef4444' },
    { key: 'contentRatio', label: '', value: contentRatio, color: '#3b82f6' },
    { key: 'knowledgeDepth', label: '', value: knowledgeDepth, color: '#6366f1' },
    { key: 'diversityIndex', label: '', value: diversityIndex, color: '#8b5cf6' },
    { key: 'explorationBreadth', label: '', value: explorationBreadth, color: '#06b6d4' },
    { key: 'focusIndex', label: '', value: focusIndex, color: '#ec4899' },
    { key: 'loyalty', label: '', value: loyalty, color: '#f97316' },

    { key: 'curiosity', label: '', value: curiosity, color: '#14b8a6' },
    { key: 'stability', label: '', value: stability, color: '#a78bfa' },
    { key: 'shiftFrequency', label: '', value: shiftFrequency, color: '#f59e0b' },
    { key: 'trendMomentum', label: '', value: 1 - stability, color: '#f43f5e' },

    { key: 'nightOwlIndex', label: '', value: nightOwlIndex, color: '#7c3aed' },
    { key: 'morningIndex', label: '', value: morningIndex, color: '#fbbf24' },
    { key: 'rhythmicity', label: '', value: rhythmicity, color: '#a78bfa' },
    { key: 'intensity', label: '', value: intensity, color: '#f59e0b' },
    { key: 'socialEngagement', label: '', value: socialEngagement, color: '#3b82f6' },
    { key: 'sessionBreadth', label: '', value: sessionBreadth, color: '#06b6d4' },
    { key: 'interactivity', label: '', value: interactivity, color: '#10b981' },
    { key: 'sessionConsistency', label: '', value: sessionConsistency, color: '#8b5cf6' },

    { key: 'entityDiversity', label: '', value: entityDiversity, color: '#0ea5e9' },
    { key: 'entityConcentration', label: '', value: entityConcentration, color: '#f97316' },
  ]
}

export const useFingerprintStore = defineStore('fingerprint', () => {
  const superDna = ref<SuperDNA | null>(null)
  const isCollecting = ref(false)
  const lastError = ref<string>('')

  const hardwareDimensions = computed(() => superDna.value?.hardware.dimensions || [])
  const behavioralDimensions = computed(() => superDna.value?.behavioral.dimensions || [])
  const archetype = computed(() => superDna.value?.fusion.archetype || '')
  const confidence = computed(() => superDna.value?.hardware.confidence || 0)
  const stability = computed(() => superDna.value?.fusion.stability || 0)
  const uniqueness = computed(() => superDna.value?.fusion.uniqueness || 0)
  const dnaId = computed(() => superDna.value?.id || '')

  const contentDimensions = computed(() =>
    behavioralDimensions.value.slice(0, 8)
  )
  const interestDimensions = computed(() =>
    behavioralDimensions.value.slice(8, 12)
  )
  const interactionDimensions = computed(() =>
    behavioralDimensions.value.slice(12, 20)
  )
  const entityDimensions = computed(() =>
    behavioralDimensions.value.slice(20, 22)
  )

  async function collectFingerprint(forceRefresh = false): Promise<void> {
    if (isCollecting.value) return
    isCollecting.value = true
    lastError.value = ''

    try {
      let results: FingerprintResult[] | null = null

      if (!forceRefresh) {
        results = await getCachedFingerprint()
      }

      if (!results) {
        results = await collectAllFingerprints()
        await setCachedFingerprint(results)
      }

      const behavioralDims = computeBehavioralDimensions()
      const cachedDna = superDna.value
      superDna.value = computeSuperDNA(results, behavioralDims, cachedDna)
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      isCollecting.value = false
    }
  }

  async function clearAllData(): Promise<void> {
    superDna.value = null
    await clearFingerprintCache()
  }

  return {
    superDna,
    isCollecting,
    lastError,
    hardwareDimensions,
    behavioralDimensions,
    contentDimensions,
    interestDimensions,
    interactionDimensions,
    archetype,
    confidence,
    stability,
    uniqueness,
    dnaId,
    collectFingerprint,
    clearAllData,
  }
})
