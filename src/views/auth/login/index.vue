<!-- 登录页面（Phase 3: Logto OIDC SDK） -->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex-1">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('login.title') }}</h3>
          <p class="sub-title">{{ $t('login.subTitle') }}</p>

          <div class="mt-10">
            <ElButton
              type="primary"
              class="w-full custom-height"
              :loading="loading"
              @click="handleLogtoLogin"
            >
              {{ $t('login.casdoorLogin') || '统一身份认证登录' }}
            </ElButton>
            <p class="mt-4 text-sm text-center opacity-60"> 登录将由 Logto 统一身份认证处理 </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useLogto } from '@logto/vue'
  import { redirectUri } from '@/config/logto'

  defineOptions({ name: 'Login' })

  const loading = ref(false)

  const { signIn: logtoSignIn } = useLogto()

  /** 跳转 Logto 授权页 */
  const handleLogtoLogin = async () => {
    loading.value = true
    try {
      await logtoSignIn(redirectUri)
    } catch (e) {
      loading.value = false
      console.error('[Login] Logto signIn 失败:', e)
    }
  }
</script>
