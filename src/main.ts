import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'                 // Store
import { initRouter } from './router'               // Router
import language from './locales'                    // 国际化
import '@styles/core/tailwind.css'                  // tailwind
import '@styles/index.scss'                         // 样式
import '@utils/sys/console.ts'                      // 控制台输出内容
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { createLogto } from '@logto/vue'
import { logtoConfig } from '@/config/logto'

document.addEventListener(
  'touchstart',
  function () {},
  { passive: false }
)

const app = createApp(App)

// Logto OIDC 认证插件（Phase 3: 替代 Casdoor）
app.use(createLogto, logtoConfig)

initStore(app)
initRouter(app)
setupGlobDirectives(app)
setupErrorHandle(app)

app.use(language)
app.mount('#app')
