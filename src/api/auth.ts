/**
 * 认证 API（Phase 3: Logto OIDC SDK 替代 Casdoor PKCE）
 *
 * 认证方式：Logto OIDC 签发 JWT
 * - 登录：Logto SDK signIn() → 回调 handleSignInCallback()
 * - token 管理：Logto SDK getAccessToken()（内置 PKCE + 刷新）
 * - 后续请求：Authorization 头携带 Bearer token（PostgREST 从 JWT claims 提取用户）
 */
import { callRpc } from '@/utils/http/postgrest'

/** JIT 兜底建档（D2: 登录后确保 mirror/profile 存在，返回用户 UUID） */
export function fetchEnsureUser() {
  return callRpc<string>('ensure_user', {})
}

/** 获取当前登录用户信息（从 JWT claims 提取） */
export function fetchGetUserInfo() {
  return callRpc<Api.Auth.UserInfo>('get_current_user')
}

/** 用户登出（将 JWT jti 加入黑名单） */
export function fetchLogout() {
  return callRpc('logout')
}

/** 获取当前用户菜单树 */
export function fetchGetUserMenu() {
  return callRpc<Api.SystemManage.MenuTreeItem[]>('get_user_menu')
}

/** 获取当前用户 API 权限列表 */
export function fetchGetUserPermissions() {
  return callRpc<string[]>('get_user_permissions')
}
