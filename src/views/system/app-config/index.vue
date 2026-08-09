<!-- 应用配置（config_admin 视图 + update_config RPC；页面仅超管——视图含 password.* 等敏感配置） -->
<template>
  <div class="app-config-page art-full-height">
    <AppConfigSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

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

      <ConfigEditDialog v-model:visible="dialogVisible" :edit-data="editData" @submit="getData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getConfigAdminList } from '@/api/system-manage'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import AppConfigSearch from './modules/app-config-search.vue'
  import ConfigEditDialog from './modules/config-edit-dialog.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'AppConfig' })

  type AppConfigRow = Api.SystemManage.AppConfigRow

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '', isPublic: '' as '' | 'true' | 'false' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<AppConfigRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const dialogVisible = ref(false)
  const editData = ref<AppConfigRow | null>(null)

  const getData = async () => {
    loading.value = true
    try {
      const result = await getConfigAdminList({
        query: searchForm.value.query || undefined,
        isPublic:
          searchForm.value.isPublic === '' ? undefined : searchForm.value.isPublic === 'true',
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取配置列表失败:', error)
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

  const typeTagType = (type: string) =>
    (
      ({ string: 'info', number: 'warning', boolean: 'success', json: 'danger' }) as Record<
        string,
        any
      >
    )[type] || 'info'

  const { columns, columnChecks } = useTableColumns<AppConfigRow>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'config_key', label: '配置键', minWidth: 180 },
    {
      prop: 'config_value',
      label: '配置值',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.config_value ?? '-'
    },
    {
      prop: 'config_type',
      label: '类型',
      width: 90,
      align: 'center',
      formatter: (row) => h(ElTag, { type: typeTagType(row.config_type) }, () => row.config_type)
    },
    {
      prop: 'is_public',
      label: '可见性',
      width: 90,
      align: 'center',
      formatter: (row) =>
        row.is_public
          ? h(ElTag, { type: 'success', size: 'small' }, () => '公开')
          : h(ElTag, { type: 'info', size: 'small' }, () => '内部')
    },
    {
      prop: 'description',
      label: '描述',
      minWidth: 180,
      formatter: (row) => row.description || '-'
    },
    {
      prop: 'updated_at',
      label: '更新时间',
      minWidth: 150,
      formatter: (row) =>
        row.updated_at ? String(row.updated_at).replace('T', ' ').slice(0, 19) : '-'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 90,
      align: 'right',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: right' }, [
          h(ArtButtonTable, {
            type: 'edit',
            onClick: () => showEditDialog(row)
          })
        ])
    }
  ])

  onMounted(getData)

  const showEditDialog = (row: AppConfigRow) => {
    editData.value = row
    dialogVisible.value = true
  }
</script>
