/**
 * 系统管理 API（docs/1.前端对齐后端方案-修订版.md §2.2 / §1.2）
 *
 * 约定：
 * - 视图查询：getView / getViewPage（GET /api_v1_public/{view}）
 * - RPC 调用：postRpc（POST /rpc/{name}，参数 p_xxx 命名与后端签名逐一核实）
 * - 写操作均走 SECURITY DEFINER RPC（权限点门槛），不经视图直接写
 * - Logto 镜像表（users/tenants/user_tenants/role/user_role）只读；写路径在 Logto Console
 * - 分页：搜索类 RPC 自带 p_limit/p_offset（后端上限 100）；视图用 getViewPage（Content-Range）
 */
import { postRpc, getViewPage } from './request'

// ============================================================================
// 用户
// ============================================================================

/** 用户分页搜索（search_users RPC，用户名/邮箱模糊 + 状态三态 + 部门） */
export function searchUsers(params: {
  p_query?: string | null
  p_status?: boolean | null
  p_dept_id?: string | null
  p_limit?: number
  p_offset?: number
}) {
  return postRpc<Api.Common.PageResult<Api.Auth.UserListItem>>('search_users', {
    p_query: params.p_query ?? null,
    p_status: params.p_status ?? null,
    p_dept_id: params.p_dept_id ?? null,
    p_limit: params.p_limit ?? 20,
    p_offset: params.p_offset ?? 0
  })
}

/** 用户列表（v_user_list 视图，分页） */
export function getUserList(
  params: {
    query?: string
    dept_id?: string
    is_active?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['username'] = `ilike.*${params.query}*`
  if (params.dept_id) filters['dept_id'] = `eq.${params.dept_id}`
  if (typeof params.is_active === 'boolean') filters['is_active'] = `eq.${params.is_active}`
  return getViewPage<Api.Auth.UserListItem>('v_user_list', {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** 用户-角色镜像（v_user_roles；⚠️ LEFT JOIN role_code 可为 null，前端过滤） */
export function getUserRoles(
  params: {
    userId?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.userId) filters['user_id'] = `eq.${params.userId}`
  return getViewPage<Api.Auth.UserRoleRow>('v_user_roles', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    filters
  })
}

/** 用户资料查询（rpc_get_user_profile；本人/超管/本租户成员） */
export function getUserProfile(userId: string) {
  return postRpc<Api.Auth.UserProfile>('rpc_get_user_profile', { p_user_id: userId })
}

/** 用户资料更新（rpc_update_user_profile；本人免权限点，管理他人需 sys:profile:update） */
export function updateUserProfile(userId: string, updates: Record<string, unknown>) {
  return postRpc<Api.Common.ApiOk>('rpc_update_user_profile', {
    p_user_id: userId,
    p_updates: updates
  })
}

// ============================================================================
// 角色
// ============================================================================

/** 角色列表（v_role_list 视图，分页；users_count 仅超管统计准确） */
export function getRoleList(
  params: {
    query?: string
    is_active?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['role_name'] = `ilike.*${params.query}*`
  if (typeof params.is_active === 'boolean') filters['is_active'] = `eq.${params.is_active}`
  return getViewPage<Api.SystemManage.RoleListItem>('v_role_list', {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** 角色-用户镜像（v_role_users；⚠️ LEFT JOIN user_id 可为 null） */
export function getRoleUsers(
  params: {
    roleCode?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.roleCode) filters['role_code'] = `eq.${params.roleCode}`
  return getViewPage<Api.SystemManage.RoleUserItem>('v_role_users', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    filters
  })
}

/** 角色权限详情（get_role_permissions RPC；⚠️ 入参为 p_role_code） */
export function getRolePermissions(roleCode: string) {
  return postRpc<Api.SystemManage.RolePermissionDetail>('get_role_permissions', {
    p_role_code: roleCode
  })
}

/** 角色→API 绑定（rpc_set_role_apis；全量覆盖，sys:role-api:bind；数组参数） */
export function setRoleApis(roleCode: string, apiCodes: string[]) {
  return postRpc<Api.Common.ApiOk>('rpc_set_role_apis', {
    p_role_code: roleCode,
    p_api_codes: apiCodes
  })
}

/** 角色→菜单绑定（rpc_set_role_menus；全量覆盖，sys:role-menu:bind；数组参数） */
export function setRoleMenus(roleCode: string, menuIds: string[]) {
  return postRpc<Api.Common.ApiOk>('rpc_set_role_menus', {
    p_role_code: roleCode,
    p_menu_ids: menuIds
  })
}

// ============================================================================
// 菜单 / API
// ============================================================================

/** 当前用户菜单树（get_user_menu；扁平列表含 menu_type/perms/is_visible/component；backend 模式数据源） */
export function getUserMenu() {
  return postRpc<Api.Menu.MenuRouteItem[]>('get_user_menu', {})
}

/** 完整菜单树（get_menu_tree_admin；⚠️ 仅只读概览，无 menu_type/perms/component——编辑回显用 iam_menu 视图） */
export function getMenuTreeAdmin() {
  return postRpc<Api.SystemManage.MenuTreeItem[]>('get_menu_tree_admin', {})
}

/** 菜单列表（iam_menu 视图全列，分页；菜单管理页数据源 + 前端组树） */
export function getMenuList(
  params: {
    query?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['menu_name'] = `ilike.*${params.query}*`
  return getViewPage<Api.Menu.MenuAdminNode>('iam_menu', {
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
    order: 'order_num.asc',
    filters
  })
}

/** 创建菜单（rpc_create_menu；sys:menu:create；035 起含 p_is_visible） */
export function createMenu(params: {
  p_menu_name: string
  p_parent_id?: string | null
  p_menu_type?: 'directory' | 'menu' | 'button'
  p_perms?: string | null
  p_path?: string | null
  p_component?: string | null
  p_icon?: string | null
  p_order_num?: number
  p_is_visible?: boolean
}) {
  return postRpc<Api.Common.ApiOk>('rpc_create_menu', {
    p_menu_name: params.p_menu_name,
    p_parent_id: params.p_parent_id ?? null,
    p_menu_type: params.p_menu_type ?? 'menu',
    p_perms: params.p_perms ?? null,
    p_path: params.p_path ?? null,
    p_component: params.p_component ?? null,
    p_icon: params.p_icon ?? null,
    p_order_num: params.p_order_num ?? 0,
    p_is_visible: params.p_is_visible ?? true
  })
}

/** 更新菜单（rpc_update_menu；sys:menu:update） */
export function updateMenu(params: {
  p_id: string
  p_parent_id?: string | null
  p_menu_name?: string | null
  p_menu_type?: string | null
  p_perms?: string | null
  p_path?: string | null
  p_component?: string | null
  p_icon?: string | null
  p_order_num?: number | null
  p_is_active?: boolean | null
  p_is_visible?: boolean | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_update_menu', {
    p_id: params.p_id,
    p_parent_id: params.p_parent_id ?? null,
    p_menu_name: params.p_menu_name ?? null,
    p_menu_type: params.p_menu_type ?? null,
    p_perms: params.p_perms ?? null,
    p_path: params.p_path ?? null,
    p_component: params.p_component ?? null,
    p_icon: params.p_icon ?? null,
    p_order_num: params.p_order_num ?? null,
    p_is_active: params.p_is_active ?? null,
    p_is_visible: params.p_is_visible ?? null
  })
}

/** 删除菜单（rpc_delete_menu；sys:menu:delete；有子菜单拒绝） */
export function deleteMenu(menuId: string) {
  return postRpc<Api.Common.ApiOk>('rpc_delete_menu', { p_id: menuId })
}

/** API 权限点列表（iam_api 视图，分页） */
export function getApiList(
  params: {
    query?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['name'] = `ilike.*${params.query}*`
  return getViewPage<Api.SystemManage.ApiItem>('iam_api', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'path.asc',
    filters
  })
}

// ============================================================================
// 部门
// ============================================================================

/** 部门树（get_dept_tree；扁平带 level/path；⚠️ 035 参数 text，可传 null） */
export function getDeptTree(tenantId?: string | null) {
  return postRpc<Api.SystemManage.DeptNode[]>('get_dept_tree', {
    p_tenant_id: tenantId ?? null
  })
}

/** 部门列表（v_dept_list 视图，含用户数） */
export function getDeptList(params: { limit?: number; offset?: number } = {}) {
  return getViewPage<Api.SystemManage.DeptTreeItem>('v_dept_list', {
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
    order: 'sort_order.asc'
  })
}

/** 创建部门（rpc_create_department；sys:dept:create） */
export function createDept(params: {
  p_dept_name: string
  p_parent_id?: string | null
  p_sort_order?: number
}) {
  return postRpc<Api.Common.ApiOk>('rpc_create_department', {
    p_dept_name: params.p_dept_name,
    p_parent_id: params.p_parent_id ?? null,
    p_sort_order: params.p_sort_order ?? 0
  })
}

/** 更新部门（rpc_update_department；sys:dept:update） */
export function updateDept(params: {
  p_id: string
  p_parent_id?: string | null
  p_dept_name?: string | null
  p_sort_order?: number | null
  p_is_active?: boolean | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_update_department', {
    p_id: params.p_id,
    p_parent_id: params.p_parent_id ?? null,
    p_dept_name: params.p_dept_name ?? null,
    p_sort_order: params.p_sort_order ?? null,
    p_is_active: params.p_is_active ?? null
  })
}

/** 删除部门（rpc_delete_department；sys:dept:delete；有子部门/关联用户拒绝） */
export function deleteDept(deptId: string) {
  return postRpc<Api.Common.ApiOk>('rpc_delete_department', { p_id: deptId })
}

// ============================================================================
// 岗位
// ============================================================================

/** 岗位树（rpc_get_position_tree；扁平带 depth/path_name；sys:position:list） */
export function getPositionTree() {
  return postRpc<Api.SystemManage.PositionNode[]>('rpc_get_position_tree', {})
}

/** 创建岗位（rpc_create_position；sys:position:create） */
export function createPosition(params: {
  p_pos_name: string
  p_parent_id?: string | null
  p_pos_code?: string | null
  p_sort_no?: number
}) {
  return postRpc<Api.Common.ApiOk>('rpc_create_position', {
    p_pos_name: params.p_pos_name,
    p_parent_id: params.p_parent_id ?? null,
    p_pos_code: params.p_pos_code ?? null,
    p_sort_no: params.p_sort_no ?? 0
  })
}

/** 更新岗位（rpc_update_position；sys:position:update） */
export function updatePosition(params: {
  p_id: string
  p_parent_id?: string | null
  p_pos_name?: string | null
  p_pos_code?: string | null
  p_sort_no?: number | null
  p_status?: boolean | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_update_position', {
    p_id: params.p_id,
    p_parent_id: params.p_parent_id ?? null,
    p_pos_name: params.p_pos_name ?? null,
    p_pos_code: params.p_pos_code ?? null,
    p_sort_no: params.p_sort_no ?? null,
    p_status: params.p_status ?? null
  })
}

/** 删除岗位（rpc_delete_position；sys:position:delete） */
export function deletePosition(positionId: string) {
  return postRpc<Api.Common.ApiOk>('rpc_delete_position', { p_id: positionId })
}

/** 用户岗位分配（rpc_assign_user_positions；全量覆盖，sys:position:assign；数组参数） */
export function assignUserPositions(params: {
  p_user_id: string
  p_position_ids: string[]
  p_primary_position_id?: string | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_assign_user_positions', {
    p_user_id: params.p_user_id,
    p_position_ids: params.p_position_ids,
    p_primary_position_id: params.p_primary_position_id ?? null
  })
}

// ============================================================================
// 配置
// ============================================================================

/** 更新系统配置（update_config；🔐 sys:config:write） */
export function updateConfig(configKey: string, configValue: string) {
  return postRpc<boolean>('update_config', {
    p_config_key: configKey,
    p_config_value: configValue
  })
}

/** 管理端配置列表（config_admin 视图，分页；含 description 等管理字段） */
export function getConfigAdminList(params: { limit?: number; offset?: number } = {}) {
  return getViewPage<{
    config_key: string
    config_value: string
    config_type: string
    description: string | null
    is_public: boolean
    updated_at: string | null
  }>('config_admin', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0
  })
}

// ============================================================================
// 兼容层（@deprecated —— Phase 5 页面迁移后移除）
// ============================================================================

/** @deprecated 使用 getMenuTreeAdmin */
export const fetchGetMenuTree = getMenuTreeAdmin

/** @deprecated 使用 getRolePermissions */
export const fetchGetRolePermissions = getRolePermissions

/**
 * @deprecated 使用 getUserList（usePostgrestTable 兼容适配：
 * 返回 PostgrestListResult 形状 {data,total,offset,limit}）
 */
export async function fetchGetUserList(
  params: {
    query?: string
    dept_id?: string
    status?: 'active' | 'inactive' | ''
    offset?: number
    limit?: number
    filters?: string[]
    order?: string
  } = {}
) {
  const result = await getUserList({
    query: params.query,
    dept_id: params.dept_id,
    is_active: params.status === 'active' ? true : params.status === 'inactive' ? false : undefined,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0
  })
  return { data: result.items, total: result.total, offset: result.offset, limit: result.limit }
}

/**
 * @deprecated 使用 getRoleList（usePostgrestTable 兼容适配）
 */
export async function fetchGetRoleList(
  params: {
    query?: string
    is_active?: boolean
    offset?: number
    limit?: number
    filters?: string[]
    order?: string
  } = {}
) {
  const result = await getRoleList({
    query: params.query,
    is_active: params.is_active,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0
  })
  return { data: result.items, total: result.total, offset: result.offset, limit: result.limit }
}
