<!-- Logto OAuth 回调页（Phase 3: handleSignInCallback → 存 token → JIT 建档 → 获取用户信息 → 跳转） -->
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
  import { fetchEnsureUser, fetchGetUserInfo } from '@/api/auth'

  defineOptions({ name: 'AuthCallback' })

  const router = useRouter()
  const userStore = useUserStore()
  const statusText = ref('正在完成登录...')

  // 标记是否已完成回调处理（防止重复执行）
  const handled = ref(false)

  /** Logto SDK composable：用于获取 token */
  const { getAccessToken } = useLogto()

  /** 登录成功后的处理：存 token → JIT 建档 → 拉用户信息 → 跳转 */
  const handleLoginSuccess = async () => {
    if (handled.value) return
    handled.value = true

    try {
      // 0. 获取 access token 并存入 store（后续 API 调用依赖此 token）
      statusText.value = '正在获取令牌...'
      const token = await getAccessToken()
      if (token) {
        userStore.setToken(token)
      } else {
        throw new Error('无法获取访问令牌')
      }

      // 1. JIT 兜底建档（PostgREST RPC）
      statusText.value = '正在初始化账户...'
      await fetchEnsureUser().catch((e) => {
        console.warn('[Callback] ensure_user 失败（可容忍）:', e)
      })

      // 2. 拉取用户信息
      statusText.value = '正在加载用户信息...'
      const userInfo = await fetchGetUserInfo()
      userStore.setUserInfo(userInfo)
      userStore.setLoginStatus(true)
      userStore.checkAndClearWorktabs()

      // 3. 跳转到首页（或 query 中的 redirect）
      const redirect =
        typeof router.currentRoute.value.query.redirect === 'string'
          ? router.currentRoute.value.query.redirect
          : '/'
      router.replace(redirect)
    } catch (e) {
      console.error('[Callback] 登录后处理失败:', e)
      ElMessage.error(e instanceof Error ? e.message : '登录失败，请重试')
      router.replace({ name: 'Login' })
    }
  }

  // 使用 Logto SDK 的 useHandleSignInCallback
  // 它会自动检测当前 URL 是否为 OAuth 回调并完成 code → token 交换
  const { error } = useHandleSignInCallback(async () => {
    statusText.value = '正在交换令牌...'
    await handleLoginSuccess()
  })

  // 监听回调节错误
  watch(error, (err) => {
    if (err && !handled.value) {
      handled.value = true
      console.error('[Callback] Logto 回调处理失败:', err)
      ElMessage.error(err.message || '登录失败，请重试')
      router.replace({ name: 'Login' })
    }
  })
</script>
