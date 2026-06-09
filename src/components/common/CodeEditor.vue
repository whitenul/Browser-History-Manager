<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine, rectangularSelection, crosshairCursor, hoverTooltip } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, foldKeymap, indentUnit, HighlightStyle } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, type CompletionContext, type CompletionResult, snippet, completeFromList } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { linter, type Diagnostic } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import { EDITOR_THEMES, type EditorTheme } from './editorThemes'
import { indentGuides } from './indentGuides'
import { createESLintDiagnostics } from './eslintLinter'

const monokaiTheme = EditorView.theme({
  '&': { backgroundColor: '#272822', color: '#f8f8f2' },
  '.cm-content': { caretColor: '#f8f8f0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#f8f8f0' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#49483e' },
  '.cm-panels': { backgroundColor: '#272822', color: '#f8f8f2' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid #49483e' },
  '.cm-searchMatch': { backgroundColor: '#49483e66' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#88880033' },
  '.cm-activeLine': { backgroundColor: '#3e3d3266' },
  '.cm-selectionMatch': { backgroundColor: '#49483e66' },
  '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': { backgroundColor: '#49483e99', outline: '1px solid #88880055' },
  '.cm-gutters': { backgroundColor: '#272822', color: '#75715e', borderRight: '1px solid #49483e' },
  '.cm-activeLineGutter': { backgroundColor: '#3e3d3266' },
  '.cm-foldPlaceholder': { backgroundColor: '#272822', border: '1px solid #49483e', color: '#f8f8f2' },
  '.cm-tooltip': { border: '1px solid #49483e', backgroundColor: '#272822' },
  '.cm-tooltip .cm-tooltip-arrow:before': { borderTopColor: '#49483e', borderBottomColor: '#49483e' },
  '.cm-tooltip .cm-tooltip-arrow:after': { borderTopColor: '#272822', borderBottomColor: '#272822' },
  '.cm-tooltip-autocomplete': { '& > ul > li': { padding: '2px 8px' } },
}, { dark: true })

const monokaiHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#f92672' },
  { tag: [tags.name, tags.deleted, tags.character], color: '#f8f8f2' },
  { tag: [tags.propertyName, tags.typeName], color: '#a6e22e' },
  { tag: tags.string, color: '#e6db74' },
  { tag: [tags.number, tags.bool, tags.null], color: '#ae81ff' },
  { tag: tags.comment, color: '#75715e', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#f8f8f2' },
  { tag: tags.definition(tags.variableName), color: '#fd971f' },
  { tag: tags.function(tags.variableName), color: '#a6e22e' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: '#f8f8f2' },
  { tag: tags.className, color: '#a6e22e' },
  { tag: tags.meta, color: '#f92672' },
  { tag: tags.labelName, color: '#e6db74' },
]))

const solarizedTheme = EditorView.theme({
  '&': { backgroundColor: '#fdf6e3', color: '#657b83' },
  '.cm-content': { caretColor: '#586e75' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#586e75' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#eee8d5' },
  '.cm-panels': { backgroundColor: '#eee8d5', color: '#657b83' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid #d3cbb7' },
  '.cm-activeLine': { backgroundColor: '#eee8d566' },
  '.cm-selectionMatch': { backgroundColor: '#eee8d566' },
  '.cm-gutters': { backgroundColor: '#eee8d5', color: '#93a1a1', borderRight: '1px solid #d3cbb7' },
  '.cm-activeLineGutter': { backgroundColor: '#eee8d566' },
  '.cm-tooltip': { border: '1px solid #d3cbb7', backgroundColor: '#fdf6e3' },
}, { dark: false })

const solarizedHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#859900' },
  { tag: tags.string, color: '#2aa198' },
  { tag: tags.number, color: '#d33682' },
  { tag: tags.comment, color: '#93a1a1', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#268bd2' },
  { tag: tags.variableName, color: '#268bd2' },
  { tag: tags.typeName, color: '#b58900' },
  { tag: tags.className, color: '#b58900' },
  { tag: tags.bool, color: '#d33682' },
  { tag: tags.null, color: '#d33682' },
  { tag: tags.operator, color: '#859900' },
  { tag: tags.bracket, color: '#657b83' },
  { tag: tags.meta, color: '#859900' },
]))

const draculaTheme = EditorView.theme({
  '&': { backgroundColor: '#282a36', color: '#f8f8f2' },
  '.cm-content': { caretColor: '#f8f8f2' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#f8f8f2' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#44475a' },
  '.cm-panels': { backgroundColor: '#282a36', color: '#f8f8f2' },
  '.cm-activeLine': { backgroundColor: '#44475a66' },
  '.cm-selectionMatch': { backgroundColor: '#44475a66' },
  '.cm-gutters': { backgroundColor: '#282a36', color: '#6272a4', borderRight: '1px solid #44475a' },
  '.cm-activeLineGutter': { backgroundColor: '#44475a66' },
  '.cm-tooltip': { border: '1px solid #44475a', backgroundColor: '#282a36' },
}, { dark: true })

const draculaHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#ff79c6' },
  { tag: tags.string, color: '#f1fa8c' },
  { tag: tags.number, color: '#bd93f9' },
  { tag: tags.comment, color: '#6272a4', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#50fa7b' },
  { tag: tags.variableName, color: '#f8f8f2' },
  { tag: tags.typeName, color: '#8be9fd' },
  { tag: tags.className, color: '#8be9fd' },
  { tag: tags.bool, color: '#bd93f9' },
  { tag: tags.null, color: '#bd93f9' },
  { tag: tags.operator, color: '#ff79c6' },
  { tag: tags.bracket, color: '#f8f8f2' },
]))

const nordTheme = EditorView.theme({
  '&': { backgroundColor: '#2e3440', color: '#d8dee9' },
  '.cm-content': { caretColor: '#d8dee9' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#d8dee9' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#434c5e' },
  '.cm-panels': { backgroundColor: '#2e3440', color: '#d8dee9' },
  '.cm-activeLine': { backgroundColor: '#3b4252' },
  '.cm-selectionMatch': { backgroundColor: '#434c5e66' },
  '.cm-gutters': { backgroundColor: '#2e3440', color: '#4c566a', borderRight: '1px solid #3b4252' },
  '.cm-activeLineGutter': { backgroundColor: '#3b4252' },
  '.cm-tooltip': { border: '1px solid #3b4252', backgroundColor: '#2e3440' },
}, { dark: true })

const nordHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#81a1c1' },
  { tag: tags.string, color: '#a3be8c' },
  { tag: tags.number, color: '#b48ead' },
  { tag: tags.comment, color: '#616e88', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#88c0d0' },
  { tag: tags.variableName, color: '#d8dee9' },
  { tag: tags.typeName, color: '#8fbcbb' },
  { tag: tags.className, color: '#8fbcbb' },
  { tag: tags.bool, color: '#b48ead' },
  { tag: tags.null, color: '#b48ead' },
  { tag: tags.operator, color: '#81a1c1' },
  { tag: tags.bracket, color: '#81a1c1' },
]))

const githubTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#24292e' },
  '.cm-content': { caretColor: '#24292e' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#24292e' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#0366d633' },
  '.cm-panels': { backgroundColor: '#f6f8fa', color: '#24292e' },
  '.cm-activeLine': { backgroundColor: '#f6f8fa' },
  '.cm-selectionMatch': { backgroundColor: '#0366d622' },
  '.cm-gutters': { backgroundColor: '#f6f8fa', color: '#959da5', borderRight: '1px solid #e1e4e8' },
  '.cm-activeLineGutter': { backgroundColor: '#e1e4e822' },
  '.cm-tooltip': { border: '1px solid #e1e4e8', backgroundColor: '#ffffff' },
}, { dark: false })

const githubHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#d73a49' },
  { tag: tags.string, color: '#032f62' },
  { tag: tags.number, color: '#005cc5' },
  { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#6f42c1' },
  { tag: tags.variableName, color: '#24292e' },
  { tag: tags.typeName, color: '#6f42c1' },
  { tag: tags.className, color: '#6f42c1' },
  { tag: tags.bool, color: '#005cc5' },
  { tag: tags.null, color: '#005cc5' },
  { tag: tags.operator, color: '#d73a49' },
  { tag: tags.bracket, color: '#24292e' },
]))

function getThemeExtensions(themeId: EditorTheme) {
  switch (themeId) {
    case 'oneDark': return [oneDark]
    case 'monokai': return [monokaiTheme, monokaiHighlight]
    case 'solarized': return [solarizedTheme, solarizedHighlight]
    case 'dracula': return [draculaTheme, draculaHighlight]
    case 'nord': return [nordTheme, nordHighlight]
    case 'github': return [githubTheme, githubHighlight]
    default: return []
  }
}

function isThemeDark(themeId: EditorTheme): boolean {
  return EDITOR_THEMES.find(t => t.id === themeId)?.isDark ?? false
}

const props = withDefaults(defineProps<{
  modelValue: string
  dark?: boolean
  tabSize?: number
  wordWrap?: boolean
  editorTheme?: EditorTheme
}>(), {
  tabSize: 2,
  wordWrap: false,
  editorTheme: 'oneDark',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'cursorChange': [info: { line: number; col: number; selected: number }]
  'fontSizeChange': [size: number]
}>()

const editorRef = ref<HTMLDivElement>()
let view: EditorView | null = null
let resizeObserver: ResizeObserver | null = null

const tabSizeCompartment = new Compartment()
const wordWrapCompartment = new Compartment()
const themeCompartment = new Compartment()
const baseThemeCompartment = new Compartment()
const fontSizeCompartment = new Compartment()

const GM_API_COMPLETIONS = [
  { label: 'GM_getValue', type: 'function', detail: '(key: string, defaultValue?: any) => any', info: '从存储中获取值' },
  { label: 'GM_setValue', type: 'function', detail: '(key: string, value: any) => void', info: '设置存储中的值' },
  { label: 'GM_deleteValue', type: 'function', detail: '(key: string) => void', info: '删除存储中的值' },
  { label: 'GM_listValues', type: 'function', detail: '() => string[]', info: '列出所有存储的键' },
  { label: 'GM_log', type: 'function', detail: '(...args: any[]) => void', info: '输出日志到控制台' },
  { label: 'GM_addStyle', type: 'function', detail: '(css: string) => HTMLStyleElement', info: '添加CSS样式到页面' },
  { label: 'GM_xmlhttpRequest', type: 'function', detail: '(details: object) => object', info: '发起跨域HTTP请求' },
  { label: 'GM_notification', type: 'function', detail: '(details: object) => void', info: '显示桌面通知' },
  { label: 'GM_setClipboard', type: 'function', detail: '(text: string) => void', info: '设置剪贴板内容' },
  { label: 'GM_getResourceText', type: 'function', detail: '(name: string) => string', info: '获取@resource定义的文本资源' },
  { label: 'GM_getResourceURL', type: 'function', detail: '(name: string) => string', info: '获取@resource定义的资源URL' },
  { label: 'GM_openInTab', type: 'function', detail: '(url: string) => void', info: '在新标签页打开URL' },
  { label: 'GM_registerMenuCommand', type: 'function', detail: '(name: string, callback: Function) => number', info: '注册脚本菜单命令' },
  { label: 'GM_unregisterMenuCommand', type: 'function', detail: '(id: number) => void', info: '注销脚本菜单命令' },
  { label: 'unsafeWindow', type: 'variable', detail: 'Window', info: '页面原始window对象引用' },
  { label: 'GM_info', type: 'variable', detail: '{ script, scriptHandler, version }', info: '脚本元信息对象' },
]

const METADATA_COMPLETIONS = [
  { label: '@name', type: 'keyword', detail: '脚本名称', info: '设置脚本的显示名称' },
  { label: '@namespace', type: 'keyword', detail: '命名空间', info: '脚本的命名空间，用于区分同名的脚本' },
  { label: '@version', type: 'keyword', detail: '版本号', info: '脚本版本号，如 1.0.0' },
  { label: '@description', type: 'keyword', detail: '描述', info: '脚本功能描述' },
  { label: '@match', type: 'keyword', detail: 'URL匹配模式', info: '指定脚本运行的URL模式，如 *://*.example.com/*' },
  { label: '@include', type: 'keyword', detail: 'URL包含规则', info: '指定脚本运行的URL（正则表达式）' },
  { label: '@exclude', type: 'keyword', detail: 'URL排除规则', info: '排除不运行脚本的URL' },
  { label: '@run-at', type: 'keyword', detail: '运行时机', info: 'document-start | document-body | document-end | document-idle' },
  { label: '@grant', type: 'keyword', detail: '权限声明', info: '声明需要的GM_* API权限，如 GM_getValue' },
  { label: '@require', type: 'keyword', detail: '依赖库', info: '指定脚本依赖的外部JS库URL' },
  { label: '@resource', type: 'keyword', detail: '资源文件', info: '声明外部资源，如CSS、图片等' },
  { label: '@icon', type: 'keyword', detail: '图标URL', info: '脚本图标URL' },
  { label: '@author', type: 'keyword', detail: '作者', info: '脚本作者' },
  { label: '@license', type: 'keyword', detail: '许可证', info: '脚本许可证，如 MIT' },
  { label: '@updateURL', type: 'keyword', detail: '更新地址', info: '脚本更新检查URL' },
  { label: '@downloadURL', type: 'keyword', detail: '下载地址', info: '脚本下载URL' },
  { label: '@supportURL', type: 'keyword', detail: '支持地址', info: '问题反馈URL' },
  { label: '@homepageURL', type: 'keyword', detail: '主页地址', info: '脚本主页URL' },
  { label: '@noframes', type: 'keyword', detail: '禁止iframe', info: '脚本不在iframe中运行' },
  { label: '@unwrap', type: 'keyword', detail: '不包装', info: '脚本不在沙箱中运行' },
]

const GM_SNIPPETS = [
  { label: 'gmas', type: 'snippet', detail: 'GM_addStyle', apply: snippet('GM_addStyle(\`${1}\`)') },
  { label: 'gmget', type: 'snippet', detail: 'GM_getValue', apply: snippet("GM_getValue('${1:key}', ${2:default})") },
  { label: 'gmset', type: 'snippet', detail: 'GM_setValue', apply: snippet("GM_setValue('${1:key}', ${2:value})") },
  { label: 'gmdel', type: 'snippet', detail: 'GM_deleteValue', apply: snippet("GM_deleteValue('${1:key}')") },
  { label: 'gmlist', type: 'snippet', detail: 'GM_listValues', apply: snippet('GM_listValues()') },
  { label: 'gmxhr', type: 'snippet', detail: 'GM_xmlhttpRequest', apply: snippet("GM_xmlhttpRequest({\n  method: '${1:GET}',\n  url: '${2}',\n  onload(res) {\n    ${3:console.log(res.responseText);}\n  }\n})") },
  { label: 'gmnoti', type: 'snippet', detail: 'GM_notification', apply: snippet("GM_notification({\n  title: '${1:title}',\n  text: '${2:text}'\n})") },
  { label: 'gmclip', type: 'snippet', detail: 'GM_setClipboard', apply: snippet("GM_setClipboard('${1:text}')") },
  { label: 'gmtab', type: 'snippet', detail: 'GM_openInTab', apply: snippet("GM_openInTab('${1:url}')") },
  { label: 'gmstyle', type: 'snippet', detail: 'GM_addStyle full', apply: snippet("GM_addStyle(\`\n  ${1:/* CSS rules */}\n\`)") },
  { label: 'iife', type: 'snippet', detail: 'IIFE wrapper', apply: snippet("(function() {\n  'use strict';\n  ${1:// Your code here...}\n})();") },
  { label: 'usmeta', type: 'snippet', detail: 'UserScript header', apply: snippet("// ==UserScript==\n// @name         ${1:Script Name}\n// @namespace    ${2:hmm}\n// @version      ${3:0.1}\n// @description  ${4:description}\n// @match        ${5:*://*/*}\n// @run-at       ${6:document-idle}\n// @grant        ${7:none}\n// ==/UserScript==") },
  { label: 'gmfetch', type: 'snippet', detail: 'fetch with GM', apply: snippet("GM_xmlhttpRequest({\n  method: '${1:GET}',\n  url: '${2:url}',\n  responseType: '${3:json}',\n  onload(res) {\n    const data = res.response;\n    ${4:// process data}\n  }\n})") },
]

const GM_API_DOCS: Record<string, { signature: string; description: string; example: string }> = {
  GM_getValue: { signature: 'GM_getValue(key: string, defaultValue?: any): any', description: '从脚本存储中获取指定键的值。如果键不存在，返回 defaultValue。', example: "const val = GM_getValue('myKey', 'default');" },
  GM_setValue: { signature: 'GM_setValue(key: string, value: any): void', description: '将值存储到脚本存储中。支持字符串、数字、布尔值、对象等类型。', example: "GM_setValue('myKey', { count: 42 });" },
  GM_deleteValue: { signature: 'GM_deleteValue(key: string): void', description: '从脚本存储中删除指定键的值。', example: "GM_deleteValue('myKey');" },
  GM_listValues: { signature: 'GM_listValues(): string[]', description: '返回脚本存储中所有键名的数组。', example: "const keys = GM_listValues();" },
  GM_log: { signature: 'GM_log(...args: any[]): void', description: '将日志信息输出到浏览器控制台。', example: "GM_log('debug info', data);" },
  GM_addStyle: { signature: 'GM_addStyle(css: string): HTMLStyleElement', description: '向当前页面添加 CSS 样式。返回创建的 style 元素。', example: "GM_addStyle('.ad { display: none !important; }');" },
  GM_xmlhttpRequest: { signature: 'GM_xmlhttpRequest(details: object): object', description: '发起跨域 HTTP 请求。details 包含 method, url, headers, data, onload, onerror 等属性。', example: "GM_xmlhttpRequest({ method: 'GET', url: 'https://api.example.com', onload(res) { console.log(res.responseText); } });" },
  GM_notification: { signature: 'GM_notification(details: object): void', description: '显示桌面通知。details 包含 title, text, image, onclick 等属性。', example: "GM_notification({ title: '提示', text: '操作完成' });" },
  GM_setClipboard: { signature: 'GM_setClipboard(text: string): void', description: '将文本复制到系统剪贴板。', example: "GM_setClipboard('Hello World');" },
  GM_getResourceText: { signature: 'GM_getResourceText(name: string): string', description: '获取 @resource 声明的文本资源内容。', example: "const css = GM_getResourceText('myStyle');" },
  GM_getResourceURL: { signature: 'GM_getResourceURL(name: string): string', description: '获取 @resource 声明资源的 blob URL。', example: "const url = GM_getResourceURL('myImage');" },
  GM_openInTab: { signature: 'GM_openInTab(url: string): void', description: '在新标签页中打开指定 URL。', example: "GM_openInTab('https://example.com');" },
  GM_registerMenuCommand: { signature: 'GM_registerMenuCommand(name: string, callback: Function): number', description: '在脚本菜单中注册一个命令。返回命令 ID。', example: "GM_registerMenuCommand('My Command', () => { /* ... */ });" },
  GM_unregisterMenuCommand: { signature: 'GM_unregisterMenuCommand(id: number): void', description: '注销之前注册的脚本菜单命令。', example: "GM_unregisterMenuCommand(menuId);" },
  unsafeWindow: { signature: 'unsafeWindow: Window', description: '页面原始 window 对象的引用，绕过沙箱限制直接访问页面全局变量。', example: "const jQuery = unsafeWindow.jQuery;" },
  GM_info: { signature: 'GM_info: { script, scriptHandler, version }', description: '包含当前脚本元信息的只读对象。', example: "console.log(GM_info.script.name, GM_info.script.version);" },
}

function gmHoverTooltip(view: EditorView, pos: number) {
  const word = view.state.wordAt(pos)
  if (!word) return null
  const text = view.state.sliceDoc(word.from, word.to)
  const doc = GM_API_DOCS[text]
  if (!doc) return null
  return {
    pos: word.from,
    end: word.to,
    create() {
      const dom = document.createElement('div')
      dom.className = 'gm-hover-doc'
      dom.innerHTML = `<div style="font-family:'Cascadia Code',Consolas,monospace;font-size:12px;max-width:400px;padding:4px 0">
        <div style="color:#569cd6;font-weight:600;margin-bottom:4px">${doc.signature}</div>
        <div style="color:#ccc;margin-bottom:6px">${doc.description}</div>
        <div style="background:rgba(255,255,255,0.06);padding:6px 8px;border-radius:4px;font-size:11px;color:#9cdcfe;white-space:pre-wrap">${doc.example}</div>
      </div>`
      return { dom }
    },
  }
}

function gmCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  const textBefore = context.state.doc.sliceString(0, word.from)
  const isInMetadata = textBefore.includes('// ==UserScript==') &&
    !textBefore.includes('// ==/UserScript==')

  if (isInMetadata) {
    const atWord = context.matchBefore(/@\w*/)
    if (atWord && atWord.from < atWord.to) {
      return { from: atWord.from, options: METADATA_COMPLETIONS, validFor: /^@\w*$/ }
    }
    if (context.explicit) {
      return { from: word.from, options: METADATA_COMPLETIONS, validFor: /^@?\w*$/ }
    }
  }

  const options = [...GM_API_COMPLETIONS, ...GM_SNIPPETS]
  if (isInMetadata) options.push(...METADATA_COMPLETIONS)
  return { from: word.from, options, validFor: /^\w*$/ }
}

const jsLinter = linter((view) => {
  const diagnostics: Diagnostic[] = []
  const rawCode = view.state.doc.toString()

  const eslintDiags = createESLintDiagnostics(rawCode)
  for (const d of eslintDiags) {
    const line = view.state.doc.lineAt(Math.min(d.from, view.state.doc.length))
    diagnostics.push({
      from: Math.min(d.from, view.state.doc.length),
      to: Math.min(d.to, view.state.doc.length),
      severity: d.severity,
      message: d.message,
    })
  }

  const doc = view.state.doc
  const text = doc.toString()
  const headerStart = text.indexOf('// ==UserScript==')
  const headerEnd = text.indexOf('// ==/UserScript==')
  if (headerStart !== -1 && headerEnd === -1) {
    diagnostics.push({
      from: headerStart, to: headerStart + '// ==UserScript=='.length,
      severity: 'warning', message: '缺少 // ==/UserScript== 结束标记',
    })
  }

  const grantNoneMatch = text.match(/@grant\s+none/)
  const usesGmApi = /\bGM_(getValue|setValue|deleteValue|listValues|log|addStyle|xmlhttpRequest|notification|setClipboard|getResourceText|getResourceURL|openInTab|registerMenuCommand|unregisterMenuCommand)\b/.test(text)
  if (grantNoneMatch && usesGmApi) {
    const grantIdx = text.indexOf('@grant none')
    diagnostics.push({
      from: grantIdx, to: grantIdx + '@grant none'.length,
      severity: 'warning', message: '使用了 GM_* API 但 @grant 声明为 none，API 可能不可用',
    })
  }

  return diagnostics
})

function getBaseTheme(dark: boolean, fontSize: number) {
  return EditorView.theme({
    '&': { height: '100%', fontSize: `${fontSize}px` },
    '.cm-scroller': { overflow: 'auto !important', fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace" },
    '.cm-content': { padding: '4px 8px' },
    '.cm-gutters': { minWidth: '36px' },
    '.cm-diagnostic': { paddingLeft: '4px', borderLeft: '3px solid' },
    '.cm-diagnostic-error': { borderLeftColor: '#ef4444' },
    '.cm-diagnostic-warning': { borderLeftColor: '#f59e0b' },
    '.cm-lintRange-error': { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'6\' height=\'3\'%3E%3Cpath d=\'M0 3 L1 0 L2 3 Z\' fill=\'%23ef4444\'/%3E%3C/svg%3E")' },
    '.cm-lintRange-warning': { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'6\' height=\'3\'%3E%3Cpath d=\'M0 3 L1 0 L2 3 Z\' fill=\'%23f59e0b\'/%3E%3C/svg%3E")' },
  }, { dark })
}

const DEFAULT_FONT_SIZE = 13
const currentFontSize = ref(DEFAULT_FONT_SIZE)

function createState(code: string): EditorState {
  const themeDark = isThemeDark(props.editorTheme)
  const extensions = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    indentGuides(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ override: [gmCompletionSource], activateOnTyping: true, icons: true }),
    hoverTooltip(gmHoverTooltip, { hoverTime: 300 }),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    javascript({ jsx: true }),
    html().language.data.of({ autocomplete: css().language.data }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    tabSizeCompartment.of(indentUnit.of(' '.repeat(props.tabSize))),
    wordWrapCompartment.of(props.wordWrap ? EditorView.lineWrapping : []),
    themeCompartment.of(getThemeExtensions(props.editorTheme)),
    baseThemeCompartment.of(getBaseTheme(themeDark, currentFontSize.value)),
    fontSizeCompartment.of(EditorView.theme({ '&': { fontSize: `${currentFontSize.value}px` } })),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        emit('cursorChange', { line: line.number, col: pos - line.from + 1, selected: update.state.selection.main.to - update.state.selection.main.from })
      }
    }),
    jsLinter,
  ]

  return EditorState.create({ doc: code, extensions })
}

function createEditor(code: string) {
  if (!editorRef.value) return
  view = new EditorView({ state: createState(code), parent: editorRef.value })
  setupResizeObserver()
  setupFontSizeListener()
}

function setupFontSizeListener() {
  if (!editorRef.value) return
  editorRef.value.addEventListener('wheel', handleWheel, { passive: false })
}

function cleanupFontSizeListener() {
  if (editorRef.value) {
    editorRef.value.removeEventListener('wheel', handleWheel)
  }
}

function handleWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  const delta = e.deltaY < 0 ? 1 : -1
  zoomFontSize(delta)
}

function zoomFontSize(delta: number) {
  const newSize = Math.min(24, Math.max(10, currentFontSize.value + delta))
  if (newSize === currentFontSize.value) return
  currentFontSize.value = newSize
  if (view) {
    const themeDark = isThemeDark(props.editorTheme)
    view.dispatch({
      effects: [
        baseThemeCompartment.reconfigure(getBaseTheme(themeDark, newSize)),
        fontSizeCompartment.reconfigure(EditorView.theme({ '&': { fontSize: `${newSize}px` } })),
      ],
    })
  }
  emit('fontSizeChange', newSize)
  try { localStorage.setItem('editor-font-size', String(newSize)) } catch {}
}

function resetFontSize() {
  currentFontSize.value = DEFAULT_FONT_SIZE
  if (view) {
    const themeDark = isThemeDark(props.editorTheme)
    view.dispatch({
      effects: [
        baseThemeCompartment.reconfigure(getBaseTheme(themeDark, DEFAULT_FONT_SIZE)),
        fontSizeCompartment.reconfigure(EditorView.theme({ '&': { fontSize: `${DEFAULT_FONT_SIZE}px` } })),
      ],
    })
  }
  emit('fontSizeChange', DEFAULT_FONT_SIZE)
  try { localStorage.setItem('editor-font-size', String(DEFAULT_FONT_SIZE)) } catch {}
}

function setupResizeObserver() {
  cleanupResizeObserver()
  if (!editorRef.value || !view) return
  resizeObserver = new ResizeObserver(() => syncHeight())
  resizeObserver.observe(editorRef.value)
  window.addEventListener('resize', syncHeight)
  syncHeight()
}

function cleanupResizeObserver() {
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  window.removeEventListener('resize', syncHeight)
}

function syncHeight() {
  if (!editorRef.value || !view) return
  const rect = editorRef.value.getBoundingClientRect()
  const h = Math.max(rect.height, 100)
  const dom = view.dom as HTMLElement | null
  if (dom) {
    dom.style.height = h + 'px'
    dom.style.maxHeight = h + 'px'
    const scroller = dom.querySelector('.cm-scroller') as HTMLElement | null
    if (scroller) { scroller.style.height = h + 'px'; scroller.style.overflow = 'auto' }
    view.requestMeasure()
  }
}

onMounted(() => {
  const saved = localStorage.getItem('editor-font-size')
  if (saved) {
    const parsed = parseInt(saved, 10)
    if (parsed >= 10 && parsed <= 24) currentFontSize.value = parsed
  }
  nextTick(() => createEditor(props.modelValue))
})
onUnmounted(() => { cleanupResizeObserver(); cleanupFontSizeListener(); view?.destroy(); view = null })

watch(() => props.modelValue, (newVal) => {
  if (view && newVal !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newVal } })
  }
})

watch(() => props.editorTheme, () => {
  if (view) {
    const themeDark = isThemeDark(props.editorTheme)
    view.dispatch({
      effects: [
        themeCompartment.reconfigure(getThemeExtensions(props.editorTheme)),
        baseThemeCompartment.reconfigure(getBaseTheme(themeDark, currentFontSize.value)),
      ],
    })
    const dom = view.dom as HTMLElement | null
    if (dom) {
      dom.classList.toggle('cm-dark', themeDark)
      dom.classList.toggle('cm-light', !themeDark)
    }
  }
})

watch(() => props.tabSize, (newSize) => {
  if (view) view.dispatch({ effects: tabSizeCompartment.reconfigure(indentUnit.of(' '.repeat(newSize))) })
})

watch(() => props.wordWrap, (wrap) => {
  if (view) view.dispatch({ effects: wordWrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []) })
})

function focus() { view?.focus() }
defineExpose({ focus, zoomFontSize, resetFontSize, getFontSize: () => currentFontSize.value })
</script>

<template>
  <div ref="editorRef" class="code-editor-root" />
</template>

<style scoped>
.code-editor-root { width: 100%; height: 100%; min-height: 0; }
</style>
