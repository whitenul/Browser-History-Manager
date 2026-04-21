import { murmurHash3, murmurHash3Bytes } from '@/utils/murmurHash3'
import type { FingerprintResult, FingerprintCollector } from '@/types/fingerprint'

const CACHE_KEY = 'super_dna_fingerprint_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000

function emptyResult(key: string, weight: number): FingerprintResult {
  return { key, value: 0, hash: '', weight, raw: null, confidence: 0, duration: 0 }
}

function collectCanvas(): { value: number; hash: string; raw: string } {
  const canvas = document.createElement('canvas')
  canvas.width = 280
  canvas.height = 60
  const ctx = canvas.getContext('2d')
  if (!ctx) return { value: 0, hash: '', raw: '' }

  ctx.textBaseline = 'top'
  ctx.font = '14px Arial'
  ctx.fillStyle = '#f60'
  ctx.fillRect(125, 1, 62, 20)
  ctx.fillStyle = '#069'
  ctx.fillText('AaBbCcDdEeFfGg\u4f60\u597d\u4e16\u754c', 2, 15)
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
  ctx.fillText('AaBbCcDdEeFfGg\u4f60\u597d\u4e16\u754c', 4, 17)

  const grad = ctx.createLinearGradient(0, 0, 280, 0)
  grad.addColorStop(0, 'red')
  grad.addColorStop(1, 'blue')
  ctx.fillStyle = grad
  ctx.fillRect(0, 30, 280, 30)

  ctx.beginPath()
  ctx.arc(50, 50, 25, 0, Math.PI * 2)
  ctx.fill()

  const imageData = ctx.getImageData(0, 0, 280, 60)
  const regionHashes = computeRegionHashes(imageData, 4)
  const fullHash = murmurHash3(canvas.toDataURL())
  const value = estimateEntropyValue(regionHashes)

  return { value, hash: fullHash, raw: JSON.stringify({ fullHash, regionHashes }) }
}

function computeRegionHashes(imageData: ImageData, regions: number): string[] {
  const { data, width, height } = imageData
  const regionHeight = Math.floor(height / regions)
  const hashes: string[] = []
  for (let r = 0; r < regions; r++) {
    const start = r * regionHeight * width * 4
    const end = Math.min((r + 1) * regionHeight * width * 4, data.length)
    const regionData = new Uint8Array(data.buffer, start, end - start)
    hashes.push(murmurHash3Bytes(regionData))
  }
  return hashes
}

function estimateEntropyValue(regionHashes: string[]): number {
  const uniqueRegions = new Set(regionHashes).size
  return Math.min(1, uniqueRegions / regionHashes.length)
}

function collectWebGL(): { value: number; hash: string; raw: Record<string, unknown> } {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
  if (!gl) return { value: 0, hash: '', raw: {} }

  const glCtx = gl as WebGLRenderingContext
  const info: Record<string, unknown> = {
    vendor: glCtx.getParameter(glCtx.VENDOR),
    renderer: glCtx.getParameter(glCtx.RENDERER),
    version: glCtx.getParameter(glCtx.VERSION),
    shadingVersion: glCtx.getParameter(glCtx.SHADING_LANGUAGE_VERSION),
    extensions: glCtx.getSupportedExtensions(),
    maxTextureSize: glCtx.getParameter(glCtx.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: glCtx.getParameter(glCtx.MAX_RENDERBUFFER_SIZE),
    maxViewportDims: glCtx.getParameter(glCtx.MAX_VIEWPORT_DIMS),
    maxCubeMapTextureSize: glCtx.getParameter(glCtx.MAX_CUBE_MAP_TEXTURE_SIZE),
    maxTextureImageUnits: glCtx.getParameter(glCtx.MAX_TEXTURE_IMAGE_UNITS),
    maxVertexTextureImageUnits: glCtx.getParameter(glCtx.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    maxCombinedTextureImageUnits: glCtx.getParameter(glCtx.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
    maxVertexAttribs: glCtx.getParameter(glCtx.MAX_VERTEX_ATTRIBS),
    maxVaryingVectors: glCtx.getParameter(glCtx.MAX_VARYING_VECTORS),
    maxFragmentUniformVectors: glCtx.getParameter(glCtx.MAX_FRAGMENT_UNIFORM_VECTORS),
  }

  const sceneHash = renderWebGLScene(glCtx)
  const hash = murmurHash3(JSON.stringify(info) + sceneHash)
  const value = estimateWebGLEntropy(info)

  return { value, hash, raw: info }
}

function renderWebGLScene(gl: WebGLRenderingContext): string {
  try {
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.width = 64
    canvas.height = 64

    const vertSrc = 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'
    const fragSrc = 'precision mediump float;void main(){gl_FragColor=vec4(1,0,0.5,1);}'

    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vertSrc)
    gl.compileShader(vs)

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, fragSrc)
    gl.compileShader(fs)

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    const pixels = new Uint8Array(64 * 64 * 4)
    gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return murmurHash3Bytes(pixels)
  } catch {
    return ''
  }
}

function estimateWebGLEntropy(info: Record<string, unknown>): number {
  let score = 0
  const extensions = (info.extensions as string[]) || []
  score += Math.min(0.3, extensions.length / 50)
  if (info.renderer && (info.renderer as string).length > 5) score += 0.3
  if (info.vendor && (info.vendor as string).length > 3) score += 0.2
  if (info.maxTextureSize && (info.maxTextureSize as number) > 0) score += 0.2
  return Math.min(1, score)
}

async function collectAudio(): Promise<FingerprintResult> {
  const start = performance.now()
  const key = 'audio'
  const weight = 0.14

  try {
    const AudioCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
    if (!AudioCtx) return { ...emptyResult(key, weight), duration: performance.now() - start }

    const context = new AudioCtx(1, 44100, 44100)
    const oscillator = context.createOscillator()
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(10000, context.currentTime)

    const compressor = context.createDynamicsCompressor()
    compressor.threshold.setValueAtTime(-50, context.currentTime)
    compressor.knee.setValueAtTime(40, context.currentTime)
    compressor.ratio.setValueAtTime(12, context.currentTime)
    compressor.attack.setValueAtTime(0, context.currentTime)
    compressor.release.setValueAtTime(0.25, context.currentTime)

    oscillator.connect(compressor)
    compressor.connect(context.destination)
    oscillator.start(0)

    const buffer = await Promise.race([
      context.startRendering(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AudioContext timeout')), 80)
      ),
    ])

    const data = (buffer as AudioBuffer).getChannelData(0)
    const samples: number[] = []
    for (let i = 4500; i < 5000; i++) samples.push(data[i])
    const hash = murmurHash3(samples.join(','))

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length
    const value = Math.min(1, Math.sqrt(variance) * 100)

    return { key, value, hash, weight, raw: samples.slice(0, 10), confidence: 1, duration: performance.now() - start }
  } catch {
    return { ...emptyResult(key, weight), duration: performance.now() - start }
  }
}

const TEST_FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Impact', 'Lucida Console', 'Palatino Linotype', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Wingdings',
  'Calibri', 'Cambria', 'Consolas', 'Segoe UI',
  'Helvetica', 'Monaco', 'Menlo',
  'PingFang SC', 'Microsoft YaHei', 'SimHei', 'SimSun',
  'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
  'Ubuntu', 'DejaVu Sans', 'Roboto',
]

function collectFonts(): { value: number; hash: string; raw: string[] } {
  const baseFonts = ['monospace', 'sans-serif', 'serif']
  const testString = 'mmmmmmmmmmlli'
  const testSize = '72px'
  const body = document.body

  const span = document.createElement('span')
  span.style.position = 'absolute'
  span.style.left = '-9999px'
  span.style.fontSize = testSize
  span.style.lineHeight = 'normal'
  span.textContent = testString
  body.appendChild(span)

  const baseWidths: Record<string, number> = {}
  for (const base of baseFonts) {
    span.style.fontFamily = base
    baseWidths[base] = span.offsetWidth
  }

  const detected: string[] = []
  for (const font of TEST_FONTS) {
    let found = false
    for (const base of baseFonts) {
      span.style.fontFamily = `'${font}', ${base}`
      if (span.offsetWidth !== baseWidths[base]) {
        found = true
        break
      }
    }
    if (found) detected.push(font)
  }

  body.removeChild(span)
  const hash = murmurHash3(detected.join(','))
  return { value: Math.min(1, detected.length / 20), hash, raw: detected }
}

function collectDisplay(): { value: number; hash: string; raw: Record<string, unknown> } {
  const raw = {
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    orientation: screen.orientation?.type,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
  }
  const hash = murmurHash3(JSON.stringify(raw))
  const value = estimateDisplayEntropy(raw)
  return { value, hash, raw }
}

function estimateDisplayEntropy(raw: Record<string, unknown>): number {
  let score = 0
  const commonResolutions = [[1920, 1080], [1366, 768], [2560, 1440], [3840, 2160], [1536, 864]]
  const isCommon = commonResolutions.some(
    ([w, h]) => raw.screenWidth === w && raw.screenHeight === h
  )
  score += isCommon ? 0.2 : 0.6
  if ((raw.pixelRatio as number) !== 1) score += 0.2
  if (raw.colorDepth !== 24) score += 0.2
  return Math.min(1, score)
}

function collectSystem(): { value: number; hash: string; raw: Record<string, unknown> } {
  const nav = navigator as any
  const raw = {
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: nav.deviceMemory || 0,
    platform: nav.userAgentData?.platform || parsePlatformFromUA(navigator.userAgent),
    maxTouchPoints: navigator.maxTouchPoints || 0,
    cookieEnabled: navigator.cookieEnabled,
  }
  const hash = murmurHash3(JSON.stringify(raw))
  const value = estimateSystemEntropy(raw)
  return { value, hash, raw }
}

function parsePlatformFromUA(ua: string): string {
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  return 'Unknown'
}

function estimateSystemEntropy(raw: Record<string, unknown>): number {
  let score = 0
  const cores = raw.hardwareConcurrency as number
  if (cores > 0) score += Math.min(0.3, cores / 32)
  const mem = raw.deviceMemory as number
  if (mem > 0) score += Math.min(0.3, mem / 16)
  if (raw.platform !== 'Unknown') score += 0.2
  if ((raw.maxTouchPoints as number) > 0) score += 0.2
  return Math.min(1, score)
}

function collectLocale(): { value: number; hash: string; raw: Record<string, unknown> } {
  const raw = {
    language: navigator.language,
    languages: [...(navigator.languages || [])],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    numberFormat: new Intl.NumberFormat().resolvedOptions(),
    dateFormat: new Intl.DateTimeFormat().resolvedOptions(),
  }
  const hash = murmurHash3(JSON.stringify(raw))
  const value = estimateLocaleEntropy(raw)
  return { value, hash, raw }
}

function estimateLocaleEntropy(raw: Record<string, unknown>): number {
  let score = 0
  const langs = raw.languages as string[]
  if (langs && langs.length > 1) score += 0.3
  else score += 0.1
  const commonTimezones = ['Asia/Shanghai', 'America/New_York', 'America/Los_Angeles', 'Europe/London']
  if (!commonTimezones.includes(raw.timezone as string)) score += 0.4
  else score += 0.1
  if ((raw.timezoneOffset as number) % 30 !== 0) score += 0.3
  return Math.min(1, score)
}

function collectWasm(): { value: number; hash: string; raw: Record<string, unknown> | null } {
  if (typeof WebAssembly === 'undefined') return { value: 0, hash: '', raw: null }

  const features: Record<string, unknown> = {}

  try {
    features.validate = WebAssembly.validate(
      new Uint8Array([0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
    )
  } catch (e: any) {
    features.validate = false
    features.validateError = e instanceof Error ? e.message : 'CSP_BLOCKED'
  }

  try {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 256 })
    features.memoryGrow = memory.grow(1) === 1
    features.memoryPageSize = memory.buffer.byteLength
  } catch (e: any) {
    features.memoryError = e instanceof Error ? e.message : 'CSP_BLOCKED'
  }

  try {
    const table = new WebAssembly.Table({ initial: 1, element: 'anyfunc' })
    features.tableLength = table.length
  } catch (e: any) {
    features.tableError = e instanceof Error ? e.message : 'CSP_BLOCKED'
  }

  try {
    const global = new WebAssembly.Global({ value: 'i32', mutable: true }, 42)
    features.globalValue = global.value
    global.value = 0
    features.globalMutable = true
  } catch (e: any) {
    features.globalError = e instanceof Error ? e.message : 'CSP_BLOCKED'
  }

  const hash = murmurHash3(JSON.stringify(features))
  const value = estimateWasmEntropy(features)
  return { value, hash, raw: features }
}

function estimateWasmEntropy(features: Record<string, unknown>): number {
  let score = 0
  if (features.validate === true) score += 0.25
  if (features.memoryGrow === true) score += 0.25
  if (features.tableLength === 1) score += 0.25
  if (features.globalValue === 42) score += 0.25
  return Math.min(1, score)
}

function wrapSync(
  key: string,
  weight: number,
  fn: () => { value: number; hash: string; raw: unknown }
): FingerprintCollector {
  return async () => {
    const start = performance.now()
    try {
      const result = fn()
      return {
        key,
        value: result.value,
        hash: result.hash,
        weight,
        raw: result.raw,
        confidence: result.hash ? 1 : 0,
        duration: performance.now() - start,
      }
    } catch {
      return { ...emptyResult(key, weight), duration: performance.now() - start }
    }
  }
}

export async function collectAllFingerprints(): Promise<FingerprintResult[]> {
  const collectors: FingerprintCollector[] = [
    wrapSync('canvas', 0.18, collectCanvas),
    wrapSync('webgl', 0.16, collectWebGL),
    collectAudio,
    wrapSync('fonts', 0.12, collectFonts),
    wrapSync('display', 0.10, collectDisplay),
    wrapSync('system', 0.10, collectSystem),
    wrapSync('locale', 0.08, collectLocale),
    wrapSync('wasm', 0.12, collectWasm),
  ]

  const results = await Promise.all(
    collectors.map(collector =>
      collector().catch(() => ({
        key: 'unknown',
        value: 0,
        hash: '',
        weight: 0,
        raw: null,
        confidence: 0,
        duration: 0,
      }))
    )
  )

  return results
}

export async function getCachedFingerprint(): Promise<FingerprintResult[] | null> {
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY)
    const cached = stored[CACHE_KEY]
    if (!cached) return null
    const parsed = JSON.parse(cached as string)
    if (Date.now() - parsed.timestamp > CACHE_TTL) return null
    return parsed.results as FingerprintResult[]
  } catch {
    return null
  }
}

export async function setCachedFingerprint(results: FingerprintResult[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [CACHE_KEY]: JSON.stringify({ results, timestamp: Date.now() }),
    })
  } catch { }
}

export async function clearFingerprintCache(): Promise<void> {
  try {
    await chrome.storage.local.remove(CACHE_KEY)
  } catch { }
}
