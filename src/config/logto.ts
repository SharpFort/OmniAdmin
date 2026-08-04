/**
 * Logto OIDC 配置与工具（Phase 3: Logto OIDC SDK 替代 Casdoor PKCE）
 *
 * ## 流程
 *   1. 登录页调用 useLogto().signIn(redirectUri) 跳转 Logto 授权页
 *   2. Logto 回调 /auth/callback?code=xxx&state=xxx
 *   3. 回调页 useHandleSignInCallback() 完成 code → token 交换，
 *      然后 getAccessToken() 存入 userStore
 *   4. 后续请求通过 userStore.accessToken 携带 Bearer token；
 *      token 过期时 axios 拦截器通过本模块 getAccessToken() 自动刷新
 *
 * ## 双实例架构
 *   - Vue 组件内：使用 main.ts 注册的 createLogto 插件 + useLogto() composable（响应式）
 *   - 非组件代码（axios 拦截器等）：使用本模块导出的 logtoClient 单例
 *   - 两个 LogtoClient 实例共享同一浏览器存储（sessionStorage）；token 状态自动同步
 */
import LogtoClient, { type LogtoConfig, UserScope } from '@logto/browser'
import { useUserStore } from '@/store/modules/user'

/** Logto 应用配置（同时用于本模块单例和 main.ts 中的 createLogto 插件） */
export const logtoConfig: LogtoConfig = {
  /** Logto OIDC endpoint（容器 core 端口，本地开发用 localhost:3001） */
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT || 'http://localhost:3001',
  /** Logto 应用 ID（需在 Logto Console 创建 SPA 应用后填入 .env.development） */
  appId: import.meta.env.VITE_LOGTO_APP_ID || '',
  /** 请求的 OIDC scopes */
  scopes: [
    UserScope.Profile,
    UserScope.Email,
    UserScope.Phone,
    UserScope.CustomData,
    UserScope.Identities,
    UserScope.Roles,
    UserScope.Organizations
  ]
}

/** 回调地址（需在 Logto Console 中注册为 Redirect URI） */
export const redirectUri =
  import.meta.env.VITE_LOGTO_REDIRECT_URI || 'http://localhost:5173/auth/callback'

/** 登出后跳转地址（需在 Logto Console 中注册为 Post Sign-out Redirect URI） */
export const postLogoutRedirectUri =
  import.meta.env.VITE_LOGTO_POST_LOGOUT_REDIRECT_URI || 'http://localhost:5173/auth/login'

/** 组织 ID（留空则使用用户级 token；后续可按需动态传入） */
export const organizationId = import.meta.env.VITE_LOGTO_ORGANIZATION_ID || ''

/**
 * 模块级 LogtoClient 单例
 *
 * 用于非组件代码（axios 拦截器 token 刷新、登出等）。
 * Vue 组件内应使用 main.ts 注册的 createLogto 插件 + useLogto() composable。
 */
export const logtoClient = new LogtoClient(logtoConfig)

/**
 * 获取 access token（SDK 内置过期检测与刷新）
 *
 * @param resource 可选 API resource indicator
 * @param orgId   可选组织 ID
 * @returns access_token 字符串；未登录或出错时返回空字符串
 */
export async function getAccessToken(resource?: string, orgId?: string): Promise<string> {
  try {
    const isAuth = await logtoClient.isAuthenticated()
    if (!isAuth) return ''

    if (orgId || organizationId) {
      try {
        return await logtoClient.getOrganizationToken(orgId || organizationId)
      } catch {
        // 组织 token 失败，回退到普通 token
      }
    }

    return await logtoClient.getAccessToken(resource)
  } catch {
    return ''
  }
}

/** 刷新锁（并发 401 只触发一次 token 刷新） */
let refreshPromise: Promise<string> | null = null

/**
 * 确保 access_token 新鲜（单飞，并发安全）
 *
 * 由 axios 响应拦截器在收到 401 时调用。
 * 成功则更新 userStore.accessToken，调用方应重试原请求。
 *
 * @returns 最新 access_token（刷新失败时返回空字符串）
 */
export async function ensureFreshToken(): Promise<string> {
  const userStore = useUserStore()
  if (!userStore.accessToken) return ''

  try {
    const isAuth = await logtoClient.isAuthenticated()
    if (!isAuth) {
      userStore.setToken('')
      return ''
    }
  } catch {
    return userStore.accessToken
  }

  // 单飞模式：并发请求共享同一个刷新 Promise
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const token = await logtoClient.getAccessToken()
        if (token) {
          userStore.setToken(token)
        }
        return token
      } catch {
        return ''
      }
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

/**
 * 登录：跳转 Logto 授权页
 *
 * 应在 Vue 组件中通过 useLogto().signIn(redirectUri) 调用；
 * 此函数仅作为非组件后备。
 */
export async function signIn(redirect?: string): Promise<void> {
  const targetUri = redirect || redirectUri
  await logtoClient.signIn(targetUri)
}

/**
 * 登出：清除远端会话 + 本地 token + 跳转登录页
 */
export async function signOut(): Promise<void> {
  const userStore = useUserStore()
  try {
    await logtoClient.signOut(postLogoutRedirectUri)
  } catch {
    // 即使远端登出失败也清理本地状态
  }
  userStore.logOut()
}

/**
 * 通过 Logto SDK 获取用户信息（OIDC Userinfo Endpoint）
 */
export async function fetchUserInfo() {
  return logtoClient.fetchUserInfo()
}

/**
 * 判断当前是否已认证（基于浏览器存储中的 token）
 */
export async function isAuthenticated(): Promise<boolean> {
  return logtoClient.isAuthenticated()
}
