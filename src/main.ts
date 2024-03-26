import { createApp } from 'vue'

import App from './App.vue'
import 'uno.css'
import { i18n } from './locales'

import 'tdesign-vue-next/es/style/index.css'
import './styles/theme.css'

const app = createApp(App)

app.use(i18n)

app.mount('#app')
