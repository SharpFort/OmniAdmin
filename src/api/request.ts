/**
 * PostgREST 统一请求封装层（docs/1.前端对齐后端方案-修订版.md §2.2）
 *
 * 职责：
 * - postRpc<T>   → POST /rpc/{name}（自动 Bearer token）
 * - getView<T>   → GET /api_v1_platform/{view}（select/order/limit/offset/filters 参数编码）
 * - getViewPage<T> → 视图分页（limit/offset + Prefer: count=exact + Content-Range 取 total）
 * - 错误统一拦截：PostgREST 错误体 {code, message, details, hint}
 *   - code === '42501' → 全局提示「无权限」（页面级降级由调用方捕获 PostgrestRequestError.code 处理）
 *   - code === 'P0001' → 业务错误提示
 *
 * 注意：本层与 src/utils/http/postgrest.ts（模板兼容层）并存；
 * 新代码一律使用本层，postgrest.ts 仅供未迁移页面过渡。
 * URL 说明：本地直连 PostgREST 用根路径（db-schemas=api_v1_platform）；经 APISIX 网关
 * 则把 VITE_API_URL 配为 .../api/v1/platform（proxy-rewrite 去前缀，RPC 仍走 /rpc/{name}）。
 */
import axios, { AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'

/** 请求超时 */
const REQUEST_TIMEOUT = 15000

/** PostgREST 错误体 */
export interface PostgrestErrorBody {
  code: string
  message: string
  details: string | null
  hint: string | null
}

/** 带错误码的请求错误（调用方可按 code 做页面级降级，如 42501） */
export class PostgrestRequestError extends Error {
  code: string
  details: string | null
  hint: string | null

  constructor(body: PostgrestErrorBody) {
    super(body.message || `请求失败（${body.code}）`)
    this.name = 'PostgrestRequestError'
    this.code = body.code
    this.details = body.details
    this.hint = body.hint
  }
}

/** 视图查询参数 */
export interface GetViewParams {
  /** 选择列（'id,username' 或数组） */
  select?: string | string[]
  /** 排序（'created_at.desc'） */
  order?: string
  limit?: number
  offset?: number
  /** 过滤条件（PostgREST 语法值：{ username: 'ilike.*张*', is_active: 'eq.true' }） */
  filters?: Record<string, string>
}

/** 构建查询字符串（encodeURIComponent 编码） */
function buildQuery(params: GetViewParams): string {
  const search = new URLSearchParams()
  if (params.select) {
    search.set('select', Array.isArray(params.select) ? params.select.join(',') : params.select)
  }
  if (params.order) search.set('order', params.order)
  if (typeof params.limit === 'number') search.set('limit', String(params.limit))
  if (typeof params.offset === 'number') search.set('offset', String(params.offset))
  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      search.set(key, value)
    })
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/** 获取带 Bearer token 的请求配置（token 过期经 Logto SDK 静默刷新） */
async function getConfig(config?: AxiosRequestConfig): Promise<AxiosRequestConfig> {
  const userStore = useUserStore()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }

  if (userStore.accessToken) {
    const { ensureFreshToken } = await import('@/config/logto')
    const fresh = await ensureFreshToken().catch(() => userStore.accessToken)
    headers['Authorization'] = `Bearer ${fresh}`
  }

  return {
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: REQUEST_TIMEOUT,
    ...config,
    headers: {
      ...headers,
      ...((config?.headers as Record<string, string>) || {})
    }
  }
}

/** 解析 Content-Range 头获取总数（'0-19/100' → 100） */
function parseContentRangeTotal(headers: Record<string, unknown>): number {
  const contentRange = String(headers['content-range'] || headers['Content-Range'] || '')
  if (!contentRange) return 0
  const match = contentRange.match(/\/(\d+|\*)$/)
  return match && match[1] !== '*' ? parseInt(match[1], 10) : 0
}

/** 统一错误拦截（42501 → 无权限全局提示；P0001 → 业务错误提示） */
function handleError(error: unknown): never {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as Partial<PostgrestErrorBody>
    if (data.code) {
      const requestError = new PostgrestRequestError({
        code: data.code,
        message: data.message || '',
        details: data.details ?? null,
        hint: data.hint ?? null
      })
      if (data.code === '42501') {
        ElMessage.warning('无权限执行该操作，请联系管理员')
      } else if (data.code === 'P0001') {
        ElMessage.error(data.message || '业务处理失败')
      } else {
        ElMessage.error(data.message || `请求失败（${data.code}）`)
      }
      throw requestError
    }
  }
  const message = error instanceof Error ? error.message : '网络请求失败'
  ElMessage.error(message)
  throw error
}

/**
 * POST /rpc/{name} 调用后端存储过程
 * @param name RPC 函数名
 * @param body 参数对象（p_xxx 命名，与后端 pg_get_function_arguments 一致）
 */
export async function postRpc<T = unknown>(
  name: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  try {
    const config = await getConfig()
    const response = await axios.post<T>(`/rpc/${name}`, body, config)
    return response.data
  } catch (error) {
    return handleError(error)
  }
}

/**
 * GET /{view} 视图查询（返回数组）
 * ⚠️ 线上 PostgREST 为无前缀路径模式（宿主机 postgrest.conf 为 Pigsty 手工配置，
 * db-schemas 单 schema——根路径即 api_v1_platform；带 /api_v1_platform/ 前缀返回 404）
 */
export async function getView<T = Record<string, unknown>>(
  view: string,
  params: GetViewParams = {}
): Promise<T[]> {
  try {
    const config = await getConfig()
    const response = await axios.get<T[]>(`/${view}${buildQuery(params)}`, config)
    return response.data
  } catch (error) {
    return handleError(error)
  }
}

/**
 * GET /{view} 视图分页查询
 * limit/offset 分页 + Prefer: count=exact + Content-Range 头取 total
 */
export async function getViewPage<T = Record<string, unknown>>(
  view: string,
  params: GetViewParams = {}
): Promise<Api.Common.PageResult<T>> {
  try {
    const { limit = 20, offset = 0, ...rest } = params
    const config = await getConfig({
      headers: { Prefer: 'count=exact' }
    })
    const response = await axios.get<T[]>(
      `/${view}${buildQuery({ ...rest, limit, offset })}`,
      config
    )
    return {
      items: response.data,
      total: parseContentRangeTotal(response.headers as Record<string, unknown>),
      limit,
      offset
    }
  } catch (error) {
    return handleError(error)
  }
}

export default {
  postRpc,
  getView,
  getViewPage
}
