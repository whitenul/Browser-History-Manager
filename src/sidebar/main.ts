import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AppShell from '@/AppShell.vue'
import '@unocss/reset/tailwind.css'
import '@/styles/main.css'
import 'virtual:uno.css'

const pinia = createPinia()
const app = createApp(AppShell)
app.use(pinia)
app.mount('#app')
