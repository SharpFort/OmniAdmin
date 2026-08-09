<!-- API 权限点管理（iam_api 视图；039 按 api_group 分组展示 + menu_id 归属菜单；只读列表） -->
<template>
  <div class="api-page art-full-height">
    <ApiSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getApiList, getMenuList } from '@/api/system-manage'
  import ApiSearch from './modules/api-search.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'Api' })

  type ApiRow = Api.SystemManage.ApiAdminNode

  /** 分组色板（13 组业务分组循环取色） */
  const GROUP_COLORS = [
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'primary',
    'success',
    'warning'
  ] as const
  const groupColorIndex = new Map<string, number>()
  const getGroupColor = (group: string | null): string => {
    if (!group) return 'info'
    if (!groupColorIndex.has(group)) groupColorIndex.set(group, groupColorIndex.size)
    return GROUP_COLORS[groupColorIndex.get(group)! % GROUP_COLORS.length]
  }

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '', api_group: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<ApiRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  /** menu_id → 菜单名 映射（039 归属菜单列展示；iam_menu 全量） */
  const menuNameMap = ref<Record<string, string>>({})

  const loadMenuNames = async () => {
    try {
      const result = await getMenuList({ limit: 1000, offset: 0 })
      const map: Record<string, string> = {}
      result.items.forEach((item) => {
        map[item.id] = item.menu_name
      })
      menuNameMap.value = map
    } catch (error) {
      console.warn('拉取菜单映射失败（归属菜单列显示 -）:', error)
    }
  }

  const getData = async () => {
    loading.value = true
    try {
      const result = await getApiList({
        query: searchForm.value.query || undefined,
        apiGroup: searchForm.value.api_group || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取 API 列表失败:', error)
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  // 搜索 → 合并清洗后参数并跳回第 1 页（分页跳转规范：搜索/重置/改每页条数均回第 1 页）
  const handleSearch = (params: any) => {
    Object.assign(searchForm.value, defaultSearchForm(), params)
    pagination.current = 1
    getData()
  }
  // 重置 → 恢复默认条件并跳回第 1 页
  const resetSearch = () => {
    searchForm.value = defaultSearchForm()
    pagination.current = 1
    getData()
  }
  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
    getData()
  }
  const handleCurrentChange = (page: number) => {
    pagination.current = page
    getData()
  }

  const { columns, columnChecks } = useTableColumns<ApiRow>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'api_code', label: '权限编码', minWidth: 140, formatter: (row) => row.api_code || '-' },
    { prop: 'name', label: '名称', minWidth: 140, formatter: (row) => row.name || '-' },
    {
      prop: 'method',
      label: '方法',
      width: 90,
      formatter: (row) => h(ElTag, { type: 'info', size: 'small' }, () => row.method)
    },
    { prop: 'path', label: '路径', minWidth: 200 },
    // ↓↓↓ 039 分组/归属展示 ↓↓↓
    {
      prop: 'api_group',
      label: '分组',
      width: 110,
      align: 'center',
      formatter: (row) =>
        row.api_group
          ? h(
              ElTag,
              {
                type: getGroupColor(row.api_group) as
                  'primary' | 'success' | 'warning' | 'danger' | 'info',
                size: 'small'
              },
              () => row.api_group
            )
          : '-'
    },
    {
      prop: 'menu_id',
      label: '归属菜单',
      minWidth: 120,
      formatter: (row) =>
        row.menu_id ? menuNameMap.value[row.menu_id] || row.menu_id.slice(0, 8) : '-'
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) =>
        h(ElTag, { type: row.is_active ? 'success' : 'warning' }, () =>
          row.is_active ? '启用' : '禁用'
        )
    }
  ])

  onMounted(() => {
    getData()
    loadMenuNames()
  })
</script>
