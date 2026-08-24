<!--
  Logto OAuth 回调页（§2.1 定稿四步：① 检测 URL error → 提示+回登录页；② ensureUser JIT 建档
  （失败重试 1 次）；③ getCurrentUser 填 userStore；④ 跳转登录前页面）
  嵌入模式（§2.1 B 方案）：回调发生在登录页 iframe 内（同源 3006）——token 交换、JIT 建档照常，
  但最终跳转改为 postMessage 通知父窗口（父窗口整页跳转，避免 iframe 内空转）。
-->
<template>
  <div class="flex items-center justify-center w-full h-screen">
    <div class="text-center">
      <el-icon class="is-loading text-4xl mb-4"><Loading /></el-icon>
      <p>{{ statusText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Loading } from '@element-plus/icons-vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'
  import { useLogto, useHandleSignInCallback } from '@logto/vue'
  import { ensureUser, getCurrentUser } from '@/api/auth'
  import { API_RESOURCE, organizationId } from '@/config/logto'

  defineOptions({ name: 'AuthCallback' })

  const router = useRouter()
  const userStore = useUserStore()
  const statusText = ref('正在完成登录...')

  // 标记是否已完成回调处理（防止重复执行）
  const handled = ref(false)

  /** 是否运行在登录页 iframe 内（嵌入登录 B 方案：回调由 iframe 承接） */
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top

  /** 嵌入模式消息协议（与登录页约定；仅同源转发） */
  const EMBED_MSG_SOURCE = 'logto-embed'

  /** 向父窗口转发结果（登录页监听；父窗口负责最终跳转） */
  const postToParent = (payload: Record<string, unknown>) => {
    window.parent.postMessage({ source: EMBED_MSG_SOURCE, ...payload }, window.location.origin)
  }

  /** Logto SDK composable：用于获取 token */
  const { getAccessToken } = useLogto()

  /** 回到登录页（携带提示） */
  const backToLogin = (message?: string) => {
    if (message) {
      ElMessage.error(message)
    }
    router.replace({ name: 'Login' })
  }

  /**
   * 登录成功后的处理：存 token → JIT 建档（重试 1 次）→ 拉用户信息 → 跳转
   */
  const handleLoginSuccess = async () => {
    if (handled.value) return
    handled.value = true

    try {
      // 0. 获取 access token 并存入 store（⚠️ 必须带 resource：无 resource 返回 opaque
      // 非 JWT，PostgREST 报 PGRST301；授权时 SDK 已按 config.resources 存 JWT 于
      // resource key 下，此处显式取对应 key）
      statusText.value = '正在获取令牌...'
      const token = await getAccessToken(API_RESOURCE, organizationId || undefined)
      if (token) {
        userStore.setToken(token)
      } else {
        throw new Error('无法获取访问令牌')
      }

      // 1. JIT 兜底建档（ensure_user；失败重试 1 次，仍失败提示并回登录页）
      statusText.value = '正在初始化账户...'
      let ensureOk = false
      for (let attempt = 0; attempt < 2 && !ensureOk; attempt++) {
        try {
          await ensureUser()
          ensureOk = true
        } catch (e) {
          if (attempt === 0) {
            console.warn('[Callback] ensure_user 失败，重试一次:', e)
          } else {
            throw e
          }
        }
      }

      // 2. 拉取用户信息
      statusText.value = '正在加载用户信息...'
      const userInfo = await getCurrentUser()
      userStore.setUserInfo(userInfo)
      userStore.setLoginStatus(true)
      userStore.checkAndClearWorktabs()

      // 3. 跳转：嵌入模式 → 通知父窗口整页跳转（token 已在共享存储，父窗口重启后恢复登录态）；
      //    普通模式 → 直接 SPA 跳转
      if (isInIframe) {
        postToParent({ type: 'sign-in-success' })
        return
      }
      const redirect =
        typeof router.currentRoute.value.query.redirect === 'string'
          ? router.currentRoute.value.query.redirect
          : '/'
      router.replace(redirect)
    } catch (e) {
      console.error('[Callback] 登录后处理失败:', e)
      if (isInIframe) {
        postToParent({
          type: 'sign-in-error',
          message: e instanceof Error ? e.message : '登录失败，请重试'
        })
        return
      }
      backToLogin(e instanceof Error ? e.message : '登录失败，请重试')
    }
  }

  // 使用 Logto SDK 的 useHandleSignInCallback
  // 它会自动检测当前 URL 是否为 OAuth 回调并完成 code → token 交换
  // （嵌入模式下 signInSession 由登录页写入共享 sessionStorage，iframe 内同样可完成交换）
  const { error } = useHandleSignInCallback(async () => {
    statusText.value = '正在交换令牌...'
    await handleLoginSuccess()
  })

  // 监听回调节错误（用户取消登录/注册失败/consent 拒绝等 → D-2 场景）
  watch(error, (err) => {
    if (err && !handled.value) {
      handled.value = true
      console.error('[Callback] Logto 回调处理失败:', err)
      const errorDescription = router.currentRoute.value.query.error_description
      const message =
        (typeof errorDescription === 'string' && errorDescription) ||
        err.message ||
        '登录未完成，请重试'
      if (isInIframe) {
        postToParent({ type: 'sign-in-error', message })
        return
      }
      backToLogin(message)
    }
  })

  // 兜底：URL 直接带 error 参数（useHandleSignInCallback 未触发 error 时）
  onMounted(() => {
    const { error: urlError, error_description: urlErrorDescription } =
      router.currentRoute.value.query
    if (typeof urlError === 'string' && urlError && !handled.value) {
      handled.value = true
      const message =
        typeof urlErrorDescription === 'string' ? urlErrorDescription : '登录未完成，请重试'
      if (isInIframe) {
        postToParent({ type: 'sign-in-error', message })
        return
      }
      backToLogin(message)
    }
  })
</script>
