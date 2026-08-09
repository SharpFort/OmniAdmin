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
import { toIsoLocal } from '@/utils/date'

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

/** 用户-角色镜像（v_user_roles；⚠️ LEFT JOIN role_code 可为 null——默认过滤未分配行；仅超管完整） */
export function getUserRoles(
  params: {
    userId?: string
    query?: string
    limit?: number
    offset?: number
    /** 是否包含未分配角色的行（role_code=null；默认 false，弹窗/列表均只需已分配行） */
    includeUnassigned?: boolean
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.userId) filters['user_id'] = `eq.${params.userId}`
  if (params.query) filters['username'] = `ilike.*${params.query}*`
  // 默认排除 LEFT JOIN 空行，保证分页总数与行数一致
  if (!params.includeUnassigned) filters['role_code'] = 'not.is.null'
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

/** 创建菜单（rpc_create_menu 16 参；sys:menu:create；038 签名：+remark/route_name/query/is_link/is_iframe/redirect/keep_alive；
 * ⚠️ p_menu_type 传 'link' 时后端自动置 is_link=true；044 参数改名 p_perms→p_api_code/p_path→p_router */
export function createMenu(params: {
  p_menu_name: string
  p_parent_id?: string | null
  p_menu_type?: 'directory' | 'menu' | 'button' | 'link'
  p_api_code?: string | null
  p_router?: string | null
  p_component?: string | null
  p_icon?: string | null
  p_order_num?: number
  p_is_visible?: boolean
  p_remark?: string | null
  p_route_name?: string | null
  p_query?: string | null
  p_is_link?: boolean | null
  p_is_iframe?: boolean | null
  p_redirect?: string | null
  p_keep_alive?: boolean | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_create_menu', {
    p_menu_name: params.p_menu_name,
    p_parent_id: params.p_parent_id ?? null,
    p_menu_type: params.p_menu_type ?? 'menu',
    p_api_code: params.p_api_code ?? null,
    p_router: params.p_router ?? null,
    p_component: params.p_component ?? null,
    p_icon: params.p_icon ?? null,
    p_order_num: params.p_order_num ?? 0,
    p_is_visible: params.p_is_visible ?? true,
    p_remark: params.p_remark ?? null,
    p_route_name: params.p_route_name ?? null,
    p_query: params.p_query ?? null,
    p_is_link: params.p_is_link ?? null,
    p_is_iframe: params.p_is_iframe ?? null,
    p_redirect: params.p_redirect ?? null,
    p_keep_alive: params.p_keep_alive ?? null
  })
}

/** 菜单-接口批量绑定/解绑（rpc_set_menu_apis；046：全量对齐选中集合——选中绑定、未选解绑回池；
 * 🔐 sys:menu:update；事务原子） */
export function setMenuApis(params: { p_menu_id: string; p_api_ids: string[] }) {
  return postRpc<Api.Common.ApiOk>('rpc_set_menu_apis', {
    p_menu_id: params.p_menu_id,
    p_api_ids: params.p_api_ids
  })
}

/** 更新菜单（rpc_update_menu 18 参；sys:menu:update；038 签名：+remark/route_name/query/is_link/is_iframe/redirect/keep_alive；
 * ⚠️ 改离 link 需显式传 p_is_link=false；044 参数改名 p_perms→p_api_code/p_path→p_router */
export function updateMenu(params: {
  p_id: string
  p_parent_id?: string | null
  p_menu_name?: string | null
  p_menu_type?: string | null
  p_api_code?: string | null
  p_router?: string | null
  p_component?: string | null
  p_icon?: string | null
  p_order_num?: number | null
  p_is_active?: boolean | null
  p_is_visible?: boolean | null
  p_remark?: string | null
  p_route_name?: string | null
  p_query?: string | null
  p_is_link?: boolean | null
  p_is_iframe?: boolean | null
  p_redirect?: string | null
  p_keep_alive?: boolean | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_update_menu', {
    p_id: params.p_id,
    p_parent_id: params.p_parent_id ?? null,
    p_menu_name: params.p_menu_name ?? null,
    p_menu_type: params.p_menu_type ?? null,
    p_api_code: params.p_api_code ?? null,
    p_router: params.p_router ?? null,
    p_component: params.p_component ?? null,
    p_icon: params.p_icon ?? null,
    p_order_num: params.p_order_num ?? null,
    p_is_active: params.p_is_active ?? null,
    p_is_visible: params.p_is_visible ?? null,
    p_remark: params.p_remark ?? null,
    p_route_name: params.p_route_name ?? null,
    p_query: params.p_query ?? null,
    p_is_link: params.p_is_link ?? null,
    p_is_iframe: params.p_is_iframe ?? null,
    p_redirect: params.p_redirect ?? null,
    p_keep_alive: params.p_keep_alive ?? null
  })
}

/** 删除菜单（rpc_delete_menu；sys:menu:delete；有子菜单拒绝） */
export function deleteMenu(menuId: string) {
  return postRpc<Api.Common.ApiOk>('rpc_delete_menu', { p_id: menuId })
}

/** API 权限点列表（iam_api 视图，分页；039 起含 api_group/menu_id 分组归属） */
export function getApiList(
  params: {
    query?: string
    apiGroup?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['name'] = `ilike.*${params.query}*`
  if (params.apiGroup) filters['api_group'] = `eq.${params.apiGroup}`
  return getViewPage<Api.SystemManage.ApiAdminNode>('iam_api', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'api_group.asc,path.asc',
    filters
  })
}

/** 创建 API 权限点（rpc_create_api；🔐 sys:api:create；path+method 重复/api_code 重复拒绝 22023；
 * p_api_group 留空且选了归属菜单时后端自动取 menu_name） */
export function createApi(params: {
  p_path: string
  p_method: string
  p_name: string
  p_api_code?: string | null
  p_description?: string | null
  p_is_active?: boolean
  p_menu_id?: string | null
  p_api_group?: string | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_create_api', {
    p_path: params.p_path,
    p_method: params.p_method,
    p_name: params.p_name,
    p_api_code: params.p_api_code ?? null,
    p_description: params.p_description ?? null,
    p_is_active: params.p_is_active ?? true,
    p_menu_id: params.p_menu_id ?? null,
    p_api_group: params.p_api_group ?? null
  })
}

/** 更新 API 权限点（rpc_update_api；🔐 sys:api:update；NULL=不改，文本传 '' 清空，
 * p_menu_id 传零 uuid 哨兵取消归属） */
export function updateApi(params: {
  p_id: string
  p_path?: string | null
  p_method?: string | null
  p_name?: string | null
  p_api_code?: string | null
  p_description?: string | null
  p_is_active?: boolean | null
  p_menu_id?: string | null
  p_api_group?: string | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_update_api', {
    p_id: params.p_id,
    p_path: params.p_path ?? null,
    p_method: params.p_method ?? null,
    p_name: params.p_name ?? null,
    p_api_code: params.p_api_code ?? null,
    p_description: params.p_description ?? null,
    p_is_active: params.p_is_active ?? null,
    p_menu_id: params.p_menu_id ?? null,
    p_api_group: params.p_api_group ?? null
  })
}

/** 删除 API 权限点（rpc_delete_api；🔐 sys:api:delete；有角色绑定 → 23503 需先解绑） */
export function deleteApi(apiId: string) {
  return postRpc<Api.Common.ApiOk>('rpc_delete_api', { p_id: apiId })
}

// ============================================================================
// 角色数据范围 / 菜单子树 API 一键授权（041/042）
// ============================================================================

/** 角色数据范围查询（rpc_get_role_data_scope；🔐 sys:data-scope:bind） */
export function getRoleDataScope(roleCode: string) {
  return postRpc<Api.SystemManage.RoleDataScope>('rpc_get_role_data_scope', {
    p_role_code: roleCode
  })
}

/** 角色数据范围设置（rpc_set_role_data_scope；全量覆盖；custom 时 p_dept_ids 必填） */
export function setRoleDataScope(
  roleCode: string,
  scopeType: Api.SystemManage.RoleDataScope['scope_type'],
  deptIds?: string[]
) {
  return postRpc<Api.Common.ApiOk>('rpc_set_role_data_scope', {
    p_role_code: roleCode,
    p_scope_type: scopeType,
    p_dept_ids: deptIds ?? null
  })
}

/** 一键授权：授予角色「菜单及全部子孙菜单归属的 API」增量（rpc_grant_menu_subtree_apis；🔐 sys:role-api:bind） */
export function grantMenuSubtreeApis(roleCode: string, menuId: string) {
  return postRpc<{ ok: boolean; granted: number; total: number }>('rpc_grant_menu_subtree_apis', {
    p_role_code: roleCode,
    p_menu_id: menuId
  })
}

/** 一键撤销（对称；前端取消勾选场景） */
export function revokeMenuSubtreeApis(roleCode: string, menuId: string) {
  return postRpc<{ ok: boolean; removed: number }>('rpc_revoke_menu_subtree_apis', {
    p_role_code: roleCode,
    p_menu_id: menuId
  })
}

// ============================================================================
// 部门
// ============================================================================

/** 部门树（get_dept_tree；扁平带 level/path；⚠️ 省略 p_tenant_id 参数——
 * 显式传 null 触发 PGRST203 重载歧义（api_v1_public text 版 + 015 残留 uuid 版）） */
export function getDeptTree(tenantId?: string | null) {
  const body: Record<string, unknown> = {}
  if (tenantId) {
    body['p_tenant_id'] = tenantId
  }
  return postRpc<Api.SystemManage.DeptNode[]>('get_dept_tree', body)
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

/** 用户-岗位关联列表（user_position 视图，分页；⚠️ 仅 ID 列，展示名需前端 join） */
export function getUserPositions(params: { limit?: number; offset?: number } = {}) {
  return getViewPage<Api.SystemManage.UserPositionRow>('user_position', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters: {}
  })
}

// ============================================================================
// 登录日志
// ============================================================================

/** 登录日志分页查询（rpc_search_login_logs；🔐 sys:login-log:list 仅超管绑定；
 * 无关键词搜索——p_user_id 精确匹配 + 结果 + 登录方式/地区模糊 + 时间范围；上限 100）
 * 时间约定与审计日志一致：from/to 本地时间，date-only 结束日补 23:59:59（左闭右闭） */
export function searchLoginLogs(
  params: {
    user_id?: string | null
    result?: string | null
    login_type?: string | null
    region?: string | null
    from?: string | null
    to?: string | null
    limit?: number
    offset?: number
  } = {}
) {
  return postRpc<Api.Common.PageResult<Api.SystemManage.LoginLog>>('rpc_search_login_logs', {
    p_user_id: params.user_id ?? null,
    p_result: params.result ?? null,
    p_login_type: params.login_type ?? null,
    p_region: params.region ?? null,
    p_from: toIsoLocal(params.from),
    p_to: toIsoLocal(params.to, true),
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0
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

/** 管理端配置列表（config_admin 视图，分页；含 description 等管理字段；页面仅超管） */
export function getConfigAdminList(
  params: {
    query?: string
    isPublic?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['config_key'] = `ilike.*${params.query}*`
  if (typeof params.isPublic === 'boolean') filters['is_public'] = `eq.${params.isPublic}`
  return getViewPage<Api.SystemManage.AppConfigRow>('config_admin', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'config_key.asc',
    filters
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
