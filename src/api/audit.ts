/**
 * 审计日志 API（docs/1.前端对齐后端方案-修订版.md §2.2 audit.ts）
 *
 * - searchAuditLog：search_audit_log RPC 分页搜索（🟢 INVOKER+RLS；p_limit 上限 100）
 * - getAuditLogTimeline：get_audit_log_timeline RPC（按天聚合）
 * - v_audit_log_detail 视图查询（完整字段）
 * - v_audit_log_timeline 视图查询（log_date/change_count/unique_users，无 old_data/new_data）
 */
import { postRpc, getViewPage } from './request'
import { toIsoLocal } from '@/utils/date'

/** 审计日志搜索（search_audit_log；关键词/表名/操作/时间范围筛选）
 *  036 起 RPC 支持：p_query 匹配操作人+变更内容、p_table_name 模糊、时间范围。
 *  时间约定：start_date/end_date 传本地时间字符串（"YYYY-MM-DD" 或 "YYYY-MM-DD HH:mm:ss"），
 *  本层统一补 23:59:59 并转 ISO（PostgREST timestamptz 无歧义解析）。
 */
export function searchAuditLog(
  params: {
    query?: string | null
    table_name?: string | null
    operation?: string | null
    /** 开始时间（本地时间；date-only 视为当天 00:00:00） */
    start_date?: string | null
    /** 结束时间（本地时间；date-only 自动补到当天 23:59:59，左闭右闭） */
    end_date?: string | null
    limit?: number
    offset?: number
  } = {}
) {
  return postRpc<Api.Common.PageResult<Api.SystemManage.AuditLog>>('search_audit_log', {
    p_query: params.query ?? null,
    p_table_name: params.table_name ?? null,
    p_operation: params.operation ?? null,
    p_start_date: toIsoLocal(params.start_date),
    p_end_date: toIsoLocal(params.end_date, true),
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
