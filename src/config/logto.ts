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
import { BrowserStorage } from '@logto/browser'
import BaseLogtoClient, { createRequester, type ClientAdapter } from '@logto/client'
import { useUserStore } from '@/store/modules/user'
import CryptoJS from 'crypto-js'

/** Logto API resource（⚠️ 必须配置：token 交换带 resource 才返回 JWT，否则 opaque 非 JWT——PostgREST 报 PGRST301） */
export const API_RESOURCE = import.meta.env.VITE_LOGTO_RESOURCE || 'https://default.logto.app/api'

/** 本地开发默认值（与 OmniPG 当前 Logto 实例对齐；生产环境用 .env.production 覆盖） */
const DEV_DEFAULT_APP_ID = '0d4o8wb6qk9bar0egelb4'
const DEV_DEFAULT_ORG_ID = 'q8xan57gksx5'

/** Logto 应用配置（同时用于本模块单例和 main.ts 中的 createLogto 插件） */
export const logtoConfig: LogtoConfig = {
  /** Logto OIDC endpoint（容器 core 端口，本地开发用 localhost:3001） */
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT || 'http://localhost:3001',
  /** Logto 应用 ID（需在 Logto Console 创建 SPA 应用后填入 .env.development；开发兜底 DEV_DEFAULT_APP_ID） */
  appId: import.meta.env.VITE_LOGTO_APP_ID || DEV_DEFAULT_APP_ID,
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

/** 登录回调地址（动态 origin：跟随当前部署端口，固定 3006/3007；需在 Logto Console 登记对应 origin） */
export const redirectUri =
  typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : import.meta.env.VITE_LOGTO_REDIRECT_URI || 'http://localhost:3006/auth/callback'

/** 登出回跳地址（动态 origin，与 redirectUri 保持一致） */
export const postLogoutRedirectUri =
  typeof window !== 'undefined'
    ? `${window.location.origin}/auth/login`
    : import.meta.env.VITE_LOGTO_POST_LOGOUT_REDIRECT_URI || 'http://localhost:3006/auth/login'

/** 组织 ID（业务组织；getAccessToken 传参用，留空则用户级 token，组织级 RLS 不可用） */
export const organizationId =
  import.meta.env.VITE_LOGTO_ORGANIZATION_ID || (import.meta.env.DEV ? DEV_DEFAULT_ORG_ID : '')

if (import.meta.env.DEV) {
  console.info(
    '[LogtoConfig] endpoint=',
    logtoConfig.endpoint,
    'appId=',
    logtoConfig.appId,
    'orgId=',
    organizationId || '(none)'
  )
}

/**
 * D27：组织（业务租户）上下文。
 * - 用户级 token 缺失 organization_id claim，RLS 只能看到全局行；
 * - 组织 token 由 SDK getAccessToken(resource, organizationId) 换取，包含
 *   roles/global_roles/org_roles/pg_role/tenant_id/organization_id（init-logto.py CLAIMS_SCRIPT）。
 * - 开发环境从 .env.development 注入；多组织切换场景可在运行时传入 orgId。
 */

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
 * PostgREST 校验 JWT 时报 PGRST301。
 * D27：组织 token 同样带 roles/global_roles/org_roles/pg_role claims（init-logto.py 注入），
 * 因此传入 organizationId 换取组织 token 是 RLS 组织隔离的前提；未传则退化为用户级 token（仅全局行）。
 *
 * @param resource 可选 API resource indicator（默认 API_RESOURCE）
 * @param orgId 可选 Logto Organization id（业务组织；缺省回退 VITE_LOGTO_ORGANIZATION_ID）
 * @returns access_token 字符串；未登录或出错时返回空字符串
 */
export async function getAccessToken(resource?: string, orgId?: string): Promise<string> {
  try {
    const isAuth = await logtoClient.isAuthenticated()
    if (!isAuth) return ''

    const resourceTarget = resource || API_RESOURCE
    const effectiveOrgId = orgId || organizationId || undefined
    if (effectiveOrgId) {
      try {
        return await logtoClient.getAccessToken(resourceTarget, effectiveOrgId)
      } catch (error) {
        // 组织 token 失败（非成员/org 已重建）时回退用户级 token，避免登录卡死；组织级 RLS 功能将不可用
        console.warn('[Logto] 组织 token 获取失败，回退用户级 token:', error)
      }
    }
    return await logtoClient.getAccessToken(resourceTarget)
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
        const token = await getAccessToken(API_RESOURCE)
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
 * @param interactionMode OIDC 交互模式：signIn=登录（默认）、signUp=注册（注册后自动登录并回调）
 */
export async function signIn(
  redirect?: string,
  interactionMode?: 'signIn' | 'signUp'
): Promise<void> {
  const targetUri = redirect || redirectUri
  await logtoClient.signIn(targetUri, interactionMode)
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
/** PKCE 辅助：用 CryptoJS 实现，避免非 secure context（如局域网 IP http 访问）下 crypto.subtle 不可用 */
function sha256Base64Url(input: string): string {
  const b64 = CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(input))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomBase64Url(bytes = 64): string {
  const b64 = CryptoJS.enc.Base64.stringify(CryptoJS.lib.WordArray.random(bytes))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** 嵌入模式专用：静态生成 verifier/challenge/state（与 @logto/browser 输出格式一致） */
export const embedGenerateCodeVerifier = () => Promise.resolve(randomBase64Url(64))
export const embedGenerateCodeChallenge = (verifier: string) =>
  Promise.resolve(sha256Base64Url(verifier))
export const embedGenerateState = () => Promise.resolve(randomBase64Url(32))

/**
 * 同源代理 requester：把 Logto discovery 返回的端点改写为当前前端 origin，
 * 使 iframe 内嵌登录走 Vite/APISIX 同源代理，避免 cross-site SameSite Cookie 导致
 * Logto 报“未找到会话”。仅影响 createEmbedSignInUrl 的授权 URL 生成。
 */
function createSameOriginRequester() {
  const baseRequester = createRequester(fetch)
  return async (input: any, init?: any): Promise<any> => {
    let requestUrl: any = input
    let url = String(input)
    // discovery 请求先改走同源 Vite 代理（/oidc → Logto），
    // 避免浏览器对 http://localhost:3001 的跨域 fetch 因 CORS / CORP 被卡住（表现为一直转圈）。
    if (url.includes('/oidc/.well-known/openid-configuration')) {
      requestUrl = url.replace(/^https?:\/\/[^/]+/, window.location.origin)
      url = String(requestUrl)
    }
    const data = (await baseRequester(requestUrl, init)) as Record<string, any>
    if (url.includes('/oidc/.well-known/openid-configuration')) {
      const origin = window.location.origin
      const rewrite = (value?: string) =>
        value ? value.replace(/^https?:\/\/[^/]+/, origin) : value
      return {
        ...data,
        authorization_endpoint: rewrite(data.authorization_endpoint),
        token_endpoint: rewrite(data.token_endpoint),
        userinfo_endpoint: rewrite(data.userinfo_endpoint),
        end_session_endpoint: rewrite(data.end_session_endpoint),
        jwks_uri: rewrite(data.jwks_uri),
        issuer: rewrite(data.issuer)
      }
    }
    return data
  }
}

let embedSignInUrlPromise: Promise<string> | null = null

export async function createEmbedSignInUrl(): Promise<string> {
  if (embedSignInUrlPromise) {
    return embedSignInUrlPromise
  }

  embedSignInUrlPromise = (async () => {
    if (!logtoConfig.appId) {
      throw new Error('VITE_LOGTO_APP_ID 未配置，请检查 .env.development / .env.production')
    }
    let captured = ''
    const adapter: ClientAdapter = {
      requester: createSameOriginRequester(),
      // 与 main.ts createLogto 插件同款存储（BrowserStorage(appId)），保证会话共享
      storage: new BrowserStorage(logtoConfig.appId),
      // 不跳转顶层窗口：捕获授权 URL 供 iframe 使用
      navigate: (url) => {
        captured = url
      },
      generateState: embedGenerateState,
      generateCodeVerifier: embedGenerateCodeVerifier,
      generateCodeChallenge: embedGenerateCodeChallenge
    }
    const client = new BaseLogtoClient(logtoConfig, adapter)
    // 超时保护：discovery/网络异常时不要一直转圈，超时后走失败兜底
    const signInPromise = client.signIn(redirectUri)
    signInPromise.catch(() => {}) // 超时后晚到的 reject 不再冒泡
    await Promise.race([
      signInPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('生成 Logto 授权地址超时')), 8000)
      )
    ])
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
