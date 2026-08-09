<!-- 审计日志（search_audit_log 关键词/表名/操作/时间范围筛选 + v_audit_log_timeline 时间线）
  ⚠️ 9.4 已实测：operation 值域 = INSERT/UPDATE/DELETE（大写，audit_trigger_func）；
  log_operate 写入的行 operation 为 NULL → 仅「全部」可见 -->
<template>
  <div class="audit-log-page art-full-height">
    <ElCard class="art-table-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="日志列表" name="list">
          <AuditLogSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

          <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

          <ArtTable
            :loading="loading"
            :data="data"
            :columns="columns"
            :pagination="pagination"
            @pagination:size-change="handleSizeChange"
            @pagination:current-change="handleCurrentChange"
          />
        </el-tab-pane>

        <el-tab-pane label="时间线" name="timeline">
          <AuditTimeline ref="timelineRef" />
        </el-tab-pane>
      </el-tabs>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { searchAuditLog } from '@/api/audit'
  import AuditLogSearch from './modules/audit-log-search.vue'
  import AuditTimeline from './modules/audit-timeline.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'AuditLog' })

  type AuditLog = Api.SystemManage.AuditLog

  const activeTab = ref('list')
  const timelineRef = ref<InstanceType<typeof AuditTimeline>>()

  // 切换到时间线 tab 时刷新（时间线组件可能因 keep-alive 缓存未重新挂载）
  const handleTabChange = (name: string | number) => {
    if (name === 'timeline') {
      timelineRef.value?.loadTimeline()
    }
  }

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({
    query: '',
    table_name: '',
    operation: '',
    date_range: [] as [string, string] | []
  })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<AuditLog[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await searchAuditLog({
        query: searchForm.value.query || null,
        table_name: searchForm.value.table_name || null,
        operation: searchForm.value.operation || null,
        start_date: searchForm.value.date_range?.[0] || null,
        end_date: searchForm.value.date_range?.[1] || null,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取审计日志失败:', error)
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

  const OPERATION_TAG: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    INSERT: 'success',
    UPDATE: 'warning',
    DELETE: 'danger'
  }

  const { columns, columnChecks } = useTableColumns<AuditLog>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'table_name', label: '表名', minWidth: 130, formatter: (row) => row.table_name || '-' },
    {
      prop: 'operation',
      label: '操作',
      width: 90,
      formatter: (row) =>
        row.operation
          ? h(ElTag, { type: OPERATION_TAG[row.operation] || 'info' }, () => row.operation)
          : h(ElTag, { type: 'info' }, () => '操作审计')
    },
    {
      prop: 'username',
      label: '操作人',
      minWidth: 100,
      formatter: (row) => row.username || '-'
    },
    {
      prop: 'old_data',
      label: '变更前',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => (row.old_data ? JSON.stringify(row.old_data).slice(0, 120) : '-')
    },
    {
      prop: 'new_data',
      label: '变更后',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => (row.new_data ? JSON.stringify(row.new_data).slice(0, 120) : '-')
    },
    {
      prop: 'tenant_name',
      label: '租户',
      minWidth: 100,
      formatter: (row) => row.tenant_name || '-'
    },
    {
      prop: 'created_at',
      label: '时间',
      width: 160,
      formatter: (row) => row.created_at?.replace('T', ' ').slice(0, 19) || '-'
    }
  ])

  onMounted(getData)
</script>
