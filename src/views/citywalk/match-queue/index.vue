<!-- 匹配复审工作台（v_match_queue_admin + run_source_matching + 复审三动作单条/批量）
  交互流程（设计文档 §5.5 拍板③）：数据源更新数据 → 前端点击"匹配" → 后端运行匹配 → 前端复查
  投票制：auto_bound 免审可驳回；pending 单票人工挑选；R4 无候选走"新建收录"（mca 9 万行主通道） -->
<template>
  <div class="citywalk-match-queue-page art-full-height">
    <MatchQueueSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <!-- 状态统计 chips（count=exact 计数；点击快速过滤） -->
    <ElCard class="mb-3" shadow="never">
      <div class="stats-row">
        <div
          v-for="item in statItems"
          :key="item.key"
          class="stat-chip"
          :class="{
            active:
              searchForm.status === item.status &&
              searchForm.onlyNoCandidate === item.onlyNoCandidate
          }"
          @click="toggleStatFilter(item)"
        >
          <span class="stat-label">{{ item.label }}</span>
          <span class="stat-value" :style="{ color: item.color }">{{
            stats[item.key] ?? '-'
          }}</span>
        </div>
        <div class="stat-chip" @click="clearStatFilter">
          <span class="stat-label">全部</span>
          <span class="stat-value">{{ stats.total ?? '-' }}</span>
        </div>
      </div>
    </ElCard>

    <ElCard class="art-table-card">
      <div class="table-toolbar">
        <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshAll">
          <template #left>
            <ElButton type="primary" @click="runDialogVisible = true">运行匹配</ElButton>
          </template>
        </ArtTableHeader>

        <!-- 批量操作条（有勾选时展示） -->
        <div v-if="selectedRows.length" class="bulk-bar">
          <span class="bulk-count">已选 {{ selectedRows.length }} 项</span>
          <ElButton type="success" size="small" :loading="bulkLoading" @click="handleBulkConfirm">
            批量确认
          </ElButton>
          <ElButton type="danger" size="small" :loading="bulkLoading" @click="handleBulkReject">
            批量驳回
          </ElButton>
          <ElButton type="warning" size="small" :loading="bulkLoading" @click="handleBulkIngest">
            批量新建收录
          </ElButton>
          <ElButton link size="small" @click="clearSelection">取消选择</ElButton>
        </div>
      </div>

      <ArtTable
        ref="artTableRef"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <RunMatchingDialog v-model="runDialogVisible" @refresh="refreshAll" />
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import {
    getMatchQueueList,
    getMatchQueueStats,
    confirmMatch,
    rejectMatch,
    ingestNewFromSource,
    confirmMatches,
    rejectMatches,
    ingestNewFromSourceBulk
  } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import MatchQueueSearch from './modules/match-queue-search.vue'
  import RunMatchingDialog from './modules/run-matching-dialog.vue'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkMatchQueue' })

  type MatchRow = Api.Citywalk.MatchQueueRow

  const defaultSearchForm = () => ({
    provider: '',
    status: '',
    rule: '',
    keyword: '',
    onlyNoCandidate: false
  })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<MatchRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })
  const artTableRef = ref()

  // ------------------------------------------------------------------
  // 列表
  // ------------------------------------------------------------------
  const getData = async () => {
    loading.value = true
    try {
      const result = await getMatchQueueList({
        provider: searchForm.value.provider || undefined,
        status: searchForm.value.status || undefined,
        rule: searchForm.value.rule || undefined,
        keyword: searchForm.value.keyword || undefined,
        onlyNoCandidate: searchForm.value.onlyNoCandidate || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      if (!(error instanceof PostgrestRequestError && error.code === '42501')) {
        console.error('获取匹配队列失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: any) => {
    Object.assign(searchForm.value, defaultSearchForm(), params)
    pagination.current = 1
    getData()
  }
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

  // ------------------------------------------------------------------
  // 统计 chips（快速过滤）
  // ------------------------------------------------------------------
  const stats = ref<Record<string, number>>({})
  const loadStats = async () => {
    try {
      stats.value = await getMatchQueueStats()
    } catch (error) {
      console.warn('加载匹配统计失败:', error)
    }
  }

  const statItems = [
    {
      key: 'pending',
      label: '待审（有候选）',
      status: 'pending',
      onlyNoCandidate: false,
      color: 'var(--el-color-warning)'
    },
    {
      key: 'noCandidate',
      label: 'R4 无候选',
      status: 'pending',
      onlyNoCandidate: true,
      color: 'var(--el-color-danger)'
    },
    {
      key: 'autoBound',
      label: '自动绑定',
      status: 'auto_bound',
      onlyNoCandidate: false,
      color: 'var(--el-color-primary)'
    },
    {
      key: 'confirmed',
      label: '已确认',
      status: 'confirmed',
      onlyNoCandidate: false,
      color: 'var(--el-color-success)'
    },
    {
      key: 'rejected',
      label: '已驳回',
      status: 'rejected',
      onlyNoCandidate: false,
      color: 'var(--el-text-color-secondary)'
    },
    {
      key: 'ingestedNew',
      label: '已新建',
      status: 'ingested_new',
      onlyNoCandidate: false,
      color: 'var(--el-color-success)'
    }
  ]

  const toggleStatFilter = (item: (typeof statItems)[number]) => {
    const active =
      searchForm.value.status === item.status &&
      searchForm.value.onlyNoCandidate === item.onlyNoCandidate
    searchForm.value.status = active ? '' : item.status
    searchForm.value.onlyNoCandidate = active ? false : item.onlyNoCandidate
    pagination.current = 1
    getData()
  }
  const clearStatFilter = () => {
    searchForm.value.status = ''
    searchForm.value.onlyNoCandidate = false
    pagination.current = 1
    getData()
  }

  // ------------------------------------------------------------------
  // 单条复审动作
  // ------------------------------------------------------------------
  const actionable = (row: MatchRow) => row.status === 'pending' || row.status === 'auto_bound'

  const handleConfirm = async (row: MatchRow) => {
    try {
      await ElMessageBox.confirm(
        `确认将「${row.source_name || row.external_key}」绑定到「${row.candidate_place_name}」？`,
        '复审确认',
        { type: 'warning' }
      )
      await confirmMatch(row.queue_id)
      ElMessage.success('已确认绑定')
      refreshAll()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') console.error('确认失败:', error)
    }
  }

  const handleReject = async (row: MatchRow) => {
    try {
      await ElMessageBox.confirm(`驳回该匹配候选？`, '复审驳回', { type: 'warning' })
      await rejectMatch(row.queue_id)
      ElMessage.success('已驳回')
      refreshAll()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') console.error('驳回失败:', error)
    }
  }

  const handleIngest = async (row: MatchRow) => {
    try {
      await ElMessageBox.confirm(
        `从镜像表新建 place（PendingReview）：「${row.source_name || row.external_key}」？`,
        '新建收录',
        { type: 'warning' }
      )
      await ingestNewFromSource(row.queue_id)
      ElMessage.success('已新建收录（PendingReview）')
      refreshAll()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') console.error('新建收录失败:', error)
    }
  }

  // ------------------------------------------------------------------
  // 批量复审动作（单行失败不影响整批，failed 留证提示）
  // ------------------------------------------------------------------
  const selectedRows = ref<MatchRow[]>([])
  const bulkLoading = ref(false)

  const handleSelectionChange = (rows: MatchRow[]) => {
    selectedRows.value = rows
  }
  const clearSelection = () => {
    artTableRef.value?.elTableRef?.clearSelection()
    selectedRows.value = []
  }
  const refreshAll = () => {
    getData()
    loadStats()
    clearSelection()
  }

  const reportBulkResult = (result: Api.Citywalk.BulkActionResult, okLabel: string) => {
    const ok = result.confirmed ?? result.rejected ?? result.ingested ?? 0
    if (result.failed.length) {
      ElMessage.warning(
        `${okLabel} ${ok} 项，失败 ${result.failed.length} 项（如：${result.failed[0].error}）`
      )
    } else {
      ElMessage.success(`${okLabel} ${ok} 项`)
    }
  }

  const runBulk = async (action: () => Promise<Api.Citywalk.BulkActionResult>, okLabel: string) => {
    bulkLoading.value = true
    try {
      reportBulkResult(await action(), okLabel)
      refreshAll()
    } catch (error) {
      console.error(`${okLabel}失败:`, error)
    } finally {
      bulkLoading.value = false
    }
  }

  const handleBulkConfirm = () =>
    runBulk(() => confirmMatches(selectedRows.value.map((r) => r.queue_id)), '批量确认')
  const handleBulkReject = () =>
    runBulk(() => rejectMatches(selectedRows.value.map((r) => r.queue_id)), '批量驳回')
  const handleBulkIngest = () =>
    runBulk(
      () => ingestNewFromSourceBulk(selectedRows.value.map((r) => r.queue_id)),
      '批量新建收录'
    )

  // ------------------------------------------------------------------
  // 列定义
  // ------------------------------------------------------------------
  const providerLabel = (provider: string) => (provider === 'mca' ? 'mca' : provider)
  const statusTagType = (status: string) => {
    if (status === 'pending') return 'warning'
    if (status === 'auto_bound') return 'primary'
    if (status === 'confirmed') return 'success'
    if (status === 'ingested_new') return 'success'
    return 'info'
  }
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: '待审',
      auto_bound: '自动绑定',
      confirmed: '已确认',
      rejected: '已驳回',
      ingested_new: '已新建'
    }
    return map[status] || status
  }

  const { columns, columnChecks } = useTableColumns<MatchRow>(() => [
    { type: 'selection', width: 42 },
    {
      prop: 'provider',
      label: '源',
      width: 80,
      formatter: (row) =>
        h(ElTag, { size: 'small', effect: 'plain' }, () => providerLabel(row.provider))
    },
    {
      prop: 'source_name',
      label: '源记录名',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.source_name
          ? h('span', null, [
              row.source_name,
              row.source_old_name
                ? h('span', { class: 'text-secondary' }, `（曾用名：${row.source_old_name}）`)
                : null
            ])
          : row.external_key
    },
    {
      prop: 'candidate_place_name',
      label: '候选景点',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.candidate_place_name || '（无候选 → 新建收录）'
    },
    {
      prop: 'rules_hit',
      label: '命中规则',
      width: 130,
      formatter: (row) =>
        row.rules_hit.length
          ? h(
              'div',
              { class: 'rules-tags' },
              row.rules_hit.map((r) =>
                h(
                  ElTag,
                  { size: 'small', type: 'success', effect: 'plain', class: 'mr-1' },
                  () => r
                )
              )
            )
          : h(ElTag, { size: 'small', type: 'danger', effect: 'plain' }, () => 'R4')
    },
    {
      prop: 'detail',
      label: '证据（距离/相似度）',
      width: 150,
      showOverflowTooltip: true,
      formatter: (row) => {
        const d = row.detail
        if (!d || (d.r3_distance_m == null && d.r3_similarity == null)) return '-'
        const parts: string[] = []
        if (d.r3_distance_m != null) parts.push(`${d.r3_distance_m}m`)
        if (d.r3_similarity != null) parts.push(`相似 ${d.r3_similarity}`)
        return parts.join(' / ')
      }
    },
    {
      prop: 'status',
      label: '状态',
      width: 95,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 130,
      showOverflowTooltip: true,
      formatter: (row) => row.remark || '-'
    },
    {
      prop: 'updated_at',
      label: '更新时间',
      width: 160,
      formatter: (row) => row.updated_at?.replace('T', ' ').slice(0, 19) || '-'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 150,
      fixed: 'right',
      formatter: (row) => {
        if (!actionable(row)) return '-'
        const buttons = [] as ReturnType<typeof h>[]
        if (row.candidate_place_id) {
          buttons.push(
            h(
              ElButton,
              { type: 'success', link: true, size: 'small', onClick: () => handleConfirm(row) },
              () => '确认'
            ),
            h(
              ElButton,
              { type: 'danger', link: true, size: 'small', onClick: () => handleReject(row) },
              () => '驳回'
            )
          )
        } else {
          buttons.push(
            h(
              ElButton,
              { type: 'warning', link: true, size: 'small', onClick: () => handleIngest(row) },
              () => '新建收录'
            )
          )
        }
        return h('div', null, buttons)
      }
    }
  ])

  const runDialogVisible = ref(false)

  onMounted(() => {
    getData()
    loadStats()
  })
</script>

<style lang="scss" scoped>
  .stats-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .stat-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--el-color-primary-light-5);
    }
    &.active {
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }
    .stat-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
    .stat-value {
      font-size: 16px;
      font-weight: 600;
    }
  }
  .table-toolbar {
    :deep(.art-table-header) {
      padding-bottom: 8px;
    }
    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: var(--el-color-primary-light-9);
      border-radius: 4px;
      .bulk-count {
        font-size: 13px;
        color: var(--el-text-color-regular);
        margin-right: 4px;
      }
    }
  }
  .text-secondary {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  .rules-tags {
    display: inline-flex;
    gap: 2px;
  }
</style>
