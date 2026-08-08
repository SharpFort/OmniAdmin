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
import {
  BrowserStorage,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState
} from '@logto/browser'
import BaseLogtoClient, { createRequester, type ClientAdapter } from '@logto/client'
import { useUserStore } from '@/store/modules/user'

/** Logto API resource（⚠️ 必须配置：token 交换带 resource 才返回 JWT，否则 opaque 非 JWT——PostgREST 报 PGRST301） */
export const API_RESOURCE = import.meta.env.VITE_LOGTO_RESOURCE || 'https://default.logto.app/api'

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
  ],
  /** 请求的 API resource（token 交换必须带 resource 才产出 JWT；PostgREST 不校验 aud） */
  resources: [API_RESOURCE]
}

/** 登录回调地址（动态 origin：跟随当前部署端口，如 3006/5173；需在 Logto Console 登记对应 origin） */
export const redirectUri =
  typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : import.meta.env.VITE_LOGTO_REDIRECT_URI || 'http://localhost:3006/auth/callback'

/** 登出回跳地址（动态 origin，与 redirectUri 保持一致） */
export const postLogoutRedirectUri =
  typeof window !== 'undefined'
    ? `${window.location.origin}/auth/login`
    : import.meta.env.VITE_LOGTO_POST_LOGOUT_REDIRECT_URI || 'http://localhost:3006/auth/login'

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
 * ⚠️ 必须带 resource（API_RESOURCE）：Logto 对无 resource 的 token 交换返回 opaque 非 JWT，
 * PostgREST 校验 JWT 时报 PGRST301。不使用 organization token（org token 缺 roles claim，
 * PostgREST 的 JWT roles 解析依赖用户级 claims）。
 *
 * @param resource 可选 API resource indicator（默认 API_RESOURCE）
 * @returns access_token 字符串；未登录或出错时返回空字符串
 */
export async function getAccessToken(resource?: string): Promise<string> {
  try {
    const isAuth = await logtoClient.isAuthenticated()
    if (!isAuth) return ''

    return await logtoClient.getAccessToken(resource || API_RESOURCE)
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
        // ⚠️ 必须带 resource：无 resource 刷新返回 opaque 非 JWT（PostgREST PGRST301）
        const token = await logtoClient.getAccessToken(API_RESOURCE)
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

/**
 * 生成 Logto 授权 URL（登录页 iframe 嵌入用，§2.1 B 方案）
 *
 * 复用 SDK 的 signIn 全流程（PKCE verifier/state 生成、signInSession 写入），
 * 仅将 navigate 从"顶层跳转"替换为"捕获 URL"：
 * - signInSession 写入 sessionStorage（键 logto:<appId>:signInSession）——
 *   与 iframe 内的回调页同源共享，useHandleSignInCallback 可正常完成 code 交换
 * - token 写入 localStorage——整页跳转后应用重启可恢复登录态
 * - 失败可重试（重置内部 Promise）
 */
let embedSignInUrlPromise: Promise<string> | null = null

export async function createEmbedSignInUrl(): Promise<string> {
  if (embedSignInUrlPromise) {
    return embedSignInUrlPromise
  }

  embedSignInUrlPromise = (async () => {
    let captured = ''
    const adapter: ClientAdapter = {
      requester: createRequester(fetch),
      // 与 main.ts createLogto 插件同款存储（BrowserStorage(appId)），保证会话共享
      storage: new BrowserStorage(logtoConfig.appId),
      // 不跳转顶层窗口：捕获授权 URL 供 iframe 使用
      navigate: (url) => {
        captured = url
      },
      generateState,
      generateCodeVerifier,
      generateCodeChallenge
    }
    const client = new BaseLogtoClient(logtoConfig, adapter)
    await client.signIn(redirectUri)
    return captured
  })()

  try {
    return await embedSignInUrlPromise
  } catch (error) {
    // 生成失败允许重试（如 Logto 临时不可用）
    embedSignInUrlPromise = null
    throw error
  }
}
