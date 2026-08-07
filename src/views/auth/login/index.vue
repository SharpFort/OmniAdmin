<!-- 登录页面（Logto 全托管：仅两个入口按钮，无本地表单） -->
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
            <ElButton
              class="w-full custom-height mt-4"
              plain
              :loading="loading"
              @click="handleLogtoSignUp"
            >
              {{ $t('login.register') || '注册账号' }}
            </ElButton>
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

  /** 跳转 Logto 托管登录页（signIn 第二参数为字符串枚举，见 @logto/vue 3.0.13 签名） */
  const handleLogtoLogin = async () => {
    loading.value = true
    try {
      await logtoSignIn(redirectUri)
    } catch (e) {
      loading.value = false
      console.error('[Login] Logto signIn 失败:', e)
    }
  }

  /** 跳转 Logto 托管注册页（注册完成后自动登录并回调） */
  const handleLogtoSignUp = async () => {
    loading.value = true
    try {
      await logtoSignIn(redirectUri, 'signUp')
    } catch (e) {
      loading.value = false
      console.error('[Login] Logto signUp 失败:', e)
    }
  }
</script>
