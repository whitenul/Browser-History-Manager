// @ts-nocheck
import * as acorn from 'acorn'
import type { Diagnostic } from '@codemirror/lint'

const GM_GLOBALS = new Set([
  'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues',
  'GM_log', 'GM_addStyle', 'GM_xmlhttpRequest', 'GM_notification',
  'GM_setClipboard', 'GM_getResourceText', 'GM_getResourceURL',
  'GM_openInTab', 'GM_registerMenuCommand', 'GM_unregisterMenuCommand',
  'GM_download', 'GM_addValueChangeListener', 'GM_removeValueChangeListener',
  'unsafeWindow', 'GM_info', 'GM_cookie', 'GM_storage',
  'GM_getTab', 'GM_saveTab', 'GM_getTabs', 'GM_webRequest',
  'window', 'document', 'console', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'fetch', 'Promise', 'XMLHttpRequest',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'localStorage', 'sessionStorage', 'navigator', 'location', 'history',
  'alert', 'confirm', 'prompt', 'atob', 'btoa', 'crypto',
  'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent',
  'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader',
  'Request', 'Response', 'Headers', 'AbortController',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect',
  'Symbol', 'BigInt', 'Array', 'Object', 'String', 'Number', 'Boolean',
  'RegExp', 'Date', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'JSON', 'Math', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
  'queueMicrotask', 'structuredClone', 'TextDecoder', 'TextEncoder',
  'performance', 'requestAnimationFrame', 'cancelAnimationFrame',
  'matchMedia', 'getComputedStyle', 'Worker', 'MessageChannel',
  'globalThis', 'self', 'top', 'parent', 'frames', 'opener',
  'Image', 'Audio', 'Option', 'Selection', 'Range',
  'CSS', 'DOMParser', 'XMLSerializer', 'XSLTProcessor',
  'IdleDeadline', 'AnimationEvent', 'ClipboardEvent', 'DragEvent',
  'FocusEvent', 'KeyboardEvent', 'MouseEvent', 'TouchEvent', 'WheelEvent',
  'PointerEvent', 'TransitionEvent', 'InputEvent', 'CompositionEvent',
  'StorageEvent', 'PopStateEvent', 'HashChangeEvent', 'PageTransitionEvent',
  'MessageEvent', 'DeviceOrientationEvent', 'DeviceMotionEvent',
  'DataTransfer', 'DataTransferItem', 'DataTransferItemList',
  'Geolocation', 'GeolocationPosition', 'GeolocationCoordinates',
  'MediaQueryList', 'MediaQueryListEvent',
  'NodeList', 'HTMLCollection', 'DOMTokenList',
  'DOMMatrix', 'DOMMatrixReadOnly', 'DOMPoint', 'DOMPointReadOnly',
  'DOMRect', 'DOMRectReadOnly',
  'CanvasRenderingContext2D', 'ImageData', 'Path2D', 'TextMetrics',
  'WebSocket', 'EventSource', 'RTCDataChannel', 'RTCPeerConnection',
  'BroadcastChannel', 'SharedWorker',
  'Cache', 'CacheStorage',
  'Notification', 'PermissionStatus',
  'Screen', 'ScreenOrientation',
  'VisualViewport', 'IntersectionObserverEntry',
  'ResizeObserverEntry', 'MutationRecord',
  'Performance', 'PerformanceEntry', 'PerformanceMark', 'PerformanceMeasure',
  'PerformanceObserver', 'PerformanceObserverEntryList',
  'Intl', 'WebAssembly',
  'Proxy', 'Reflect',
  'AggregateError', 'InternalError',
  'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Uint8ClampedArray',
  'BigInt64Array', 'BigUint64Array', 'ArrayBuffer', 'SharedArrayBuffer',
  'DataView', 'Atomics',
  'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt',
  'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
  'escape', 'unescape',
  'Generator', 'GeneratorFunction', 'AsyncGenerator', 'AsyncGeneratorFunction',
  'AsyncFunction', 'AsyncIterator', 'Iterator',
  'PromiseRejectionEvent',
  'exports', 'module', 'require', '__dirname', '__filename',
  'process', 'Buffer',
])

function stripMetadataBlock(code: string): string {
  const startMatch = code.match(/\/\/\s*==UserScript==/)
  if (!startMatch) return code
  const startIdx = startMatch.index!
  const endMatch = code.indexOf('// ==/UserScript==', startIdx)
  if (endMatch === -1) return code
  const endIdx = endMatch + '// ==/UserScript=='.length
  const headerLines = code.slice(0, endIdx).split('\n').length
  const placeholder = Array(headerLines - 1).fill('').join('\n')
  return placeholder + code.slice(endIdx)
}

function posToOffset(code: string, line: number, column: number): number {
  let offset = 0
  for (let i = 1; i < line; i++) {
    offset = code.indexOf('\n', offset) + 1
    if (offset === 0) return code.length
  }
  return offset + column
}

function checkSyntax(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  try {
    acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      onInsertedSemicolon(end, loc) {
        const from = end - 1
        diagnostics.push({
          from: Math.max(0, from),
          to: end,
          severity: 'warning',
          message: `Expected semicolon (auto-inserted at line ${loc.line})`,
        })
      },
    })
  } catch (e: any) {
    if (e.loc) {
      const from = posToOffset(code, e.loc.line, e.loc.column)
      diagnostics.push({
        from: Math.max(0, from),
        to: Math.min(from + 1, code.length),
        severity: 'error',
        message: e.message.replace(/\s*\(\d+:\d+\)$/, ''),
      })
    } else {
      diagnostics.push({
        from: 0, to: 1,
        severity: 'error',
        message: e.message,
      })
    }
  }
  return diagnostics
}

function checkUndefined(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    })

    const scopeStack = [new Set(GM_GLOBALS)]

    function visit(node: any) {
      if (!node || typeof node !== 'object') return

      if (node.type === 'Program' || node.type === 'BlockStatement') {
        const localScope = new Set(scopeStack[scopeStack.length - 1])
        if (node.body) {
          for (const stmt of node.body) {
            if (stmt.type === 'VariableDeclaration') {
              for (const decl of stmt.declarations) {
                if (decl.id && decl.id.name) localScope.add(decl.id.name)
              }
            }
            if (stmt.type === 'FunctionDeclaration' && stmt.id) {
              localScope.add(stmt.id.name)
            }
            if (stmt.type === 'ClassDeclaration' && stmt.id) {
              localScope.add(stmt.id.name)
            }
            if (stmt.type === 'ImportDeclaration') {
              for (const spec of stmt.specifiers) {
                if (spec.local && spec.local.name) localScope.add(spec.local.name)
              }
            }
          }
        }
        scopeStack.push(localScope)
        for (const child of Object.values(node)) {
          if (Array.isArray(child)) child.forEach(visit)
          else if (child && typeof child === 'object' && child.type) visit(child)
        }
        scopeStack.pop()
        return
      }

      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        const funcScope = new Set(scopeStack[scopeStack.length - 1])
        if (node.id && node.id.name) funcScope.add(node.id.name)
        if (node.params) {
          for (const param of node.params) {
            collectBindingNames(param, funcScope)
          }
        }
        scopeStack.push(funcScope)
        if (node.body) visit(node.body)
        scopeStack.pop()
        return
      }

      if (node.type === 'Identifier') {
        const currentScope = scopeStack[scopeStack.length - 1]
        if (!currentScope?.has(node.name)) {
          const isPropertyAccess = false
          diagnostics.push({
            from: node.start,
            to: node.end,
            severity: 'warning',
            message: `'${node.name}' is not defined (no-undef)`,
          })
        }
        return
      }

      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit)
        else if (child && typeof child === 'object' && child.type) visit(child)
      }
    }

    visit(ast)

    const seen = new Set<string>()
    return diagnostics.filter(d => {
      const key = `${d.from}:${d.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch {
    return []
  }
}

function collectBindingNames(pattern: any, scope: Set<string>) {
  if (!pattern) return
  if (pattern.type === 'Identifier') {
    scope.add(pattern.name)
  } else if (pattern.type === 'ObjectPattern') {
    for (const prop of pattern.properties) {
      if (prop.type === 'Property') collectBindingNames(prop.value, scope)
      else if (prop.type === 'RestElement') collectBindingNames(prop.argument, scope)
    }
  } else if (pattern.type === 'ArrayPattern') {
    for (const elem of pattern.elements) {
      if (elem) collectBindingNames(elem, scope)
    }
  } else if (pattern.type === 'RestElement') {
    collectBindingNames(pattern.argument, scope)
  } else if (pattern.type === 'AssignmentPattern') {
    collectBindingNames(pattern.left, scope)
  }
}

function checkMetadataBlock(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const headerStart = code.indexOf('// ==UserScript==')
  const headerEnd = code.indexOf('// ==/UserScript==')
  if (headerStart !== -1 && headerEnd === -1) {
    diagnostics.push({
      from: headerStart,
      to: headerStart + '// ==UserScript=='.length,
      severity: 'warning',
      message: '缺少 // ==/UserScript== 结束标记',
    })
  }

  const grantNoneMatch = code.match(/@grant\s+none/)
  const usesGmApi = /\bGM_(getValue|setValue|deleteValue|listValues|log|addStyle|xmlhttpRequest|notification|setClipboard|getResourceText|getResourceURL|openInTab|registerMenuCommand|unregisterMenuCommand)\b/.test(code)
  if (grantNoneMatch && usesGmApi) {
    const grantIdx = code.indexOf('@grant none')
    diagnostics.push({
      from: grantIdx,
      to: grantIdx + '@grant none'.length,
      severity: 'warning',
      message: '使用了 GM_* API 但 @grant 声明为 none，API 可能不可用',
    })
  }
  return diagnostics
}

export function createESLintDiagnostics(code: string): Diagnostic[] {
  const strippedCode = stripMetadataBlock(code)
  const diagnostics: Diagnostic[] = []

  diagnostics.push(...checkSyntax(strippedCode))

  if (diagnostics.filter(d => d.severity === 'error').length === 0) {
    diagnostics.push(...checkUndefined(strippedCode))
  }

  diagnostics.push(...checkMetadataBlock(code))

  return diagnostics
}
