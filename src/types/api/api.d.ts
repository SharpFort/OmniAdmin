/**
 * OmniAdmin API 类型定义（对齐 OmniPG 后端 refactor/schema-platform-logto-public / api_v1_platform）
 *
 * 规范（docs/1.前端对齐后端方案-修订版.md §2.3，v1.4 定稿）：
 * - 命名风格 = snake_case 透传（零转换层）：字段与后端 PostgREST 返回一一对应
 * - 时间字段约定 string（ISO 8601，展示时格式化）
 * - 所有 `*_id` 关联字段均可能为 null（超管无组织/未分配部门）
 */
declare namespace Api {
  /** 通用类型（§2.3 统一泛型） */
  namespace Common {
    /** 分页参数（模板 useTable 兼容，页面 current/size 语义） */
    interface PaginationParams {
      /** 当前页码 */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }

    /** 通用搜索参数 */
    type CommonSearchParams = Pick<PaginationParams, 'current' | 'size'>

    /** 分页响应基础结构（模板 useTable 兼容） */
    interface PaginatedResponse<T = any> {
      records: T[]
      current: number
      size: number
      total: number
    }

    /** PostgREST 列表响应（Content-Range 分页） */
    interface PostgrestListResponse<T> {
      data: T[]
      total: number
      offset: number
      limit: number
    }

    /** RPC 分页结果（search_users / search_audit_log / rpc_list_tenants 等统一结构） */
    interface PageResult<T> {
      total: number
      limit: number
      offset: number
      items: T[]
    }

    /** @deprecated 旧名兼容（= PageResult），新代码一律使用 PageResult */
    type RpcPageResponse<T = any> = PageResult<T>

    /** 024 CRUD RPC 统一返回 */
    interface ApiOk {
      ok: boolean
      id?: string
    }

    /** 032 菜单类型四值封闭 */
    type MenuType = 'directory' | 'menu' | 'button' | 'link'

    /** 启用状态 */
    type EnableStatus = '1' | '2'
  }

  /** 认证 / 用户（§2.3） */
  namespace Auth {
    /** 当前用户信息（get_current_user RPC，含 roles 来自 JWT claims） */
    interface UserInfo {
      id: string
      username: string
      email: string | null
      phone: string | null
      tenant_id: string | null
      tenant_name: string | null
      organization_id: string | null
      organization_name: string | null
      dept_id: string | null
      dept_name: string | null
      is_active: boolean
      /** D27 claims 仍以 roles 并集为准（global_roles/org_roles 为拆分，后端未透出时可空） */
      roles: string[]
      global_roles?: string[]
      org_roles?: string[]
      created_at: string
      updated_at: string
    }

    /** 用户列表项（v_user_list 视图） */
    interface UserListItem {
      id: string
      username: string
      email: string | null
      phone: string | null
      tenant_id: string | null
      organization_id: string | null
      dept_id: string | null
      tenant_name: string | null
      organization_name: string | null
      dept_name: string | null
      is_active: boolean
      /** json 数组（user_tenants 聚合） */
      organizations: string[]
      created_at: string
      updated_at: string
      deleted_at: string | null
    }

    /** 用户-角色镜像行（v_user_roles；⚠️ LEFT JOIN，role_code/role_id 可为 null，前端需过滤） */
    interface UserRoleRow {
      user_id: string
      username: string
      email: string | null
      role_code: string | null
      role_id: string | null
      tenant_id: string | null
      organization_id: string | null
    }

    /** 用户资料（rpc_get_user_profile → user_profile 行或 {}；业务列动态） */
    interface UserProfile {
      user_id: string
      tenant_id: string | null
      organization_id: string | null
      dept_id: string | null
      [key: string]: unknown
    }

    /** @deprecated get_user_permissions 已删（035）；Phase 2 删除 fetchGetUserPermissions 后移除 */
    interface UserPermissions {
      user_id: string
      roles: string[]
      permissions: Array<{ path: string; method: string }>
    }
  }

  /** 菜单三型（§2.3 分层命名） */
  namespace Menu {
    /** get_user_menu 项（038 起全字段；前端路由数据源） */
    interface MenuRouteItem {
      id: string
      parent_id: string | null
      name: string
      path: string | null
      menu_type: Common.MenuType
      perms: string | null
      is_visible: boolean
      /** 035 补：033 回填值（如 system/user/index），映射表仅兜底 */
      component: string | null
      // ↓↓↓ 038 新增（导航元字段）↓↓↓
      /** 外链（menu_type=link 时恒 true） */
      is_link: boolean
      /** iframe 内嵌 */
      is_iframe: boolean
      /** 页面缓存（keep-alive，后端默认 true；056 列改名 is_cache） */
      is_cache: boolean
      /** 目录重定向（'noRedirect' 或子路径） */
      redirect: string | null
      /** Vue Router name（非空时优先后端值） */
      route_name: string | null
      /** 055 新增：标签页固定（多页签布局） */
      is_affix: boolean
      meta: {
        title: string
        icon: string | null
      }
    }

    /** iam_menu 视图全列（菜单管理页数据源；038 起含导航元字段） */
    interface MenuAdminNode {
      id: string
      parent_id: string | null
      menu_name: string
      menu_type: Common.MenuType
      /** 044 列改名：perms → api_code（单码制：与 iam_api.api_code 同码） */
      api_code: string | null
      /** 044 列改名：path → router（前端路由地址；link 类型为外链 URL） */
      router: string | null
      component: string | null
      icon: string | null
      order_num: number
      is_visible: boolean
      is_active: boolean
      // ↓↓↓ 038 新增 ↓↓↓
      remark: string | null
      route_name: string | null
      is_link: boolean
      is_iframe: boolean
      redirect: string | null
      is_cache: boolean
      // ↓↓↓ 055 单表化新增（SharpFort ApiUrl/ApiMethod + Admin.NET IsAffix）↓↓↓
      /** 055 新增：API 端点路径（原 iam_api.path；仅 button 行使用） */
      api_url: string | null
      /** 055 新增：API 端点方法（原 iam_api.method；api_url 非空时必填） */
      api_method: string | null
      /** 055 新增：标签页固定 */
      is_affix: boolean
      created_at: string
      updated_at: string
    }

    /** 本地路由树节点（asyncRoutes） */
    interface RouteMetaNode {
      path: string
      name: string
      component?: unknown
      meta: {
        title: string
        icon?: string
        roles?: string[]
        hideInMenu?: boolean
      }
      children?: RouteMetaNode[]
    }
  }

  /** 系统管理实体（§2.3 组织/部门/岗位/字典/租户/日志/监控/角色权限） */
  namespace SystemManage {
    /** 部门节点（get_dept_tree，递归 CTE；path = '父 > 子'） */
    interface DeptNode {
      id: string
      dept_name: string
      tenant_id: string | null
      organization_id: string | null
      parent_id: string | null
      sort_order: number
      is_active: boolean
      level: number
      path: string
    }

    /** 岗位节点（rpc_get_position_tree；⚠️ 字段名与 dept 树不同；path_name = '父 / 子'） */
    interface PositionNode {
      id: string
      parent_id: string | null
      pos_name: string
      pos_code: string
      sort_no: number
      status: string
      depth: number
      path_name: string
    }

    /** 用户-岗位关联（user_position 视图；⚠️ 仅 ID 列，用户名/岗位名需前端 join） */
    interface UserPositionRow {
      user_id: string
      position_id: string
      tenant_id: string | null
      organization_id: string | null
      is_primary: boolean
      created_at: string
      created_by: string | null
    }

    /** 用户-岗位搜索行（search_user_positions RPC；后端已 join 用户名/岗位路径，服务端分页） */
    interface UserPositionItem {
      user_id: string
      position_id: string
      tenant_id: string | null
      organization_id: string | null
      is_primary: boolean
      created_at: string
      created_by: string | null
      username: string | null
      email: string | null
      user_name: string | null
      pos_name: string
      path_name: string
      created_by_username: string | null
    }

    /** 字典类型（dict_type 视图） */
    interface DictType {
      id: string
      tenant_id: string | null
      organization_id: string | null
      dict_name: string
      dict_label: string
      status: string
      sort_no: number
      remark: string | null
      created_at: string
      updated_at: string
    }

    /** 字典数据项（dict_data 视图） */
    interface DictData {
      id: string
      tenant_id: string | null
      organization_id: string | null
      dict_name: string
      item_label: string
      item_value: string
      item_type: string
      is_default: boolean
      sort_no: number
      status: string
      remark: string | null
      created_at: string
      updated_at: string
    }

    /** 字典类型+数据项聚合（v_dict_list；items 为 json 数组） */
    interface DictListItem {
      dict_name: string
      dict_label: string
      items: DictData[]
    }

    /** 租户（业务组织；rpc_list_tenants.items，D27 输出 organization_id/tenant_id 双列） */
    interface Tenant {
      /** 业务组织（Logto Organization）id——成员弹窗/搜索用 */
      organization_id: string
      /** Logto 部署租户 id（default/admin） */
      tenant_id: string
      name: string
      description: string | null
      tenant_name: string
      created_at: string
      member_count: number
      /** @deprecated 后端已改为 organization_id（兼容历史代码） */
      id?: string
    }

    /** 租户/组织成员（rpc_list_tenant_members.items；D27 不再返回 joined_at） */
    interface TenantMember {
      user_id: string
      username: string
      email: string | null
      phone: string | null
      name: string | null
      avatar: string | null
      is_active: boolean
      tenant_id: string | null
      organization_id: string | null
      /** @deprecated 后端已不再返回 */
      joined_at?: string | null
    }

    /** 用户-业务组织关系行（v_user_role_detail；D27：tenant_id=Logto 租户，organization_id=业务组织） */
    interface UserTenantRow {
      user_id: string
      username: string
      email: string | null
      tenant_id: string | null
      organization_id: string | null
      tenant_name: string | null
      organization_name: string | null
    }

    /** 登录日志（rpc_search_login_logs.items = login_log 视图列） */
    interface LoginLog {
      id: string
      tenant_id: string | null
      organization_id: string | null
      user_id: string
      username: string
      login_type: string
      result: string
      fail_reason: string | null
      ip: string | null
      user_agent: string | null
      region: string | null
      logto_event: string | null
      created_at: string
    }

    /** 审计日志（search_audit_log.items；⚠️ 以 RPC 返回为准，含 tenant_name/organization_name） */
    interface AuditLog {
      id: string
      table_name: string
      operation: string
      old_data: unknown
      new_data: unknown
      user_id: string | null
      username: string | null
      tenant_id: string | null
      tenant_name: string | null
      organization_id: string | null
      organization_name: string | null
      created_at: string
    }

    /** 审计时间线（v_audit_log_timeline；无 old_data/new_data/username） */
    interface AuditLogTimeline {
      log_date: string
      table_name: string
      operation: string
      change_count: number
      unique_users: number
    }

    /** 系统统计（v_system_stats 单行） */
    interface SystemStats {
      total_tenants: number
      active_users: number
      total_users: number
      total_roles: number
      total_departments: number
      total_menus: number
      total_apis: number
      stats_time: string
    }

    /** 实时统计（v_system_stats_realtime；⚠️ 前两列恒 null，monitor 页不展示） */
    interface SystemStatsRealtime {
      online_users: null
      blacklisted_tokens: null
      last_cleanup_time: string | null
      audit_24h: number
      stats_time: string
    }

    /** pg_cron 任务（rpc_list_cron_jobs；⚠️ 返回数组非 {items}） */
    interface CronJob {
      jobid: number
      jobname: string
      schedule: string
      command: string
      nodename: string
      nodeport: number
      database: string
      username: string
      active: boolean
    }

    /** pg_cron 运行历史（rpc_list_cron_job_runs；数组） */
    interface CronJobRun {
      runid: number
      jobid: number
      status: string
      return_message: string
      start_time: string
      end_time: string
    }

    /** 定时任务执行日志（cron_job_log 视图；只读；业务日志表，非 pg_cron 系统表） */
    interface CronJobLog {
      id: string
      job_name: string
      execution_time: string
      result: string | null
      duration_ms: number | null
    }

    /** 系统配置行（config_admin 视图；含 description 管理字段） */
    interface AppConfigRow {
      id: string
      config_key: string
      config_value: string | null
      config_type: string
      description: string | null
      is_public: boolean
      created_at: string
      updated_at: string
    }

    /** 角色权限详情（get_role_permissions RPC） */
    interface RolePermissionDetail {
      role_id: string
      role_code: string
      role_name: string
      type: string
      apis: Array<{
        id: string
        path: string
        method: string
        api_name: string
      }>
      menus: Array<{
        id: string
        name: string
        parent_id: string | null
        path: string | null
        icon: string | null
      }>
      api_count: number
      menu_count: number
    }

    /** 角色-菜单明细行（v_role_menu_detail；055 单表化后 usePermission 数据源——
     * 角色权限码 = role_menu → menu.api_code（button 行），v_role_api_detail 已随 iam_role_api 删除） */
    interface RoleMenuPerm {
      role_id: string
      tenant_id: string | null
      organization_id: string | null
      menu_id: string
      role_code: string
      role_name: string
      menu_name: string
      menu_type: string
      /** 055 单表化：按钮权限码（v_role_menu_detail.permission_code = iam_menu.api_code） */
      permission_code: string | null
      menu_path: string | null
      menu_icon: string | null
      menu_parent_id: string | null
      api_url: string | null
      api_method: string | null
      is_affix: boolean
    }

    /** 角色数据范围（rpc_get_role_data_scope；042） */
    interface RoleDataScope {
      role_code: string
      scope_type: 'all' | 'dept_and_child' | 'self' | 'custom'
      /** custom 时的部门列表 */
      depts: Array<{ id: string; name: string }>
    }

    // ==========================================================================
    // 旧名兼容层（@deprecated —— Phase 2/5 迁移后移除，新代码一律使用上方 §2.3 类型）
    // ==========================================================================

    /** @deprecated 使用 Auth.UserListItem */
    type UserListItem = Api.Auth.UserListItem

    /** @deprecated search_users RPC 参数（Phase 2 迁移） */
    interface UserSearchParams {
      query?: string
      status?: 'active' | 'inactive' | ''
      dept_id?: string
      offset?: number
      limit?: number
    }

    /** @deprecated 使用 Auth.UserRoleRow（v_user_roles 视图仅 user_id/role_code） */
    type UserRoleItem = Api.Auth.UserRoleRow

    /** @deprecated 使用 RolePermissionDetail */
    type RolePermissions = RolePermissionDetail

    /** @deprecated 使用 RoleMenuPerm（055 单表化：权限码 = v_role_menu_detail.permission_code） */
    interface ApiItem {
      id: string
      api_code: string | null
      path: string
      method: string
      name: string
      description?: string | null
      is_active: boolean
      created_at?: string
      updated_at?: string
    }

    /** @deprecated v_role_list 行（Phase 5 迁移） */
    interface RoleListItem {
      id: string
      role_code: string
      role_name: string
      tenant_id: string | null
      tenant_name: string | null
      organization_id: string | null
      description: string | null
      is_active: boolean
      api_count: number
      menu_count: number
      users_count: number
      created_at?: string
      updated_at?: string
      deleted_at?: string | null
    }

    /** 组织角色项（tenant_role 视图 = Logto organization_roles 镜像，只读） */
    interface TenantRoleItem {
      id: string
      tenant_id: string | null
      role_code: string
      role_name: string
      /** D27 起恒为 null（全局组织角色） */
      organization_id: string | null
      description: string | null
      type: string | null
      is_active: boolean
      deleted_at: string | null
      created_by: string | null
      updated_by: string | null
      deleted_by: string | null
    }

    /** @deprecated v_role_list 查询参数（Phase 5 迁移） */
    interface RoleSearchParams {
      query?: string
      is_active?: boolean
      offset?: number
      limit?: number
    }

    /** @deprecated v_role_users 行（仅 role_code/user_id） */
    interface RoleUserItem {
      role_code: string
      role_id: string | null
      user_id: string | null
      /** v_role_users LEFT JOIN users；未分配行为 null */
      username: string | null
      tenant_id: string | null
      role_type: string | null
      assignment_tenant_id: string | null
      assignment_organization_id: string | null
    }

    /** @deprecated 使用 Menu.MenuAdminNode（iam_menu 全列；name/level/children 为前端组树扩展） */
    interface MenuTreeItem extends Menu.MenuAdminNode {
      name?: string
      level?: number
      children?: MenuTreeItem[]
    }

    /** @deprecated get_role_permissions.menus 项 */
    interface MenuItem {
      id: string
      name?: string
      menu_name?: string
      parent_id: string | null
      path?: string | null
      icon?: string | null
      menu_type?: string
      perms?: string | null
    }

    /** @deprecated 使用 DeptNode（children/tenant_id/user_count 为页面扩展） */
    interface DeptTreeItem extends DeptNode {
      tenant_id?: string | null
      user_count?: number
      children?: DeptTreeItem[]
    }

    /** @deprecated 使用 PositionNode */
    interface PositionTreeItem extends PositionNode {
      children?: PositionTreeItem[]
    }

    /** @deprecated 使用 DictType（items 为 v_dict_list 聚合） */
    interface DictTypeItem extends DictType {
      items?: DictDataItem[]
    }

    /** @deprecated 使用 DictData */
    type DictDataItem = DictData

    /** @deprecated 使用 Tenant */
    type TenantListItem = Tenant

    /** @deprecated 使用 TenantMember */
    type TenantMemberItem = TenantMember

    /** @deprecated 使用 LoginLog */
    type LoginLogItem = LoginLog

    /** @deprecated 使用 AuditLog */
    type AuditLogItem = AuditLog

    /** @deprecated 使用 CronJob */
    type CronJobItem = CronJob

    /** @deprecated 使用 CronJobRun */
    type CronJobRunItem = CronJobRun

    /** @deprecated 使用 Auth.UserProfile */
    type UserProfile = Api.Auth.UserProfile
  }
}
