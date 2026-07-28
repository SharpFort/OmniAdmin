/**
 * PostgREST HTTP 适配层
 *
 * 为 PostgREST 提供专用的请求封装，处理：
 * - Content-Range 分页头解析
 * - PostgREST 查询语法生成（eq, gt, like, in, order 等）
 * - RPC 存储过程调用
 * - 错误处理
 *
 * PostgREST 特点：
 * - GET 返回数组 [{...}, {...}]
 * - 分页：offset/limit，总数在 Content-Range 头（如 "0-9/100"）
 * - 过滤：URL 查询参数（如 ?username=ilike.*张*）
 * - RPC：POST + JSON body
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { useUserStore } from '@/store/modules/user'

/** 请求配置常量 */
const REQUEST_TIMEOUT = 15000

/** 解析 Content-Range 头获取总数 */
function parseContentRangeTotal(response: AxiosResponse): number {
  const contentRange = response.headers['content-range'] || response.headers['Content-Range']
  if (!contentRange) return 0

  // 格式: "0-9/100" 或 "0-9/*"
  const match = contentRange.match(/\/(\d+|\*)$/)
  if (match && match[1] !== '*') {
    return parseInt(match[1], 10)
  }
  return 0
}

/** PostgREST 查询操作器 */
export const PostgrestOperator = {
  eq: 'eq.',
  neq: 'neq.',
  gt: 'gt.',
  gte: 'gte.',
  lt: 'lt.',
  lte: 'lte.',
  like: 'like.',
  ilike: 'ilike.',
  in: 'in.',
  is: 'is.',
  not: 'not.',
  contains: 'cs.',
  containedBy: 'cd.',
  overlap: 'ov.',
  match: 'match.',
  imatch: 'imatch.',
  startsWith: 'startsWith.',
  istartsWith: 'istartsWith.',
  endsWith: 'endsWith.',
  iendsWith: 'iendsWith.'
} as const

/** 构建 PostgREST 过滤参数 */
export function buildFilter(
  field: string,
  operator: keyof typeof PostgrestOperator,
  value: any
): string {
  const op = PostgrestOperator[operator]

  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (operator === 'in') {
    const values = Array.isArray(value) ? value : [value]
    return `${field}=${op}(${values.join(',')})`
  }

  return `${field}=${op}${encodeURIComponent(value)}`
}

/** 构建排序参数 */
export function buildOrder(field: string, direction: 'asc' | 'desc' = 'asc'): string {
  return `${field}.${direction}`
}

/** 构建选择字段参数 */
export function buildSelect(fields: string[]): string {
  return fields.join(',')
}

/** 分页结果 */
export interface PostgrestListResult<T> {
  data: T[]
  total: number
  offset: number
  limit: number
}

/** RPC 结果 */
export interface PostgrestRpcResult<T = any> {
  data: T
}

/** PostgREST HTTP 客户端 */
class PostgrestClient {
  private baseURL: string

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || ''
  }

  /** 获取 Axios 实例（带 token） */
  private getConfig(config?: AxiosRequestConfig): AxiosRequestConfig {
    const userStore = useUserStore()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(config?.headers as Record<string, string>)
    }

    if (userStore.accessToken) {
      headers['Authorization'] = `Bearer ${userStore.accessToken}`
    }

    return {
      ...config,
      baseURL: this.baseURL,
      timeout: REQUEST_TIMEOUT,
      headers
    }
  }

  /**
   * GET 获取列表
   * @param path 资源路径（如 /v_user_list）
   * @param options 查询选项
   */
  async getList<T>(
    path: string,
    options: {
      offset?: number
      limit?: number
      filters?: string[]
      order?: string
      select?: string[]
    } = {}
  ): Promise<PostgrestListResult<T>> {
    const { offset = 0, limit = 20, filters = [], order, select } = options

    const params = new URLSearchParams()
    params.set('offset', String(offset))
    params.set('limit', String(limit - 1)) // PostgREST 返回 offset 到 offset+limit-1

    filters.forEach((f) => {
      const [key, value] = f.split('=', 2)
      if (key && value !== undefined) {
        params.set(key, value)
      }
    })

    if (order) {
      params.set('order', order)
    }

    if (select?.length) {
      params.set('select', select.join(','))
    }

    const url = `${path}?${params.toString()}`
    const response = await axios.get<T[]>(url, this.getConfig())

    const total = parseContentRangeTotal(response)

    return {
      data: response.data,
      total,
      offset,
      limit
    }
  }

  /**
   * GET 获取单条记录
   * @param path 资源路径
   * @param id 记录 ID
   * @param select 选择字段
   */
  async getOne<T>(path: string, id: string, select?: string[]): Promise<T> {
    const params = new URLSearchParams()
    params.set('id', `eq.${id}`)
    params.set('limit', '1')

    if (select?.length) {
      params.set('select', select.join(','))
    }

    const url = `${path}?${params.toString()}`
    const response = await axios.get<T[]>(url, this.getConfig())

    if (!response.data.length) {
      throw new Error('记录不存在')
    }

    return response.data[0]
  }

  /**
   * POST 调用 RPC 存储过程
   * @param procName 存储过程名
   * @param params 参数对象
   */
  async rpc<T = any>(procName: string, params: Record<string, any> = {}): Promise<T> {
    const response = await axios.post<T>(`/rpc/${procName}`, params, this.getConfig())
    return response.data
  }

  /**
   * POST 创建记录
   * @param path 资源路径
   * @param data 数据对象
   */
  async create<T>(path: string, data: Record<string, any>): Promise<T> {
    const response = await axios.post<T>(
      path,
      data,
      this.getConfig({ headers: { Prefer: 'return=representation' } })
    )
    return response.data
  }

  /**
   * PATCH 更新记录
   * @param path 资源路径
   * @param id 记录 ID
   * @param data 更新数据
   */
  async update<T>(path: string, id: string, data: Record<string, any>): Promise<T> {
    const params = new URLSearchParams()
    params.set('id', `eq.${id}`)

    const url = `${path}?${params.toString()}`
    const response = await axios.patch<T>(
      url,
      data,
      this.getConfig({ headers: { Prefer: 'return=representation' } })
    )
    return response.data
  }

  /**
   * DELETE 删除记录
   * @param path 资源路径
   * @param id 记录 ID
   */
  async delete(path: string, id: string): Promise<void> {
    const params = new URLSearchParams()
    params.set('id', `eq.${id}`)

    const url = `${path}?${params.toString()}`
    await axios.delete(url, this.getConfig())
  }
}

export const postgrest = new PostgrestClient()

/** 导出便捷方法 */
export const getPostgrestList = postgrest.getList.bind(postgrest)
export const getPostgrestOne = postgrest.getOne.bind(postgrest)
export const callRpc = postgrest.rpc.bind(postgrest)
export const createRecord = postgrest.create.bind(postgrest)
export const updateRecord = postgrest.update.bind(postgrest)
export const deleteRecord = postgrest.delete.bind(postgrest)

export default postgrest
