import { createApp } from 'vue'
import { createPinia } from 'pinia'
import EditorApp from '@/editor/EditorApp.vue'
import '@unocss/reset/tailwind.css'
import '@/styles/main.css'
import 'virtual:uno.css'

const pinia = createPinia()
const app = createApp(EditorApp)
app.use(pinia)
app.mount('#app')
