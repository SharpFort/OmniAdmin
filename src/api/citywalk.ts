/**
 * citywalk 业务域 API（schema: api_v1_content_places，2026-10-16）
 *
 * 后端源：citywalk 仓库 api_v1/content_places（make api-apply 应用）；
 * 非 default schema 的视图/RPC 均带 Accept-Profile 头（request.ts schema 参数）。
 * - 景点管理：v_pois_admin（全状态列表）
 * - 匹配管道：v_match_queue_admin + run_source_matching + 复审三动作（单条/批量）
 * - MCA 镜像：v_place_names_admin / v_place_names_stats / v_place_names_by_province
 * 权限：仅管理员（super_admin/role_admin/tenant_admin；42501 由页面降级处理）
 */
import { getView, getViewPage, postRpc } from './request'

/** citywalk 景点域 schema */
export const CITYWALK_SCHEMA = 'api_v1_content_places'
/** citywalk 主数据 schema（masterdata） */
export const MASTERDATA_SCHEMA = 'api_v1_masterdata'
/** citywalk 反馈工单 schema（content_feedback） */
export const FEEDBACK_SCHEMA = 'api_v1_content_feedback'
/** citywalk 评论 schema（content_comment） */
export const COMMENT_SCHEMA = 'api_v1_content_comment'
/** citywalk 评价 schema（content_reaction） */
export const REACTION_SCHEMA = 'api_v1_content_reaction'
/** citywalk 内容审核 schema（moderation） */
export const MODERATION_SCHEMA = 'api_v1_moderation'

// -----------------------------------------------------------------
// 景点管理
// -----------------------------------------------------------------

/** 景点列表（v_pois_admin 分页） */
export function getPlacesAdminList(
  params: {
    keyword?: string
    status?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.keyword) filters['name'] = `ilike.*${params.keyword}*`
  if (params.status) filters['status'] = `eq.${params.status}`
  return getViewPage<Api.Citywalk.Place>('v_pois_admin', {
    schema: CITYWALK_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'updated_at.desc',
    filters
  })
}

// -----------------------------------------------------------------
// 匹配管道（运行 + 复审）
// -----------------------------------------------------------------

/** 运行匹配引擎（provider=osm/mca；mca 可按区县码分批，R3 阈值试水调参用） */
export function runSourceMatching(
  provider: Api.Citywalk.MatchProvider,
  options: { districtCode?: string; distanceM?: number; simThreshold?: number } = {}
) {
  return postRpc<Api.Citywalk.RunMatchingResult>(
    'run_source_matching',
    {
      p_provider: provider,
      p_district_code: options.districtCode || null,
      p_distance_m: options.distanceM ?? 200,
      p_sim_threshold: options.simThreshold ?? 0.3
    },
    { schema: CITYWALK_SCHEMA }
  )
}

/** 匹配队列列表（v_match_queue_admin 分页） */
export function getMatchQueueList(
  params: {
    provider?: string
    status?: string
    rule?: string
    keyword?: string
    onlyNoCandidate?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.provider) filters['provider'] = `eq.${params.provider}`
  if (params.status) filters['status'] = `eq.${params.status}`
  if (params.rule) filters['rules_hit'] = `cs.{${params.rule}}`
  if (params.keyword) filters['source_name'] = `ilike.*${params.keyword}*`
  if (params.onlyNoCandidate) filters['candidate_place_id'] = 'is.null'
  return getViewPage<Api.Citywalk.MatchQueueRow>('v_match_queue_admin', {
    schema: CITYWALK_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'updated_at.desc',
    filters
  })
}

/** 匹配队列统计计数（limit:0 + count=exact 仅取 total；pending 拆分 R4 无候选） */
export async function getMatchQueueStats() {
  const count = (filters: Record<string, string>) =>
    getViewPage<Api.Citywalk.MatchQueueRow>('v_match_queue_admin', {
      schema: CITYWALK_SCHEMA,
      limit: 0,
      offset: 0,
      filters
    }).then((r) => r.total)
  const [pendingWithCandidate, noCandidate, autoBound, confirmed, rejected, ingestedNew, total] =
    await Promise.all([
      count({ status: 'eq.pending', candidate_place_id: 'not.is.null' }),
      count({ status: 'eq.pending', candidate_place_id: 'is.null' }),
      count({ status: 'eq.auto_bound' }),
      count({ status: 'eq.confirmed' }),
      count({ status: 'eq.rejected' }),
      count({ status: 'eq.ingested_new' }),
      count({})
    ])
  return {
    pending: pendingWithCandidate,
    noCandidate,
    autoBound,
    confirmed,
    rejected,
    ingestedNew,
    total
  }
}

/** 复审：确认（绑定落账，同键其余候选自动落选） */
export function confirmMatch(queueId: string) {
  return postRpc<Api.Citywalk.MatchActionResult>(
    'confirm_match',
    { p_queue_id: queueId },
    { schema: CITYWALK_SCHEMA }
  )
}

/** 复审：驳回（auto_bound 行同时撤销已落账绑定） */
export function rejectMatch(queueId: string, remark?: string) {
  return postRpc<Api.Citywalk.MatchActionResult>(
    'reject_match',
    { p_queue_id: queueId, p_remark: remark || null },
    { schema: CITYWALK_SCHEMA }
  )
}

/** 复审：R4 新建收录（从镜像表建 PendingReview place） */
export function ingestNewFromSource(queueId: string) {
  return postRpc<Api.Citywalk.MatchActionResult>(
    'ingest_new_from_source',
    { p_queue_id: queueId },
    { schema: CITYWALK_SCHEMA }
  )
}

/** 复审：批量确认 */
export function confirmMatches(queueIds: string[]) {
  return postRpc<Api.Citywalk.BulkActionResult>(
    'confirm_matches',
    { p_queue_ids: queueIds },
    { schema: CITYWALK_SCHEMA }
  )
}

/** 复审：批量驳回 */
export function rejectMatches(queueIds: string[], remark?: string) {
  return postRpc<Api.Citywalk.BulkActionResult>(
    'reject_matches',
    { p_queue_ids: queueIds, p_remark: remark || null },
    { schema: CITYWALK_SCHEMA }
  )
}

/** 复审：批量新建收录（mca 9 万行 R4 主通道；大批量按区县分批） */
export function ingestNewFromSourceBulk(queueIds: string[]) {
  return postRpc<Api.Citywalk.BulkActionResult>(
    'ingest_new_from_source_bulk',
    { p_queue_ids: queueIds },
    { schema: CITYWALK_SCHEMA }
  )
}

// -----------------------------------------------------------------
// MCA 地名镜像
// -----------------------------------------------------------------

/** 镜像导入统计（v_place_names_stats 单行） */
export async function getPlaceNamesStats() {
  const rows = await getView<Api.Citywalk.PlaceNamesStats>('v_place_names_stats', {
    schema: CITYWALK_SCHEMA,
    limit: 1
  })
  return rows[0] ?? null
}

/** 镜像按省分布（v_place_names_by_province） */
export function getPlaceNamesByProvince() {
  return getView<Api.Citywalk.PlaceNamesByProvince>('v_place_names_by_province', {
    schema: CITYWALK_SCHEMA,
    order: 'total.desc',
    limit: 40
  })
}

/** 镜像数据浏览（v_place_names_admin 分页） */
export function getPlaceNamesList(
  params: {
    keyword?: string
    province?: string
    hasDetail?: boolean
    onlyUnbound?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.keyword) filters['standard_name'] = `ilike.*${params.keyword}*`
  if (params.province) filters['province_name'] = `eq.${params.province}`
  if (params.hasDetail !== undefined && params.hasDetail) filters['place_origin'] = 'not.is.null'
  if (params.onlyUnbound) filters['already_bound'] = 'eq.false'
  return getViewPage<Api.Citywalk.PlaceName>('v_place_names_admin', {
    schema: CITYWALK_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'place_code.asc',
    select:
      'id,place_code,standard_name,old_name,roman_alphabet_spelling,province_name,city_name,' +
      'district_name,district_code,place_type,place_type_code,longitude,latitude,place_origin,' +
      'place_meaning,place_history,match_keyword,collected_at,detail_collected_at,source_file,' +
      'imported_at,already_bound,has_open_match',
    filters
  })
}

// -----------------------------------------------------------------
// 主数据（masterdata：标签 / 分类）
// -----------------------------------------------------------------

/** 标签列表（v_tags 分页） */
export function getTagsList(
  params: {
    keyword?: string
    status?: string
    tagType?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.keyword) filters['display_name'] = `ilike.*${params.keyword}*`
  if (params.status) filters['status'] = `eq.${params.status}`
  if (params.tagType) filters['tag_type'] = `eq.${params.tagType}`
  return getViewPage<Api.Citywalk.Tag>('v_tags', {
    schema: MASTERDATA_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'slug.asc',
    filters
  })
}

/** 标签合并（运营动作：source 并入 target，source 置 merged 状态） */
export function mergeTag(sourceTagId: string, targetTagId: string) {
  return postRpc<unknown>(
    'rpc_merge_tag',
    { p_source_tag_id: sourceTagId, p_target_tag_id: targetTagId },
    { schema: MASTERDATA_SCHEMA }
  )
}

/** 分类列表（v_categories，树形页一次拉全量客户端组树） */
export function getCategoriesList(params: { keyword?: string } = {}) {
  const filters: Record<string, string> = {}
  if (params.keyword) filters['name'] = `ilike.*${params.keyword}*`
  return getView<Api.Citywalk.Category>('v_categories', {
    schema: MASTERDATA_SCHEMA,
    order: 'full_code.asc',
    limit: 1000,
    filters
  })
}

// -----------------------------------------------------------------
// 反馈工单（content_feedback）
// -----------------------------------------------------------------

/** 工单列表（v_ticket_list 分页） */
export function getTicketList(
  params: {
    keyword?: string
    status?: string
    ticketType?: string
    priority?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.keyword) filters['title'] = `ilike.*${params.keyword}*`
  if (params.status) filters['status'] = `eq.${params.status}`
  if (params.ticketType) filters['ticket_type'] = `eq.${params.ticketType}`
  if (params.priority) filters['priority'] = `eq.${params.priority}`
  return getViewPage<Api.Citywalk.Ticket>('v_ticket_list', {
    schema: FEEDBACK_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'updated_at.desc',
    filters
  })
}

/** 工单改状态（状态机由 db 层校验） */
export function changeTicketStatus(ticketId: string, newStatus: string, remark?: string) {
  return postRpc<boolean>(
    'rpc_change_ticket_status',
    { p_ticket_id: ticketId, p_new_status: newStatus, p_remark: remark || null },
    { schema: FEEDBACK_SCHEMA }
  )
}

/** 工单受理（指派处理人） */
export function assignTicket(ticketId: string, assigneeId: string) {
  return postRpc<boolean>(
    'rpc_assign_ticket',
    { p_ticket_id: ticketId, p_assignee_id: assigneeId },
    { schema: FEEDBACK_SCHEMA }
  )
}

/** 工单批量关闭 */
export function batchCloseTickets(ticketIds: string[], reason?: string) {
  return postRpc<unknown>(
    'batch_close_tickets',
    { p_ticket_ids: ticketIds, p_reason: reason || '批量关闭' },
    { schema: FEEDBACK_SCHEMA }
  )
}

/** 工单批量改优先级 */
export function batchUpdatePriority(ticketIds: string[], newPriority: string) {
  return postRpc<unknown>(
    'batch_update_priority',
    { p_ticket_ids: ticketIds, p_new_priority: newPriority },
    { schema: FEEDBACK_SCHEMA }
  )
}

/** POI 纠错复审列表（v_poi_update_requests_admin 分页） */
export function getPoiUpdateRequests(
  params: { status?: string; keyword?: string; limit?: number; offset?: number } = {}
) {
  const filters: Record<string, string> = {}
  if (params.status) filters['status'] = `eq.${params.status}`
  if (params.keyword) filters['poi_name'] = `ilike.*${params.keyword}*`
  return getViewPage<Api.Citywalk.PoiUpdateRequest>('v_poi_update_requests_admin', {
    schema: FEEDBACK_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** POI 纠错复审（通过/驳回：p_new_status = Approved / Rejected） */
export function reviewPoiUpdateRequest(requestId: string, newStatus: 'Approved' | 'Rejected') {
  return postRpc<unknown>(
    'rpc_review_poi_update_request',
    { p_request_id: requestId, p_new_status: newStatus },
    { schema: FEEDBACK_SCHEMA }
  )
}

// -----------------------------------------------------------------
// 评论与举报（content_comment）
// -----------------------------------------------------------------

/** 评论列表（v_comments_admin 分页，admin 端全状态） */
export function getCommentsAdminList(
  params: {
    keyword?: string
    status?: string
    onlyReported?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.keyword) filters['content'] = `ilike.*${params.keyword}*`
  if (params.status) filters['status'] = `eq.${params.status}`
  if (params.onlyReported) filters['is_reported'] = 'eq.true'
  return getViewPage<Api.Citywalk.Comment>('v_comments_admin', {
    schema: COMMENT_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** 评论审核动作（hide/restore/violation/delete/top/untop） */
export function moderateComment(id: string, action: string) {
  return postRpc<unknown>(
    'rpc_moderate_comment',
    { p_id: id, p_action: action },
    { schema: COMMENT_SCHEMA }
  )
}

/** 评论批量审核（同 moderateComment 动作集） */
export function batchModerateComments(ids: string[], action: string) {
  return postRpc<unknown>(
    'rpc_batch_moderate_comments',
    { p_ids: ids, p_action: action },
    { schema: COMMENT_SCHEMA }
  )
}

/** 举报列表（v_review_reports：评论/评价举报，admin 端全状态） */
export function getReportList(
  params: {
    status?: string
    targetType?: string
    reasonType?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.status) filters['status'] = `eq.${params.status}`
  if (params.targetType) filters['target_type'] = `eq.${params.targetType}`
  if (params.reasonType) filters['reason_type'] = `eq.${params.reasonType}`
  return getViewPage<Api.Citywalk.ReviewReport>('v_review_reports', {
    schema: COMMENT_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** 举报处理（p_status: resolved 已处置 / rejected 驳回举报） */
export function handleReport(id: string, status: 'resolved' | 'rejected', remark?: string) {
  return postRpc<unknown>(
    'rpc_handle_report',
    { p_id: id, p_status: status, p_handler_remark: remark || null },
    { schema: COMMENT_SCHEMA }
  )
}

// -----------------------------------------------------------------
// 评价（content_reaction）
// -----------------------------------------------------------------

/** 评价列表（v_reviews_admin 分页，admin 端全状态） */
export function getReviewsAdminList(
  params: {
    keyword?: string
    status?: string
    minScore?: number
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.keyword) filters['content'] = `ilike.*${params.keyword}*`
  if (params.status) filters['status'] = `eq.${params.status}`
  if (params.minScore !== undefined) filters['overall_score'] = `gte.${params.minScore}`
  return getViewPage<Api.Citywalk.Review>('v_reviews_admin', {
    schema: REACTION_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** 评价审核动作（publish 发布 / reject 驳回） */
export function moderateReview(id: string, action: string) {
  return postRpc<unknown>(
    'rpc_moderate_review',
    { p_id: id, p_action: action },
    { schema: REACTION_SCHEMA }
  )
}

/** 评价批量审核（同 moderateReview 动作集） */
export function batchModerateReviews(ids: string[], action: string) {
  return postRpc<unknown>(
    'rpc_batch_moderate_reviews',
    { p_ids: ids, p_action: action },
    { schema: REACTION_SCHEMA }
  )
}

// -----------------------------------------------------------------
// 内容审核（moderation）
// -----------------------------------------------------------------

/** 待审队列（v_pending_audit_queue 分页） */
export function getModerationQueue(
  params: {
    targetType?: string
    riskLevel?: string
    onlyOverdue?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.targetType) filters['target_type'] = `eq.${params.targetType}`
  if (params.riskLevel) filters['risk_level'] = `eq.${params.riskLevel}`
  if (params.onlyOverdue) filters['is_overdue'] = 'eq.true'
  return getViewPage<Api.Citywalk.ModerationQueueItem>('v_pending_audit_queue', {
    schema: MODERATION_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    filters
  })
}

/** 风险看板（v_admin_risk_dashboard 按日/类型/风险级聚合，近 N 天） */
export function getRiskDashboard(limit = 200) {
  return getView<Api.Citywalk.RiskDashboardRow>('v_admin_risk_dashboard', {
    schema: MODERATION_SCHEMA,
    order: 'review_date.desc',
    limit
  })
}

/** 审核通过 */
export function approveContent(contentId: string) {
  return postRpc<unknown>(
    'rpc_admin_approve_content',
    { p_content_id: contentId },
    { schema: MODERATION_SCHEMA }
  )
}

/** 审核驳回（可带原因码与备注） */
export function rejectContent(contentId: string, reasonCode?: string, remark?: string) {
  return postRpc<unknown>(
    'rpc_admin_reject_content',
    {
      p_content_id: contentId,
      p_rejection_reason_code: reasonCode || null,
      p_custom_remark: remark || null
    },
    { schema: MODERATION_SCHEMA }
  )
}

/** 审核任务指派（处理人 + 优先级 + 截止时间） */
export function assignModerationTask(
  contentId: string,
  assigneeId: string,
  priority = 'Medium',
  dueTime?: string
) {
  return postRpc<unknown>(
    'rpc_admin_assign_task',
    {
      p_content_id: contentId,
      p_assignee_id: assigneeId,
      p_priority: priority,
      p_due_time: dueTime || null
    },
    { schema: MODERATION_SCHEMA }
  )
}

/** 申诉列表（v_appeals_admin 分页） */
export function getAppealsAdminList(
  params: { status?: string; limit?: number; offset?: number } = {}
) {
  const filters: Record<string, string> = {}
  if (params.status) filters['status'] = `eq.${params.status}`
  return getViewPage<Api.Citywalk.Appeal>('v_appeals_admin', {
    schema: MODERATION_SCHEMA,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    order: 'created_at.desc',
    filters
  })
}

/** 申诉处理（通过 = 支持申诉撤销原判；驳回 = 维持原判） */
export function handleAppeal(appealId: string, isApproved: boolean) {
  return postRpc<unknown>(
    'rpc_admin_handle_appeal',
    { p_appeal_id: appealId, p_is_approved: isApproved },
    { schema: MODERATION_SCHEMA }
  )
}
