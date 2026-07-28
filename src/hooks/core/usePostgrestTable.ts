/**
 * usePostgrestTable - PostgREST 专用表格 Hook
 * 
 * 为 PostgREST 设计的表格数据管理方案，支持：
 * - 自动分页（offset/limit）
 * - PostgREST 查询语法
 * - 列配置管理
 * - 搜索/筛选
 */

import { ref, reactive, computed, onMounted } from 'vue'
import { useTableColumns } from './useTableColumns'
import type { ColumnOption } from '@/types/component'
import { PostgrestListResult } from '@/utils/http/postgrest'

interface UsePostgrestTableConfig<T> {
  /** 获取列表的函数 */
  apiFn: (params: {
    offset: number
    limit: number
    filters: string[]
    order?: string
  }) => Promise<PostgrestListResult<T>>
  /** 默认请求参数 */
  defaultParams?: Record<string, any>
  /** 列配置工厂 */
  columnsFactory?: () => ColumnOption<T>[]
  /** 是否立即加载 */
  immediate?: boolean
}

export function usePostgrestTable<T>(config: UsePostgrestTableConfig<T>) {
  const { apiFn, defaultParams = {}, columnsFactory, immediate = true } = config

  // 加载状态
  const loading = ref(false)
  const data = ref<T[]>([])

  // 分页
  const pagination = reactive({
    current: 1,
    size: 20,
    total: 0
  })

  // 搜索参数
  const searchParams = reactive<Record<string, any>>({ ...defaultParams })
  const filters = ref<string[]>([])
  const order = ref<string>('')

  // 列配置
  const columnConfig = columnsFactory ? useTableColumns<T>(columnsFactory) : null
  const columns = columnConfig?.columns
  const columnChecks = columnConfig?.columnChecks

  // 是否有数据
  const hasData = computed(() => data.value.length > 0)

  // 获取数据
  const getData = async () => {
    loading.value = true
    try {
      const offset = (pagination.current - 1) * pagination.size
      const limit = pagination.size

      const result = await apiFn({
        offset,
        limit,
        filters: filters.value,
        order: order.value || undefined
      })

      data.value = result.data
      pagination.total = result.total
    } catch (error) {
      console.error('获取数据失败:', error)
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  // 搜索
  const search = (params: Record<string, any>) => {
    Object.assign(searchParams, params)
    filters.value = buildFiltersFromSearch(params)
    pagination.current = 1
    getData()
  }

  // 重置搜索
  const resetSearch = () => {
    Object.keys(searchParams).forEach(key => {
      searchParams[key] = undefined
    })
    filters.value = []
    pagination.current = 1
    getData()
  }

  // 刷新
  const refresh = () => {
    getData()
  }

  // 分页变化
  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
    getData()
  }

  const handleCurrentChange = (page: number) => {
    pagination.current = page
    getData()
  }

  // 从搜索参数构建 PostgREST 过滤器
  const buildFiltersFromSearch = (params: Record<string, any>): string[] => {
    const result: string[] = []
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result.push(`${key}=eq.${encodeURIComponent(value)}`)
      }
    })
    return result
  }

  // 初始化
  if (immediate) {
    onMounted(getData)
  }

  return {
    loading,
    data,
    pagination,
    searchParams,
    columns,
    columnChecks,
    hasData,
    getData,
    search,
    resetSearch,
    refresh,
    handleSizeChange,
    handleCurrentChange,
    filters,
    order
  }
}
