/**
 * 认证 API（Logto OIDC + PostgREST）
 *
 * 认证方式：Logto OIDC 签发 JWT
 * - 登录：Logto SDK signIn() → 回调 handleSignInCallback()
 * - token 管理：Logto SDK getAccessToken()（内置 PKCE + 刷新）
 * - 后续请求：Authorization 头携带 Bearer token（PostgREST 从 JWT claims 提取用户）
 */
import { callRpc } from '@/utils/http/postgrest'

/** JIT 兜底建档（登录后确保 mirror/profile 存在，返回用户 id） */
export function fetchEnsureUser() {
  return callRpc<string>('ensure_user', {})
}

/** 获取当前登录用户信息（从 JWT claims 提取） */
export function fetchGetUserInfo() {
  return callRpc<Api.Auth.UserInfo>('get_current_user')
}

/** 获取当前用户 API 权限列表（casbin 语义：path/method） */
export function fetchGetUserPermissions() {
  return callRpc<Api.Auth.UserPermissions>('get_user_permissions')
}

/** 获取当前用户菜单树（后端扁平列表：{id,parent_id,name,path,meta}） */
export function fetchGetUserMenu() {
  return callRpc<Api.SystemManage.MenuTreeItem[]>('get_user_menu')
}

/** 同步当前用户角色镜像到 user_role 表（JIT 覆盖，幂等） */
export function fetchSyncUserRoles() {
  return callRpc<{ ok: boolean; user_id: string; roles: string[] }>('rpc_sync_user_roles', {})
}

/** 获取所有公开配置（前端初始化） */
export function fetchGetAllPublicConfigs() {
  return callRpc<Record<string, string>>('get_all_public_configs')
}
