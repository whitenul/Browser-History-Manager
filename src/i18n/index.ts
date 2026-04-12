import { ref, computed, watch } from 'vue'
import zhCN from './locales/zh-CN'
import en from './locales/en'

type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }

type LocaleMessages = typeof zhCN

const LOCALES: Record<string, LocaleMessages> = {
  'zh-CN': zhCN,
  'zh': zhCN,
  'en': en,
  'en-US': en,
  'en-GB': en,
}

const STORAGE_KEY = 'app_locale'

function detectBrowserLocale(): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && LOCALES[stored]) return stored

  const navLangs = navigator.languages || [navigator.language]
  for (const lang of navLangs) {
    if (LOCALES[lang]) return lang
    const short = lang.split('-')[0]
    if (LOCALES[short]) return short
  }
  return 'zh-CN'
}

const currentLocale = ref(detectBrowserLocale())
const messages = ref<LocaleMessages>(LOCALES[currentLocale.value] || zhCN)

watch(currentLocale, (locale) => {
  messages.value = LOCALES[locale] || zhCN
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}, { immediate: true })

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

export function useI18n() {
  function t(key: string, params?: Record<string, string | number>): string {
    let value = getNestedValue(messages.value, key)
    if (value === undefined) {
      value = getNestedValue(zhCN, key)
    }
    if (value === undefined) return key
    if (typeof value === 'string' && params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
    }
    return value
  }

  const locale = computed(() => currentLocale.value)

  function setLocale(locale: string) {
    if (LOCALES[locale]) {
      currentLocale.value = locale
    }
  }

  const availableLocales = computed(() => [
    { code: 'zh-CN', name: '简体中文' },
    { code: 'en', name: 'English' },
  ])

  return { t, locale, setLocale, availableLocales }
}
