<!-- 定时任务日志（cron_job_log 视图：只读业务日志表，非 pg_cron 系统表；
  无写操作，仅列表 + 任务名搜索） -->
<template>
  <div class="cron-job-log-page art-full-height">
    <CronJobLogSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

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
  import { getCronJobLogList } from '@/api/monitor'
  import CronJobLogSearch from './modules/cron-job-log-search.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'CronJobLog' })

  type CronJobLog = Api.SystemManage.CronJobLog

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<CronJobLog[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getCronJobLogList({
        query: searchForm.value.query || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取定时任务日志失败:', error)
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

  /** 结果着色：success/ok/成功 → 绿；error/fail/失败 → 红；其余灰 */
  const resultTagType = (result: string | null) => {
    const text = (result || '').toLowerCase()
    if (/success|ok|成功/.test(text)) return 'success'
    if (/error|fail|失败/.test(text)) return 'danger'
    return 'info'
  }

  const { columns, columnChecks } = useTableColumns<CronJobLog>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'job_name', label: '任务名', minWidth: 180 },
    {
      prop: 'execution_time',
      label: '执行时间',
      minWidth: 160,
      formatter: (row) => String(row.execution_time).replace('T', ' ').slice(0, 19)
    },
    {
      prop: 'result',
      label: '结果',
      minWidth: 200,
      showOverflowTooltip: true,
      formatter: (row) =>
        h(ElTag, { type: resultTagType(row.result), size: 'small' }, () => row.result || '-')
    },
    {
      prop: 'duration_ms',
      label: '耗时 (ms)',
      width: 110,
      align: 'center',
      formatter: (row) => (typeof row.duration_ms === 'number' ? row.duration_ms : '-')
    }
  ])

  onMounted(getData)
</script>
