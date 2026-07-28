/**
 * 系统管理 API
 * 对接 OmniPG 后端 PostgREST 接口
 */

import { postgrest, buildFilter, buildOrder } from '@/utils/http/postgrest'
import { callRpc } from '@/utils/http/postgrest'

/** 获取用户列表（分页） */
export function fetchGetUserList(params: Api.SystemManage.UserSearchParams) {
  const { query, dept_id, status, offset = 0, limit = 20 } = params

  const filters: string[] = []

  if (query) {
    filters.push(buildFilter('username', 'ilike', `*${query}*`))
    filters.push(buildFilter('email', 'ilike', `*${query}*`))
  }

  if (dept_id) {
    filters.push(buildFilter('dept_id', 'eq', dept_id))
  }

  if (status) {
    filters.push(buildFilter('is_active', 'eq', status === 'true'))
  }

  return postgrest.getList<Api.SystemManage.UserListItem>('/v_user_list', {
    offset,
    limit,
    filters: filters.filter(Boolean),
    order: buildOrder('created_at', 'desc')
  })
}

/** 创建用户 */
export function fetchCreateUser(params: Api.SystemManage.CreateUserParams) {
  return callRpc<Api.SystemManage.UserListItem>('create_user', params)
}

/** 更新用户状态 */
export function fetchUpdateUserStatus(userId: string, isActive: boolean) {
  return callRpc('update_user_status', {
    p_user_id: userId,
    p_is_active: isActive
  })
}

/** 分配角色给用户 */
export function fetchAssignRole(params: Api.SystemManage.AssignRoleParams) {
  return callRpc('assign_role_to_user', params)
}

/** 批量分配角色给用户 */
export function fetchBatchAssignRoles(params: Api.SystemManage.BatchAssignRolesParams) {
  return callRpc('batch_assign_roles', params)
}

/** 获取用户的角色列表 */
export function fetchGetUserRoles(userId: string) {
  return callRpc<Array<{ role_id: string; role_code: string; role_name: string }>>(
    'get_user_roles',
    {
      p_user_id: userId
    }
  )
}

/** 获取角色列表（分页） */
export function fetchGetRoleList(params: Api.SystemManage.RoleSearchParams) {
  const { query, is_active, offset = 0, limit = 20 } = params

  const filters: string[] = []

  if (query) {
    filters.push(buildFilter('role_name', 'ilike', `*${query}*`))
    filters.push(buildFilter('role_code', 'ilike', `*${query}*`))
  }

  if (is_active !== undefined) {
    filters.push(buildFilter('is_active', 'eq', is_active))
  }

  return postgrest.getList<Api.SystemManage.RoleListItem>('/v_role_list', {
    offset,
    limit,
    filters: filters.filter(Boolean),
    order: buildOrder('created_at', 'desc')
  })
}

/** 获取角色权限详情 */
export function fetchGetRolePermissions(roleId: string) {
  return callRpc<Api.SystemManage.RolePermissions>('get_role_permissions', {
    p_role_id: roleId
  })
}

/** 更新角色权限（菜单 + API） */
export function fetchUpdateRolePermissions(params: Api.SystemManage.UpdateRolePermissionsParams) {
  return callRpc('update_role_permissions', params)
}

/** 获取角色的用户列表 */
export function fetchGetRoleUsers(roleId: string) {
  return callRpc<Array<{ user_id: string; username: string; email: string }>>('get_role_users', {
    p_role_id: roleId
  })
}

/** 获取完整菜单树（管理用） */
export function fetchGetMenuTree() {
  return callRpc<Api.SystemManage.MenuTreeItem[]>('get_menu_tree_admin')
}

/** 获取部门树 */
export function fetchGetDeptTree(tenantId?: string) {
  return callRpc<Api.SystemManage.DeptTreeItem[]>('get_dept_tree', {
    p_tenant_id: tenantId
  })
}

/** 获取在线用户列表 */
export function fetchGetOnlineUsers(limit = 20, offset = 0) {
  return callRpc<Api.SystemManage.UserListItem[]>('get_online_users', {
    p_limit: limit,
    p_offset: offset
  })
}

/** 强制用户下线 */
export function fetchForceLogoutUser(userId: string) {
  return callRpc('force_logout_user', { p_user_id: userId })
}

/** 重置用户密码 */
export function fetchResetUserPassword(userId: string, newPassword: string) {
  return callRpc('reset_user_password', {
    p_user_id: userId,
    p_new_password: newPassword
  })
}

/** 获取用户会话列表 */
export function fetchGetUserSessions(userId: string) {
  return callRpc<Array<{ id: string; created_at: string; expires_at: string; is_active: boolean }>>(
    'get_user_sessions',
    {
      p_user_id: userId
    }
  )
}
