<!--
  登录页面（§2.1 B 方案：artd 品牌展示 + Logto 托管登录页 iframe 嵌入）
  左侧为原 artd 品牌区（LoginLeftView），右侧 iframe 内嵌 Logto 托管登录页。
  流程：
    1. onMounted 用 SDK 生成授权 URL（PKCE 会话写入共享 sessionStorage）
    2. iframe 加载 Logto 登录页；登录完成后 Logto 在 iframe 内重定向到 /auth/callback
    3. 回调页（iframe 同源）完成 code 交换后 postMessage 通知本页
    4. 本页整页跳转（token 已在共享存储，应用重启后自动恢复登录态）
  兜底：URL 生成失败或 iframe 不可用（如生产 CSP 未放行）→ 显示"在新窗口打开"。
-->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex-1">
      <AuthTopBar />

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
  import { useRoute } from 'vue-router'
  import { createEmbedSignInUrl } from '@/config/logto'

  defineOptions({ name: 'Login' })

  const route = useRoute()

  const loading = ref(true)
  const signInUrl = ref('')
  const iframeKey = ref(0)

  /** 嵌入登录消息协议（与回调页约定：postMessage 仅同源转发） */
  const EMBED_MSG_SOURCE = 'logto-embed'
  /** 守卫传入的 redirect 参数跨 iframe 传递（sessionStorage） */
  const EMBED_REDIRECT_KEY = 'logto_embed_redirect'

  /** 登录成功后的跳转目标：query.redirect（守卫传入）> sessionStorage > 首页 */
  const getRedirectTarget = () => {
    const fromQuery = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const fromStorage = sessionStorage.getItem(EMBED_REDIRECT_KEY) || ''
    sessionStorage.removeItem(EMBED_REDIRECT_KEY)
    return fromQuery || fromStorage || '/'
  }

  /** 接收 iframe 内回调页的消息（仅信任同源：回调页与登录页同为 5173） */
  const handleEmbedMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    const data = event.data
    if (!data || data.source !== EMBED_MSG_SOURCE) return

    if (data.type === 'sign-in-success') {
      // 整页跳转：token 已在 localStorage，应用重启后从持久化 store 恢复登录态
      window.location.href = getRedirectTarget()
      return
    }
    if (data.type === 'sign-in-error') {
      ElMessage.error(typeof data.message === 'string' ? data.message : '登录未完成，请重试')
      // 重置 iframe，回到 Logto 登录表单（signInSession 未消费，复用同一授权地址）
      iframeKey.value += 1
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
      window.location.href = url
    } catch (error) {
      console.error('[Login] 获取 Logto 授权地址失败:', error)
      ElMessage.error('无法获取登录地址，请稍后重试')
    }
  }
</script>
