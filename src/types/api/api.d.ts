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

    /** 启用状态 */
    type EnableStatus = '1' | '2'
  }

  /** 认证类型 */
  namespace Auth {
    /** 登录参数 */
    interface LoginParams {
      username: string
      password: string
    }

    /** 登录响应 */
    interface LoginResponse {
      token: string
      refresh_token?: string
    }

    /** 用户信息 */
    interface UserInfo {
      id: string
      username: string
      email: string
      phone: string
      tenant_id: string
      dept_id: string
      is_active: boolean
      roles: string[]
      permissions?: string[]
      created_at: string
      updated_at: string
    }
  }

  /** 系统管理 - 用户 */
  namespace SystemManage {
    /** 用户列表项 (对应 v_user_list) */
    interface UserListItem {
      id: string
      username: string
      email: string
      phone: string
      tenant_id: string
      dept_id: string
      tenant_name: string
      dept_name: string
      is_active: boolean
      roles: string[]
      created_at: string
      updated_at: string
      deleted_at?: string
    }

    /** 用户搜索参数 */
    interface UserSearchParams {
      query?: string
      dept_id?: string
      status?: string
      offset?: number
      limit?: number
    }

    /** 创建用户参数 */
    interface CreateUserParams {
      p_username: string
      p_password: string
      p_tenant_id: string
      p_email?: string
      p_phone?: string
      p_dept_id?: string
    }

    /** 角色列表项 (对应 v_role_list) */
    interface RoleListItem {
      id: string
      role_code: string
      role_name: string
      description: string
      is_active: boolean
      tenant_id?: string
      tenant_name?: string
      api_count: number
      menu_count: number
      users_count: number
      created_at: string
      updated_at: string
      deleted_at?: string
    }

    /** 角色搜索参数 */
    interface RoleSearchParams {
      query?: string
      is_active?: boolean
      offset?: number
      limit?: number
    }

    /** 角色权限详情 */
    interface RolePermissions {
      role_id: string
      role_code: string
      role_name: string
      menus: MenuTreeItem[]
      apis: ApiItem[]
    }

    /** 菜单树项 */
    interface MenuTreeItem {
      id: string
      parent_id: string
      type: 'directory' | 'menu' | 'button'
      name: string
      path: string
      component: string
      title: string
      icon: string
      permission_code: string
      sort_order: number
      is_active: boolean
      children?: MenuTreeItem[]
    }

    /** API 项 */
    interface ApiItem {
      id: string
      path: string
      method: string
      api_name: string
      is_active: boolean
    }

    /** 部门树项 */
    interface DeptTreeItem {
      id: string
      dept_name: string
      parent_id: string
      sort_order: number
      is_active: boolean
      children?: DeptTreeItem[]
    }

    /** 更新角色权限参数 */
    interface UpdateRolePermissionsParams {
      p_role_id: string
      p_menu_ids: string[]
      p_api_ids: string[]
    }

    /** 分配角色参数 */
    interface AssignRoleParams {
      p_user_id: string
      p_role_id: string
    }

    /** 批量分配角色参数 */
    interface BatchAssignRolesParams {
      p_user_id: string
      p_role_ids: string[]
    }
  }
}
