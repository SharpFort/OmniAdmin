<!-- 审计日志（search_audit_log 关键词/表名/操作/时间范围筛选 + v_audit_log_timeline 时间线）
  ⚠️ 9.4 已实测：operation 值域 = INSERT/UPDATE/DELETE（大写，audit_trigger_func）；
  log_operate 写入的行 operation 为 NULL → 仅「全部」可见
  搜索栏在卡片外（仅日志列表 tab 显示）：art-table-card 高度固定且 overflow hidden，
  搜索栏放卡片内（tabs 里）会把分页条裁出视口 -->
<template>
  <div class="audit-log-page art-full-height">
    <AuditLogSearch
      v-if="activeTab === 'list'"
      v-model="searchForm"
      @search="handleSearch"
      @reset="resetSearch"
    />

    <ElCard class="art-table-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="日志列表" name="list">
          <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

          <ArtTable
            :loading="loading"
            :data="data"
            :columns="columns"
            :pagination="pagination"
            @row-click="handleRowClick"
            @pagination:size-change="handleSizeChange"
            @pagination:current-change="handleCurrentChange"
          />
        </el-tab-pane>

        <el-tab-pane label="时间线" name="timeline">
          <AuditTimeline ref="timelineRef" />
        </el-tab-pane>
      </el-tabs>

      <AuditLogDetailDialog v-model:visible="detailVisible" :log="currentLog" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { searchAuditLog } from '@/api/audit'
  import AuditLogSearch from './modules/audit-log-search.vue'
  import AuditTimeline from './modules/audit-timeline.vue'
  import AuditLogDetailDialog from './modules/audit-log-detail-dialog.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'AuditLog' })

  type AuditLog = Api.SystemManage.AuditLog

  const activeTab = ref('list')
  const timelineRef = ref<InstanceType<typeof AuditTimeline>>()

  // 详情弹窗（行点击 / 操作列查看按钮）
  const detailVisible = ref(false)
  const currentLog = ref<AuditLog | null>(null)

  const showDetail = (row: AuditLog) => {
    currentLog.value = row
    detailVisible.value = true
  }

  // 行点击打开详情（忽略来自按钮/链接等交互元素的点击冒泡）
  const handleRowClick = (row: AuditLog, _column: unknown, event: Event) => {
    if ((event.target as HTMLElement)?.closest('button, a, input, .el-switch')) return
    showDetail(row)
  }

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
      prop: 'organization_name',
      label: '租户/组织',
      minWidth: 120,
      formatter: (row) => row.organization_name || row.tenant_name || '-'
    },
    {
      prop: 'created_at',
      label: '时间',
      width: 160,
      formatter: (row) => row.created_at?.replace('T', ' ').slice(0, 19) || '-'
    },
    {
      prop: 'operation_btn',
      label: '操作',
      width: 80,
      align: 'center',
      fixed: 'right',
      formatter: (row) =>
        h(ArtButtonTable, { type: 'view', title: '查看详情', onClick: () => showDetail(row) })
    }
  ])

  onMounted(getData)
</script>

<style scoped>
  /* 卡片体改 flex 纵向：el-tabs 占满卡片剩余高度，表格区随内容收缩。
     否则 el-tabs 页签头的高度不被 .art-table 的高度计算感知，
     分页条会被 .el-card__body 的 overflow hidden 裁出视口 */
  .audit-log-page :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .audit-log-page :deep(.el-tabs) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .audit-log-page :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;

    /* .art-table 内置高度公式的间距常量比分页条实际外边距小几个像素，
       溢出的几像素靠卡片 padding 吸收（与普通页面一致），不能在此裁剪 */
    overflow: visible;
  }

  .audit-log-page :deep(.el-tab-pane) {
    height: 100%;
  }
</style>
