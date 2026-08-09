/**
 * 系统监控 API（docs/1.前端对齐后端方案-修订版.md §2.2 monitor.ts）
 *
 * - v_system_stats / v_system_stats_realtime：统计卡片（⚠️ online_users/blacklisted_tokens 恒 NULL，不展示）
 * - rpc_list_cron_jobs / rpc_list_cron_job_runs：pg_cron（👑 超管；⚠️ 返回数组非 {items}；
 *   035 已补 GRANT authenticated，租户管理员调用时函数内静默返回空，非 42501）
 * - cleanup_expired_tokens 已整链删除（035），不封装
 */
import { postRpc, getView, getViewPage } from './request'

/** 系统统计（v_system_stats 单行） */
export async function getSystemStats() {
  const rows = await getView<Api.SystemManage.SystemStats>('v_system_stats', { limit: 1 })
  return rows[0] ?? null
}

/** 实时统计（v_system_stats_realtime 单行；前两列恒 null 不展示） */
export async function getSystemStatsRealtime() {
  const rows = await getView<Api.SystemManage.SystemStatsRealtime>('v_system_stats_realtime', {
    limit: 1
  })
  return rows[0] ?? null
}

/** pg_cron 任务列表（👑 超管；返回数组） */
export function listCronJobs() {
  return postRpc<Api.SystemManage.CronJob[]>('rpc_list_cron_jobs', {})
}

/** pg_cron 运行历史（👑 超管；返回数组） */
export function listCronJobRuns(limit = 100) {
  return postRpc<Api.SystemManage.CronJobRun[]>('rpc_list_cron_job_runs', { p_limit: limit })
}

/** 定时任务执行日志（cron_job_log 视图，分页；只读业务日志表） */
export function getCronJobLogList(
  params: { query?: string; limit?: number; offset?: number } = {}
) {
  const filters: Record<string, string> = {}
  if (params.query) filters['job_name'] = `ilike.*${params.query}*`
  return getViewPage<Api.SystemManage.CronJobLog>('cron_job_log', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'execution_time.desc',
    filters
  })
}
