/**
 * 认证 API
 * 对接 OmniPG 后端 PostgREST 接口
 * 
 * 认证方式：Casdoor JWT
 * - 前端通过 Casdoor 登录获取 JWT token
 * - 后续请求通过 Authorization 头携带 token
 * - PostgREST 从 JWT claims 中提取用户信息
 */

import { callRpc } from '@/utils/http/postgrest'

/** 用户登录 */
export function fetchLogin(params: Api.Auth.LoginParams) {
  return callRpc<Api.Auth.LoginResponse>('user_login_sso', {
    p_username: params.username,
    p_password: params.password
  })
}

/** 获取当前登录用户信息（从 JWT claims 提取） */
export function fetchGetUserInfo() {
  return callRpc<Api.Auth.UserInfo>('get_current_user')
}

/** 刷新 token */
export function fetchRefreshToken() {
  return callRpc<{ token: string }>('refresh_token')
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
