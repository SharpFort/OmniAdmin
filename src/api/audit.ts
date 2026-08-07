/**
 * 审计日志 API（docs/1.前端对齐后端方案-修订版.md §2.2 audit.ts）
 *
 * - searchAuditLog：search_audit_log RPC 分页搜索（🟢 INVOKER+RLS；p_limit 上限 100）
 * - getAuditLogTimeline：get_audit_log_timeline RPC（按天聚合）
 * - v_audit_log_detail 视图查询（完整字段）
 * - v_audit_log_timeline 视图查询（log_date/change_count/unique_users，无 old_data/new_data）
 */
import { postRpc, getViewPage } from './request'

/** 审计日志搜索（search_audit_log；关键词/表名/操作筛选） */
export function searchAuditLog(
  params: {
    query?: string | null
    table_name?: string | null
    operation?: string | null
    limit?: number
    offset?: number
  } = {}
) {
  return postRpc<Api.Common.PageResult<Api.SystemManage.AuditLog>>('search_audit_log', {
    p_query: params.query ?? null,
    p_table_name: params.table_name ?? null,
    p_operation: params.operation ?? null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0
  })
}

/** 审计时间线（get_audit_log_timeline；返回 {start_date, end_date, items}） */
export function getAuditLogTimeline(params: { start?: string; end?: string } = {}) {
  return postRpc<{
    start_date: string
    end_date: string
    items: Api.SystemManage.AuditLogTimeline[]
  }>('get_audit_log_timeline', {
    p_start_date: params.start ?? null,
    p_end_date: params.end ?? null
  })
}

/** 审计日志明细列表（v_audit_log_detail 视图，分页） */
export function getAuditLogDetailList(
  params: {
    query?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['username'] = `ilike.*${params.query}*`
  return getViewPage<Api.SystemManage.AuditLog>('v_audit_log_detail', {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** 审计时间线列表（v_audit_log_timeline 视图，分页） */
export function getAuditLogTimelineList(params: { limit?: number; offset?: number } = {}) {
  return getViewPage<Api.SystemManage.AuditLogTimeline>('v_audit_log_timeline', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'log_date.desc'
  })
}
