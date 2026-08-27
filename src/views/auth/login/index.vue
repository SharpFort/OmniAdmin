<!--
  登录页面（§2.1 B 方案：artd 品牌展示 + Logto 托管登录页 iframe 嵌入）
  左侧为原 artd 品牌区（LoginLeftView），右侧 iframe 内嵌 Logto 托管登录卡片。
  流程：
    1. onMounted 用 SDK 生成授权 URL（PKCE 会话写入共享 sessionStorage）
    2. iframe 加载 Logto 托管登录页；登录完成后 Logto 在 iframe 内重定向到 /auth/callback
    3. 回调页（iframe 同源）完成 code → token 交换后 postMessage 通知本页
    4. 本页（父窗口）在同一 SPA 内完成 token 落库 + JIT 建档 + 拉取用户信息，
       再用 router.replace() 跳到目标页——不再整页跳转，避免“登录后右侧无限刷新”。
  兜底：URL 生成失败或 iframe 不可用（如生产 CSP 未放行）→ 显示"在新窗口打开"。
-->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex-1">
      <!-- Logto 托管页自带上右上角语言/主题切换；若再叠加应用端 AuthTopBar 会形成重影。
           仅在 Logto 页尚未加载（loading/兜底）时显示应用端控制条。 -->
      <AuthTopBar v-if="!signInUrl" />

      <div class="auth-right-wrap">
        <!-- 生成授权地址中 -->
        <div v-if="loading" class="embed-center">
          <el-icon class="is-loading text-2xl mb-2"><Loading /></el-icon>
          <p class="text-sm opacity-60">正在加载统一身份认证...</p>
        </div>

        <!-- Logto 托管登录页（iframe 嵌入） -->
        <iframe
          v-else-if="signInUrl"
          :key="iframeKey"
          :src="signInUrl"
          class="logto-embed-frame"
          title="统一身份认证登录"
        />

        <!-- 加载失败兜底 -->
        <div v-else class="embed-center">
          <p class="text-sm opacity-60 mb-4">统一身份认证加载失败</p>
          <p v-if="errorMessage" class="text-xs text-red-500 mb-2 max-w-60 break-all">{{
            errorMessage
          }}</p>
          <ElButton type="primary" class="w-full" @click="handleOpenInNewWindow">
            在新窗口打开登录页
          </ElButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import './style.css'
  import { Loading } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useRoute, useRouter } from 'vue-router'
  import { useUserStore } from '@/store/modules/user'
  import { createEmbedSignInUrl, getAccessToken, API_RESOURCE, organizationId } from '@/config/logto'
  import { ensureUser, getCurrentUser } from '@/api/auth'

  defineOptions({ name: 'Login' })

  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()

  const loading = ref(true)
  const signInUrl = ref('')
  const iframeKey = ref(0)
  const errorMessage = ref('')

  /** 嵌入登录消息协议（与回调页约定：postMessage 仅同源转发） */
  const EMBED_MSG_SOURCE = 'logto-embed'
  /** 守卫传入的 redirect 参数跨 iframe 传递（sessionStorage） */
  const EMBED_REDIRECT_KEY = 'logto_embed_redirect'
  /** iframe 登录失败自动重试上限（防止“用户不在组织/令牌获取失败”等持久错误导致无限刷新） */
  const MAX_EMBED_RETRIES = 3
  let embedRetryCount = 0

  /** 登录成功后的跳转目标：query.redirect（守卫传入）> sessionStorage > 首页 */
  const getRedirectTarget = () => {
    const fromQuery = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const fromStorage = sessionStorage.getItem(EMBED_REDIRECT_KEY) || ''
    sessionStorage.removeItem(EMBED_REDIRECT_KEY)
    return fromQuery || fromStorage || '/'
  }

  /**
   * 父窗口侧登录后处理：token 落库 → JIT 建档（重试 1 次）→ 拉用户信息 → $persist → SPA 跳转。
   * 关键点：在浏览器同源 SPA 内完成（不再 window.location 整页跳转），
   * 因此 userStore.isLogin 在本页内存即为 true，守卫不会再踢回登录页，避免无限刷新。
   */
  const handlePostLogin = async () => {
    try {
      // 0. 获取 access token（组织 token 失败自动回退用户级）
      const token = await getAccessToken(API_RESOURCE, organizationId || undefined)
      if (!token) {
        throw new Error('无法获取访问令牌')
      }
      userStore.setToken(token)

      // 1. JIT 兜底建档（失败重试 1 次）
      let ensureOk = false
      for (let attempt = 0; attempt < 2 && !ensureOk; attempt++) {
        try {
          await ensureUser()
          ensureOk = true
        } catch (e) {
          if (attempt === 0) {
            console.warn('[Login] ensure_user 失败，重试一次:', e)
          } else {
            throw e
          }
        }
      }

      // 2. 拉取用户信息
      const userInfo = await getCurrentUser()
      userStore.setUserInfo(userInfo)
      userStore.setLoginStatus(true)
      userStore.checkAndClearWorktabs()

      // 3. 强制持久化（同一 SPA 内跳转，仍显式写盘兜底）
      ;(userStore as any).$persist?.()

      // 4. SPA 跳转目标页（不整页刷新，避免回跳登录页循环）
      router.replace(getRedirectTarget())
    } catch (error) {
      console.error('[Login] 登录成功后处理失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '登录未完成，请重试')
      if (embedRetryCount < MAX_EMBED_RETRIES) {
        embedRetryCount += 1
        // 重置 iframe（signInSession 已消费，复用同一授权地址会重走交互）
        iframeKey.value += 1
      } else {
        console.error('[Login] Logto 登录失败重试超限，请刷新页面或检查账号组织归属:', error)
      }
    }
  }

  /** 接收 iframe 内回调页的消息（仅信任同源：回调页与登录页同为 3006） */
  const handleEmbedMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    const data = event.data
    if (!data || data.source !== EMBED_MSG_SOURCE) return

    if (data.type === 'sign-in-success') {
      // 父窗口侧完成登录后处理与跳转（不整页跳转，规避无限刷新）
      void handlePostLogin()
      return
    }
    if (data.type === 'sign-in-error') {
      ElMessage.error(typeof data.message === 'string' ? data.message : '登录未完成，请重试')
      if (embedRetryCount < MAX_EMBED_RETRIES) {
        embedRetryCount += 1
        iframeKey.value += 1
      } else {
        console.error('[Login] Logto 登录失败重试超限，请刷新页面或检查账号组织归属:', data.message)
      }
    }
  }

  onMounted(async () => {
    // 保存守卫传入的 redirect，供登录成功后的跳转使用
    if (typeof route.query.redirect === 'string' && route.query.redirect) {
      sessionStorage.setItem(EMBED_REDIRECT_KEY, route.query.redirect)
    }
    window.addEventListener('message', handleEmbedMessage)

    try {
      signInUrl.value = await createEmbedSignInUrl()
    } catch (error) {
      console.error('[Login] 生成 Logto 授权地址失败:', error)
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      loading.value = false
    }
  })

  onUnmounted(() => {
    window.removeEventListener('message', handleEmbedMessage)
  })

  /** 兜底：顶层打开 Logto 托管登录页（iframe 被拦截或地址生成失败时） */
  const handleOpenInNewWindow = async () => {
    try {
      const url = signInUrl.value || (await createEmbedSignInUrl())
      const win = window.open(url, '_blank', 'noopener')
      if (!win) {
        // 弹窗被拦截时退化为整页跳转
        window.location.href = url
      }
    } catch (error) {
      console.error('[Login] 获取 Logto 授权地址失败:', error)
      errorMessage.value = error instanceof Error ? error.message : String(error)
      ElMessage.error('无法获取登录地址，请稍后重试')
    }
  }
</script>
