/**
 * 系统管理 API
 * 对齐 OmniPG 后端（feature/logto-authn）api_v1_public schema 真实接口
 *
 * 约定：
 * - 视图查询：postgrest.getList / postgrest.getOne
 * - RPC 调用：callRpc('rpc名', { p_xxx: ... })（PostgREST POST /rpc/{name}）
 * - 写操作均走 SECURITY DEFINER RPC（has_permission 门槛），不经视图直接写
 * - Logto 镜像表（users/tenants/user_tenants/role/user_role）只读；写路径在 Logto Console
 */

import { postgrest, buildFilter, buildOrder, callRpc } from '@/utils/http/postgrest'

// ============================================================================
// 用户
// ============================================================================

/** 用户列表（v_user_list 视图，分页） */
export function fetchGetUserList(params: Api.SystemManage.UserSearchParams) {
  const { query, dept_id, status, offset = 0, limit = 20 } = params

  const filters: string[] = []
  if (query) {
    filters.push(buildFilter('username', 'ilike', `*${query}*`))
  }
  if (dept_id) {
    filters.push(buildFilter('dept_id', 'eq', dept_id))
  }
  if (status) {
    filters.push(buildFilter('is_active', 'eq', status === 'active'))
  }

  return postgrest.getList<Api.SystemManage.UserListItem>('/v_user_list', {
    offset,
    limit,
    filters: filters.filter(Boolean),
    order: buildOrder('created_at', 'desc')
  })
}

/** 用户分页搜索（search_users RPC，支持用户名/邮箱模糊 + 状态 + 部门） */
export function fetchSearchUsers(params: Api.SystemManage.UserSearchParams) {
  return callRpc<Api.Common.RpcPageResponse<Api.SystemManage.UserListItem>>('search_users', {
    p_query: params.query || null,
    p_status: params.status || null,
    p_dept_id: params.dept_id || null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0
  })
}

/** 用户-角色镜像列表（v_user_roles，Logto 分配镜像只读） */
export function fetchGetUserRolesView(params: {
  userId?: string
  limit?: number
  offset?: number
}) {
  const filters: string[] = []
  if (params.userId) {
    filters.push(buildFilter('user_id', 'eq', params.userId))
  }
  return postgrest.getList<Api.SystemManage.UserRoleItem>('/v_user_roles', {
    offset: params.offset ?? 0,
    limit: params.limit ?? 50,
    filters,
    order: buildOrder('assigned_at', 'desc')
  })
}

/** 同步当前用户角色镜像（JIT 覆盖；登录后调用一次） */
export function fetchSyncUserRoles() {
  return callRpc<{ ok: boolean; user_id: string; roles: string[] }>('rpc_sync_user_roles', {})
}

// ============================================================================
// 角色
// ============================================================================

/** 角色列表（v_role_list 视图，分页） */
export function fetchGetRoleList(params: Api.SystemManage.RoleSearchParams) {
  const { query, is_active, offset = 0, limit = 20 } = params

  const filters: string[] = []
  if (query) {
    filters.push(buildFilter('role_name', 'ilike', `*${query}*`))
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

/** 角色权限详情（get_role_permissions RPC，入参为 role_code） */
export function fetchGetRolePermissions(roleCode: string) {
  return callRpc<Api.SystemManage.RolePermissions>('get_role_permissions', {
    p_role_code: roleCode
  })
}

/** 角色→API 绑定（全量覆盖，sys:role-api:bind） */
export function fetchSetRoleApis(roleCode: string, apiCodes: string[]) {
  return callRpc<{ ok: boolean }>('rpc_set_role_apis', {
    p_role_code: roleCode,
    p_api_codes: apiCodes
  })
}

/** 角色→菜单绑定（全量覆盖，sys:role-menu:bind） */
export function fetchSetRoleMenus(roleCode: string, menuIds: string[]) {
  return callRpc<{ ok: boolean }>('rpc_set_role_menus', {
    p_role_code: roleCode,
    p_menu_ids: menuIds
  })
}

/** 角色-用户镜像（v_role_users，角色详情成员标签） */
export function fetchGetRoleUsersView(params: {
  roleCode?: string
  limit?: number
  offset?: number
}) {
  const filters: string[] = []
  if (params.roleCode) {
    filters.push(buildFilter('role_code', 'eq', params.roleCode))
  }
  return postgrest.getList<Api.SystemManage.RoleUserItem>('/v_role_users', {
    offset: params.offset ?? 0,
    limit: params.limit ?? 50,
    filters,
    order: buildOrder('role_code', 'asc')
  })
}

// ============================================================================
// 菜单 / API
// ============================================================================

/** 完整菜单树（管理用，get_menu_tree_admin RPC，扁平带 level） */
export function fetchGetMenuTree() {
  return callRpc<Api.SystemManage.MenuTreeItem[]>('get_menu_tree_admin')
}

/** 创建菜单（sys:menu:create） */
export function fetchCreateMenu(params: {
  p_menu_name: string
  p_parent_id?: string | null
  p_menu_type?: 'directory' | 'menu' | 'button'
  p_perms?: string | null
  p_path?: string | null
  p_component?: string | null
  p_icon?: string | null
  p_order_num?: number
}) {
  return callRpc<{ ok: boolean; id: string }>('rpc_create_menu', params)
}

/** 更新菜单（sys:menu:update） */
export function fetchUpdateMenu(params: {
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
  return callRpc<{ ok: boolean }>('rpc_update_menu', params)
}

/** 删除菜单（sys:menu:delete；有子菜单拒绝） */
export function fetchDeleteMenu(menuId: string) {
  return callRpc<{ ok: boolean }>('rpc_delete_menu', { p_id: menuId })
}

/** API 权限点列表（iam_api 视图） */
export function fetchGetApiList(params: { query?: string; limit?: number; offset?: number } = {}) {
  const filters: string[] = []
  if (params.query) {
    filters.push(buildFilter('name', 'ilike', `*${params.query}*`))
  }
  return postgrest.getList<Api.SystemManage.ApiItem>('/iam_api', {
    offset: params.offset ?? 0,
    limit: params.limit ?? 50,
    filters,
    order: buildOrder('path', 'asc')
  })
}

// ============================================================================
// 部门
// ============================================================================

/** 部门树（get_dept_tree RPC，扁平带 level/path） */
export function fetchGetDeptTree(tenantId?: string) {
  return callRpc<Api.SystemManage.DeptTreeItem[]>('get_dept_tree', {
    p_tenant_id: tenantId || null
  })
}

/** 部门列表视图（v_dept_list，含用户数） */
export function fetchGetDeptList(params: { limit?: number; offset?: number } = {}) {
  return postgrest.getList<Api.SystemManage.DeptTreeItem>('/v_dept_list', {
    offset: params.offset ?? 0,
    limit: params.limit ?? 100,
    order: buildOrder('sort_order', 'asc')
  })
}

/** 创建部门（sys:dept:create） */
export function fetchCreateDept(params: {
  p_dept_name: string
  p_parent_id?: string | null
  p_sort_order?: number
}) {
  return callRpc<{ ok: boolean; id: string }>('rpc_create_department', params)
}

/** 更新部门（sys:dept:update） */
export function fetchUpdateDept(params: {
  p_id: string
  p_parent_id?: string | null
  p_dept_name?: string | null
  p_sort_order?: number | null
  p_is_active?: boolean | null
}) {
  return callRpc<{ ok: boolean }>('rpc_update_department', params)
}

/** 删除部门（sys:dept:delete；有子部门/关联用户拒绝） */
export function fetchDeleteDept(deptId: string) {
  return callRpc<{ ok: boolean }>('rpc_delete_department', { p_id: deptId })
}

// ============================================================================
// 岗位
// ============================================================================

/** 岗位树（rpc_get_position_tree，sys:position:list） */
export function fetchGetPositionTree() {
  return callRpc<Api.SystemManage.PositionTreeItem[]>('rpc_get_position_tree')
}

/** 创建岗位（sys:position:create） */
export function fetchCreatePosition(params: {
  p_pos_name: string
  p_parent_id?: string | null
  p_pos_code?: string | null
  p_sort_no?: number
}) {
  return callRpc<{ ok: boolean; id: string }>('rpc_create_position', params)
}

/** 更新岗位（sys:position:update） */
export function fetchUpdatePosition(params: {
  p_id: string
  p_parent_id?: string | null
  p_pos_name?: string | null
  p_pos_code?: string | null
  p_sort_no?: number | null
  p_status?: boolean | null
}) {
  return callRpc<{ ok: boolean }>('rpc_update_position', params)
}

/** 删除岗位（sys:position:delete） */
export function fetchDeletePosition(positionId: string) {
  return callRpc<{ ok: boolean }>('rpc_delete_position', { p_id: positionId })
}

/** 用户岗位分配（全量覆盖，sys:position:assign） */
export function fetchAssignUserPositions(params: {
  p_user_id: string
  p_position_ids: string[]
  p_primary_position_id?: string | null
}) {
  return callRpc<{ ok: boolean }>('rpc_assign_user_positions', params)
}

// ============================================================================
// 字典
// ============================================================================

/** 字典类型+数据项聚合列表（v_dict_list） */
export function fetchGetDictList(params: { query?: string; limit?: number; offset?: number } = {}) {
  const filters: string[] = []
  if (params.query) {
    filters.push(buildFilter('dict_name', 'ilike', `*${params.query}*`))
  }
  return postgrest.getList<Api.SystemManage.DictTypeItem>('/v_dict_list', {
    offset: params.offset ?? 0,
    limit: params.limit ?? 50,
    filters,
    order: buildOrder('sort_no', 'asc')
  })
}

/** 字典类型创建（sys:dict:create；全局字典仅超管） */
export function fetchCreateDictType(params: {
  p_dict_name: string
  p_dict_label: string
  p_tenant_scoped?: boolean
  p_sort_no?: number
}) {
  return callRpc<{ ok: boolean; id: string }>('rpc_create_dict_type', params)
}

/** 字典类型更新（sys:dict:update） */
export function fetchUpdateDictType(params: {
  p_id: string
  p_dict_label?: string | null
  p_sort_no?: number | null
  p_status?: boolean | null
}) {
  return callRpc<{ ok: boolean }>('rpc_update_dict_type', params)
}

/** 字典类型删除（sys:dict:delete；级联清理数据项） */
export function fetchDeleteDictType(dictTypeId: string) {
  return callRpc<{ ok: boolean }>('rpc_delete_dict_type', { p_id: dictTypeId })
}

/** 字典数据项创建（sys:dict:create） */
export function fetchCreateDictData(params: {
  p_dict_name: string
  p_item_label: string
  p_item_value: string
  p_item_type?: string
  p_is_default?: boolean
  p_sort_no?: number
}) {
  return callRpc<{ ok: boolean; id: string }>('rpc_create_dict_data', params)
}

/** 字典数据项更新（sys:dict:update） */
export function fetchUpdateDictData(params: {
  p_id: string
  p_item_label?: string | null
  p_item_value?: string | null
  p_item_type?: string | null
  p_is_default?: boolean | null
  p_sort_no?: number | null
  p_status?: boolean | null
}) {
  return callRpc<{ ok: boolean }>('rpc_update_dict_data', params)
}

/** 字典数据项删除（sys:dict:delete） */
export function fetchDeleteDictData(dictDataId: string) {
  return callRpc<{ ok: boolean }>('rpc_delete_dict_data', { p_id: dictDataId })
}

// ============================================================================
// 租户
// ============================================================================

/** 租户列表（rpc_list_tenants，sys:tenant:list） */
export function fetchListTenants(params: { query?: string; limit?: number; offset?: number } = {}) {
  return callRpc<Api.Common.RpcPageResponse<Api.SystemManage.TenantListItem>>('rpc_list_tenants', {
    p_query: params.query || null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0
  })
}

/** 租户成员列表（rpc_list_tenant_members，sys:tenant-member:list） */
export function fetchListTenantMembers(
  params: { orgId?: string; query?: string; limit?: number; offset?: number } = {}
) {
  return callRpc<Api.Common.RpcPageResponse<Api.SystemManage.TenantMemberItem>>(
    'rpc_list_tenant_members',
    {
      p_org_id: params.orgId || null,
      p_query: params.query || null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0
    }
  )
}

// ============================================================================
// 登录日志
// ============================================================================

/** 登录日志分页查询（rpc_search_login_logs；需 sys:login-log:list 权限点） */
export function fetchSearchLoginLogs(
  params: {
    user_id?: string
    result?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  } = {}
) {
  return callRpc<Api.Common.RpcPageResponse<Api.SystemManage.LoginLogItem>>(
    'rpc_search_login_logs',
    {
      p_user_id: params.user_id || null,
      p_result: params.result || null,
      p_from: params.from || null,
      p_to: params.to || null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0
    }
  )
}

// ============================================================================
// 审计日志
// ============================================================================

/** 审计日志搜索（search_audit_log RPC） */
export function fetchSearchAuditLog(
  params: {
    query?: string
    table_name?: string
    operation?: string
    limit?: number
    offset?: number
  } = {}
) {
  return callRpc<Api.Common.RpcPageResponse<Api.SystemManage.AuditLogItem>>('search_audit_log', {
    p_query: params.query || null,
    p_table_name: params.table_name || null,
    p_operation: params.operation || null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0
  })
}

/** 审计时间线（get_audit_log_timeline RPC） */
export function fetchGetAuditLogTimeline(params: { start?: string; end?: string } = {}) {
  return callRpc<{
    start_date: string
    end_date: string
    items: Array<{
      log_date: string
      table_name: string
      operation: string
      change_count: number
      unique_users: number
    }>
  }>('get_audit_log_timeline', {
    p_start_date: params.start || null,
    p_end_date: params.end || null
  })
}

/** 审计日志列表（v_audit_log_detail 视图） */
export function fetchGetAuditLogList(
  params: { query?: string; limit?: number; offset?: number } = {}
) {
  const filters: string[] = []
  if (params.query) {
    filters.push(buildFilter('username', 'ilike', `*${params.query}*`))
  }
  return postgrest.getList<Api.SystemManage.AuditLogItem>('/v_audit_log_detail', {
    offset: params.offset ?? 0,
    limit: params.limit ?? 20,
    filters,
    order: buildOrder('created_at', 'desc')
  })
}

// ============================================================================
// 系统统计 / 监控
// ============================================================================

/** 系统统计（v_system_stats 单行） */
export async function fetchGetSystemStats() {
  const res = await postgrest.getList<Api.SystemManage.SystemStats>('/v_system_stats', {
    limit: 1
  })
  return res.data[0]
}

/** 实时统计（v_system_stats_realtime 单行） */
export async function fetchGetSystemStatsRealtime() {
  const res = await postgrest.getList<Api.SystemManage.SystemStatsRealtime>(
    '/v_system_stats_realtime',
    {
      limit: 1
    }
  )
  return res.data[0]
}

/** pg_cron 任务列表（超管） */
export function fetchListCronJobs() {
  return callRpc<Api.SystemManage.CronJobItem[]>('rpc_list_cron_jobs')
}

/** pg_cron 运行历史（超管） */
export function fetchListCronJobRuns(limit = 100) {
  return callRpc<Api.SystemManage.CronJobRunItem[]>('rpc_list_cron_job_runs', {
    p_limit: limit
  })
}

// ============================================================================
// 用户资料（user_profile）
// ============================================================================

/** 用户资料查询（本人/超管/本租户成员） */
export function fetchGetUserProfile(userId: string) {
  return callRpc<Api.SystemManage.UserProfile>('rpc_get_user_profile', {
    p_user_id: userId
  })
}

/** 用户资料更新（本人免权限点；管理他人需 sys:profile:update；动态列白名单） */
export function fetchUpdateUserProfile(userId: string, updates: Record<string, any>) {
  return callRpc<{ ok: boolean }>('rpc_update_user_profile', {
    p_user_id: userId,
    p_updates: updates
  })
}

// ============================================================================
// 配置
// ============================================================================

/** 更新系统配置（sys:config:write） */
export function fetchUpdateConfig(configKey: string, configValue: string) {
  return callRpc<boolean>('update_config', {
    p_config_key: configKey,
    p_config_value: configValue
  })
}

/** 获取全部公开配置 */
export function fetchGetAllPublicConfigs() {
  return callRpc<Record<string, string>>('get_all_public_configs')
}
