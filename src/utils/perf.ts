export interface PerfMetric {
  name: string
  duration: number
  timestamp: number
  metadata?: Record<string, number | string>
}

export interface PerfReport {
  timestamp: number
  metrics: PerfMetric[]
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
  summary: {
    totalDuration: number
    avgDuration: number
    maxDuration: number
    minDuration: number
    count: number
  }
}

const metrics: PerfMetric[] = []
const MAX_METRICS = 500

export function perfMark(name: string, metadata?: Record<string, number | string>): number {
  const mark = performance.mark(`${name}-start`, metadata ? { detail: metadata } : undefined)
  return mark.startTime
}

export function perfMeasure(name: string, startMark: number, metadata?: Record<string, number | string>): PerfMetric {
  const duration = performance.now() - startMark
  const metric: PerfMetric = {
    name,
    duration,
    timestamp: Date.now(),
    metadata,
  }
  if (metrics.length >= MAX_METRICS) metrics.shift()
  metrics.push(metric)
  return metric
}
