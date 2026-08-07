/**
 * usePermission — 按钮级权限 composable（docs/1.前端对齐后端方案-修订版.md §2.6）
 *
 * 职责：
 * - hasPerm(code)：判断当前用户是否具备后端权限点（v_role_api_detail.api_code）
 * - 超管短路：仅 'role_super_admin'（v1.5 收窄——admin/super_admin 是 Casdoor 残留，
 *   后端 is_super_admin 035 重建后也只认 role_super_admin）
 * - 模块级内存缓存（Set<string>，按用户 id 隔离）：首次 hasPerm 拉取，
 *   同用户会话内不重复请求；切换账号（userId 变化）自动重拉（B-5）
 * - 空缓存降级：v_role_api_detail 依赖 role 镜像同步——若 Logto 角色未同步，
 *   绑定不显示 → hasPerm false → 按钮全隐藏（不阻断页面渲染）；超管短路不受影响
 *
 * 与 v-auth 职责边界：v-auth = 页面级（route.meta.authList）；v-perm = 按钮级（后端权限码）
 */
import { useUserStore } from '@/store/modules/user'
import { getView } from '@/api/request'

/** 超管角色（后端 init/02-schemas.sql / 035 is_super_admin 重建定义） */
export const SUPER_ADMIN_ROLE = 'role_super_admin'

/** 模块级缓存（单例）——按用户 id 隔离 */
let cachedUserId: string | null = null
let cachedPermissions: Set<string> | null = null
let loadingPromise: Promise<Set<string>> | null = null

/** 是否超管（短路判断） */
export function isSuperAdmin(roles?: string[]): boolean {
  return Array.isArray(roles) && roles.includes(SUPER_ADMIN_ROLE)
}

/** 拉取权限码集合（v_role_api_detail：role_code ∈ 当前用户 roles 的 api_code） */
async function fetchPermissionCodes(): Promise<Set<string>> {
  const userStore = useUserStore()
  const userId = userStore.info?.id || ''
  const roles = userStore.info?.roles || []

  if (isSuperAdmin(roles)) {
    cachedUserId = userId
    cachedPermissions = new Set(['*'])
    return cachedPermissions
  }

  const codes = new Set<string>()
  if (roles.length > 0) {
    try {
      // ⚠️ v_role_api_detail 依赖 role 镜像同步（INNER JOIN role）——未同步时返回空
      const filters: Record<string, string> = {
        role_code: `in.(${roles.join(',')})`
      }
      const rows = await getView<Api.SystemManage.RoleApiPerm>('v_role_api_detail', {
        filters,
        limit: 1000
      })
      rows.forEach((row) => {
        if (row.api_code) codes.add(row.api_code)
      })
    } catch (error) {
      console.warn('[usePermission] 拉取权限码失败（按钮将隐藏）:', error)
    }
  }

  cachedUserId = userId
  cachedPermissions = codes
  return codes
}

/** 获取当前用户权限码集合（缓存命中返回，否则拉取） */
async function getPermissionCodes(): Promise<Set<string>> {
  const userStore = useUserStore()
  const userId = userStore.info?.id || ''
  if (cachedPermissions && cachedUserId === userId) {
    return cachedPermissions
  }
  if (!loadingPromise) {
    loadingPromise = fetchPermissionCodes().finally(() => {
      loadingPromise = null
    })
  }
  return loadingPromise
}

/** 清空缓存（登出时调用；也可主动触发重拉） */
export function clearPermissionCache(): void {
  cachedUserId = null
  cachedPermissions = null
  loadingPromise = null
}

export const usePermission = () => {
  const userStore = useUserStore()

  /**
   * 判断当前用户是否具备权限点
   * @param code 后端权限码（如 'sys:dept:create'）；'*' 恒真（超管）
   */
  const hasPerm = async (code: string): Promise<boolean> => {
    if (isSuperAdmin(userStore.info?.roles)) return true
    if (code === '*') return false
    const codes = await getPermissionCodes()
    return codes.has(code)
  }

  return {
    hasPerm,
    /** 清空模块级缓存（登出/切换账号） */
    clear: clearPermissionCache
  }
}

export default usePermission
