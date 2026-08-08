import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { staticRoutes } from './routes/staticRoutes'
import { configureNProgress } from '@/utils/router'
import { setupBeforeEachGuard } from './guards/beforeEach'
import { setupAfterEachGuard } from './guards/afterEach'

// 创建路由实例
// ⚠️ history 模式（原模板为 hash 模式）：OAuth 回调 URL /auth/callback 依赖真实路径
// 匹配（Logto SDK 按 history 模式解析 callbackUri）；生产部署需服务器 history fallback
export const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_URL || '/'),
  routes: staticRoutes // 静态路由
})

// 初始化路由
export function initRouter(app: App<Element>): void {
  configureNProgress() // 顶部进度条
  setupBeforeEachGuard(router) // 路由前置守卫
  setupAfterEachGuard(router) // 路由后置守卫
  app.use(router)
}

// 主页路径，默认使用菜单第一个有效路径，配置后使用此路径
export const HOME_PAGE_PATH = ''
