/**
 * 租户管理 API（docs/1.前端对齐后端方案-修订版.md §2.2 tenant.ts）
 *
 * - rpc_list_tenants / rpc_list_tenant_members：🔐 public:tenant:list / public:tenant-member:list
 *   （035 补绑 tenant_admin；分页上限 100）
 * - user_tenants 视图：用户-组织成员关系投影（⚠️ 与 public.user_role 表不同物，
 *   organization_id = 租户 id，不可与 iam_role_* 的 role_id 互 join）
 * - v_user_role_detail 视图：用户-组织成员详情
 */
import { postRpc, getViewPage } from './request'

/** 租户列表（rpc_list_tenants，分页） */
export function listTenants(
  params: {
    query?: string | null
    limit?: number
    offset?: number
  } = {}
) {
  return postRpc<Api.Common.PageResult<Api.SystemManage.Tenant>>('rpc_list_tenants', {
    p_query: params.query ?? null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0
  })
}

/** 租户成员列表（rpc_list_tenant_members，分页） */
export function listTenantMembers(
  params: {
    orgId?: string | null
    query?: string | null
    limit?: number
    offset?: number
  } = {}
) {
  return postRpc<Api.Common.PageResult<Api.SystemManage.TenantMember>>('rpc_list_tenant_members', {
    p_org_id: params.orgId ?? null,
    p_query: params.query ?? null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0
  })
}

/** 用户-组织成员关系（user_tenants 视图，分页） */
export function getUserTenants(
  params: {
    userId?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.userId) filters['user_id'] = `eq.${params.userId}`
  return getViewPage<{
    user_id: string
    organization_id: string
    joined_at: string
  }>('user_tenants', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    filters
  })
}

/** 用户-组织成员详情（v_user_role_detail，分页；role_name/tenant_name 均 = tenants.name） */
export function getUserRoleDetail(
  params: {
    userId?: string
    query?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.userId) filters['user_id'] = `eq.${params.userId}`
  if (params.query) filters['username'] = `ilike.*${params.query}*`
  return getViewPage<Api.SystemManage.UserTenantRow>('v_user_role_detail', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    filters
  })
}
