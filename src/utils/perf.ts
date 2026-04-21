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
  const start = performance.now()
  return start
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

export function perfWrap<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  metadata?: Record<string, number | string>
): T {
  return ((...args: Parameters<T>) => {
    const start = perfMark(name)
    try {
      const result = fn(...args)
      perfMeasure(name, start, metadata)
      return result
    } catch (e) {
      perfMeasure(`${name}:error`, start, metadata)
      throw e
    }
  }) as any as T
}

export function perfAsyncWrap<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  metadata?: Record<string, number | string>
): T {
  return (async (...args: Parameters<T>) => {
    const start = perfMark(name)
    try {
      const result = await fn(...args)
      perfMeasure(name, start, metadata)
      return result
    } catch (e) {
      perfMeasure(`${name}:error`, start, metadata)
      throw e
    }
  }) as any as T
}

export function getPerfMetrics(name?: string): PerfMetric[] {
  if (name) return metrics.filter(m => m.name === name)
  return [...metrics]
}

export function getPerfSummary(name: string): PerfReport['summary'] | null {
  const filtered = metrics.filter(m => m.name === name)
  if (!filtered.length) return null
  const durations = filtered.map(m => m.duration)
  return {
    totalDuration: durations.reduce((a, b) => a + b, 0),
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
    count: durations.length,
  }
}

export function generatePerfReport(): PerfReport {
  const mem = (performance as any).memory
  return {
    timestamp: Date.now(),
    metrics: [...metrics],
    memory: mem ? {
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit,
    } : undefined,
    summary: {
      totalDuration: metrics.reduce((a, m) => a + m.duration, 0),
      avgDuration: metrics.length ? metrics.reduce((a, m) => a + m.duration, 0) / metrics.length : 0,
      maxDuration: metrics.length ? Math.max(...metrics.map(m => m.duration)) : 0,
      minDuration: metrics.length ? Math.min(...metrics.map(m => m.duration)) : 0,
      count: metrics.length,
    },
  }
}

export function clearPerfMetrics(): void {
  metrics.length = 0
}

export function logPerfReport(): void {
  const report = generatePerfReport()
  const grouped = new Map<string, PerfMetric[]>()
  for (const m of report.metrics) {
    if (!grouped.has(m.name)) grouped.set(m.name, [])
    grouped.get(m.name)!.push(m)
  }

  const lines: string[] = ['=== Performance Report ===']
  if (report.memory) {
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1)
    lines.push(`Memory: ${mb(report.memory.usedJSHeapSize)}MB / ${mb(report.memory.totalJSHeapSize)}MB (limit: ${mb(report.memory.jsHeapSizeLimit)}MB)`)
  }

  for (const [name, items] of grouped) {
    const durations = items.map(m => m.duration)
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length
    const max = Math.max(...durations)
    const min = Math.min(...durations)
    lines.push(`  ${name}: avg=${avg.toFixed(1)}ms min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms (${durations.length} calls)`)
  }

  lines.push(`Total: ${report.summary.totalDuration.toFixed(1)}ms across ${report.summary.count} measurements`)
}
