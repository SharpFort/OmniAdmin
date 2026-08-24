/**
 * 认证 API（docs/1.前端对齐后端方案-修订版.md §2.2）
 *
 * 认证方式：Logto OIDC 全托管
 * - 登录/注册/忘记密码/登出：Logto SDK（config/logto.ts）——前端不实现任何认证表单
 * - token 管理：Logto SDK getAccessToken()（内置 PKCE + 静默刷新）
 * - 本模块仅保留 PostgREST 侧数据接口：
 *   ensureUser（D25/D27：JIT 仅兜底 user_profile，组织归属取 claims organization_id；角色分配由 Logto 权威）
 *   getCurrentUser（userStore 数据源）、getAllPublicConfigs / getConfig（登录初始化）
 */
import { postRpc } from './request'

/** JIT 兜底建档（登录回调后调用；返回 sub；仅兜底 user_profile，角色分配为 Logto 权威） */
export function ensureUser() {
  return postRpc<string>('ensure_user', {})
}

/** 获取当前登录用户信息（含 roles，来自 JWT claims） */
export function getCurrentUser() {
  return postRpc<Api.Auth.UserInfo>('get_current_user', {})
}

/** 获取全部公开配置（登录初始化） */
export function getAllPublicConfigs() {
  return postRpc<Record<string, string>>('get_all_public_configs', {})
}

/** 获取单个公开配置 */
export function getConfig(configKey: string) {
  return postRpc<{
    config_key: string
    config_value: string
    config_type: string
  } | null>('get_config', { p_config_key: configKey })
}

// ============================================================================
// 兼容层（@deprecated —— Phase 3 回调/守卫迁移后移除）
// ============================================================================

/** @deprecated 使用 ensureUser */
export const fetchEnsureUser = ensureUser

/** @deprecated 使用 getCurrentUser */
export const fetchGetUserInfo = getCurrentUser
