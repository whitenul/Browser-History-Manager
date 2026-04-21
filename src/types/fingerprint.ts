export interface FingerprintResult {
  key: string
  value: number
  hash: string
  weight: number
  raw: unknown
  confidence: number
  duration: number
}

export type FingerprintCollector = () => Promise<FingerprintResult>

export interface BehavioralDimension {
  key: string
  label: string
  value: number
  color: string
}

export interface SuperDNA {
  id: string
  hardware: {
    dimensions: FingerprintResult[]
    hash: string
    confidence: number
  }
  behavioral: {
    dimensions: BehavioralDimension[]
    hash: string
  }
  fusion: {
    archetype: string
    stability: number
    uniqueness: number
  }
  timestamp: number
  version: string
}

export interface MatchResult {
  match: 'same' | 'changed' | 'different'
  similarity: number
  changedDimensions: string[]
}

export interface SessionDetail {
  startTime: number
  endTime: number
  domains: string[]
  visitCount: number
}

export interface Archetype {
  id: string
  labelKey: string
  descKey: string
  center: Record<string, number>
}
