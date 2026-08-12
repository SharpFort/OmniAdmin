/**
 * useAuth - 页面级权限验证（docs/1.前端对齐后端方案-修订版.md §2.6）
 *
 * 职责边界：
 * - useAuth / v-auth：页面/菜单级可见性——基于当前路由 meta.authList（模板惯例），保留
 * - usePermission / v-perm：按钮/操作级权限——基于后端权限码（055 单表化：v_role_menu_detail.permission_code），新增
 * - 两者数据源不同（本地 authList vs 后端权限码），两层并存不互替
 *
 * 使用示例：
 * ```typescript
 * const { hasAuth } = useAuth()
 * if (hasAuth('edit')) { ... }
 * ```
 *
 * @module useAuth
 * @author Art Design Pro Team
 */

import { useRoute } from 'vue-router'
import type { AppRouteRecord } from '@/types/router'

type AuthItem = NonNullable<AppRouteRecord['meta']['authList']>[number]

export const useAuth = () => {
  const route = useRoute()

  // 当前路由 meta 配置的权限列表（例如：[{ authMark: 'add' }]）
  const authList: AuthItem[] = Array.isArray(route.meta.authList)
    ? (route.meta.authList as AuthItem[])
    : []

  /**
   * 检查是否拥有某权限标识（页面级，基于 route.meta.authList）
   * @param auth 权限标识
   * @returns 是否有权限
   */
  const hasAuth = (auth: string): boolean => {
    return authList.some((item) => item?.authMark === auth)
  }

  return {
    hasAuth
  }
}
