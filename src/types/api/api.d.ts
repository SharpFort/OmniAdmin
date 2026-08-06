declare namespace Api {
  /** 通用类型 */
  namespace Common {
    /** 分页参数 */
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

    /** 分页响应基础结构 */
    interface PaginatedResponse<T = any> {
      records: T[]
      current: number
      size: number
      total: number
    }

    /** PostgREST 列表响应 */
    interface PostgrestListResponse<T> {
      data: T[]
      total: number
      offset: number
      limit: number
    }

    /** RPC 分页响应（search_users / search_audit_log 等统一结构） */
    interface RpcPageResponse<T = any> {
      total: number
      limit: number
      offset: number
      items: T[]
    }

    /** 启用状态 */
    type EnableStatus = '1' | '2'
  }

  /** 认证类型 */
  namespace Auth {
    /** 用户信息（get_current_user RPC 返回） */
    interface UserInfo {
      id: string
      username: string
      email: string
      phone: string
      tenant_id: string | null
      tenant_name: string | null
      dept_id: string | null
      dept_name: string | null
      is_active: boolean
      roles: string[]
      created_at: string
      updated_at: string
    }

    /** 用户 API 权限（get_user_permissions RPC 返回） */
    interface UserPermissions {
      user_id: string
      roles: string[]
      permissions: Array<{ path: string; method: string }>
    }
  }

  /** 系统管理 */
  namespace SystemManage {
    /** 用户列表项（v_user_list） */
    interface UserListItem {
      id: string
      username: string
      email: string
      phone: string
      tenant_id: string | null
      dept_id: string | null
      tenant_name: string | null
      dept_name: string | null
      is_active: boolean
      created_at: string
      updated_at: string
      deleted_at?: string | null
      /** 组织成员关系（Logto organization_id 数组） */
      organizations?: string[]
    }

    /** 用户搜索参数（search_users RPC） */
    interface UserSearchParams {
      query?: string
      status?: 'active' | 'inactive' | ''
      dept_id?: string
      offset?: number
      limit?: number
    }

    /** 用户-角色镜像（v_user_roles） */
    interface UserRoleItem {
      user_id: string
      username: string
      email: string
      role_code: string | null
      assigned_at: string | null
    }

    /** 角色列表项（v_role_list） */
    interface RoleListItem {
      id: string
      role_code: string
      role_name: string
      tenant_id: string | null
      tenant_name: string | null
      description: string | null
      is_active: boolean
      api_count: number
      menu_count: number
      users_count: number
      created_at: string
      updated_at: string
      deleted_at?: string | null
    }

    /** 角色搜索参数 */
    interface RoleSearchParams {
      query?: string
      is_active?: boolean
      offset?: number
      limit?: number
    }

    /** 角色-用户镜像（v_role_users） */
    interface RoleUserItem {
      role_code: string
      role_id: string
      role_type: string
      user_id: string | null
      username: string | null
    }

    /** 角色权限详情（get_role_permissions RPC） */
    interface RolePermissions {
      role_id: string
      role_code: string
      role_name: string
      type: string
      apis: ApiItem[]
      menus: MenuItem[]
      api_count: number
      menu_count: number
    }

    /** 菜单树项（get_menu_tree_admin / iam_menu） */
    interface MenuTreeItem {
      id: string
      parent_id: string | null
      name: string
      menu_name?: string
      menu_type?: 'directory' | 'menu' | 'button'
      perms?: string | null
      path: string | null
      component?: string | null
      icon?: string | null
      order_num?: number
      sort_order?: number
      is_visible?: boolean
      is_active: boolean
      level?: number
      children?: MenuTreeItem[]
    }

    /** 菜单列表项（v_role_menu_detail 等） */
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

    /** API 权限点（iam_api） */
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

    /** 部门树项（get_dept_tree / department） */
    interface DeptTreeItem {
      id: string
      dept_name: string
      tenant_id: string | null
      parent_id: string | null
      sort_order: number
      is_active: boolean
      level?: number
      path?: string
      user_count?: number
      children?: DeptTreeItem[]
    }

    /** 岗位树项（rpc_get_position_tree） */
    interface PositionTreeItem {
      id: string
      parent_id: string | null
      pos_name: string
      pos_code: string | null
      sort_no: number
      status: boolean
      depth?: number
      path_name?: string
      children?: PositionTreeItem[]
    }

    /** 字典类型（dict_type / v_dict_list） */
    interface DictTypeItem {
      id: string
      tenant_id: string | null
      dict_name: string
      dict_label: string
      status: boolean
      sort_no: number
      remark?: string | null
      items?: DictDataItem[]
      created_at?: string
      updated_at?: string
    }

    /** 字典数据项（dict_data） */
    interface DictDataItem {
      id: string
      tenant_id: string | null
      dict_name: string
      item_label: string
      item_value: string
      item_type: string
      is_default: boolean
      sort_no: number
      status: boolean
      remark?: string | null
      created_at?: string
      updated_at?: string
    }

    /** 租户列表项（rpc_list_tenants） */
    interface TenantListItem {
      id: string
      name: string
      description: string
      created_at: string
      member_count: number
    }

    /** 租户成员（rpc_list_tenant_members） */
    interface TenantMemberItem {
      user_id: string
      username: string
      email: string
      phone: string
      name: string
      avatar: string
      is_active: boolean
      joined_at: string
    }

    /** 登录日志（rpc_search_login_logs / v_login_log） */
    interface LoginLogItem {
      id: number
      tenant_id: string | null
      user_id: string
      username: string | null
      login_type: string
      result: string
      fail_reason: string | null
      ip: string | null
      user_agent: string | null
      region: string | null
      logto_event: string | null
      created_at: string
    }

    /** 审计日志（v_audit_log_detail） */
    interface AuditLogItem {
      id: string
      table_name: string
      operation: string
      old_data: any
      new_data: any
      user_id: string
      username: string | null
      tenant_id: string | null
      tenant_name: string | null
      created_at: string
    }

    /** 系统统计（v_system_stats） */
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

    /** 实时统计（v_system_stats_realtime） */
    interface SystemStatsRealtime {
      online_users: number | null
      blacklisted_tokens: number | null
      last_cleanup_time: string | null
      audit_24h: number
      stats_time: string
    }

    /** pg_cron 任务（rpc_list_cron_jobs） */
    interface CronJobItem {
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

    /** pg_cron 运行历史（rpc_list_cron_job_runs） */
    interface CronJobRunItem {
      runid: number
      jobid: number
      status: string
      return_message: string | null
      start_time: string
      end_time: string | null
    }

    /** 用户资料（rpc_get_user_profile → user_profile） */
    interface UserProfile {
      user_id: string
      tenant_id: string | null
      dept_id: string | null
      nickname?: string | null
      avatar?: string | null
      gender?: string | null
      birthday?: string | null
      remark?: string | null
      created_at?: string
      updated_at?: string
      deleted_at?: string | null
    }
  }
}
