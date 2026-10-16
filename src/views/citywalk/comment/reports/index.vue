<!-- 举报处理（api_v1_content_comment.v_review_reports + rpc_handle_report）
  覆盖评论/评价两类举报（target_type 区分）；处理：resolved 已处置 / rejected 驳回举报 -->
<template>
  <div class="citywalk-reports-page art-full-height">
    <ArtSearchBar
      v-model="searchKeyword"
      :items="searchItems"
      :rules="{}"
      :span="8"
      :is-expand="true"
      @search="handleSearch"
      @reset="handleReset"
    >
    </ArtSearchBar>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看举报处理（仅管理员可用），请联系管理员"
      />

      <ArtTable
        v-else
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
  import { getReportList, handleReport } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkReports' })

  type Report = Api.Citywalk.ReviewReport

  const searchKeyword = ref({ status: 'pending', targetType: '' })
  const applied = ref({ status: 'pending', targetType: '' })

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Report[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const statusOptions = [
    { label: '待处理', value: 'pending' },
    { label: '已处置', value: 'resolved' },
    { label: '已驳回', value: 'rejected' }
  ]
  const targetOptions = [
    { label: '评论', value: 'comment' },
    { label: '评价', value: 'review' }
  ]

  const searchItems = computed(() => [
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { placeholder: '全部', options: statusOptions, clearable: true }
    },
    {
      label: '目标类型',
      key: 'targetType',
      type: 'select',
      props: { placeholder: '全部', options: targetOptions, clearable: true }
    }
  ])

  const getData = async () => {
    loading.value = true
    try {
      const result = await getReportList({
        status: applied.value.status || undefined,
        targetType: applied.value.targetType || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      permissionDenied.value = false
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      if (error instanceof PostgrestRequestError && error.code === '42501') {
        permissionDenied.value = true
      } else {
        console.error('获取举报列表失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: any) => {
    applied.value = { status: params.status || '', targetType: params.targetType || '' }
    pagination.current = 1
    getData()
  }
  const handleReset = () => {
    applied.value = { status: '', targetType: '' }
    searchKeyword.value = { status: '', targetType: '' }
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

  const doHandle = async (row: Report, status: 'resolved' | 'rejected') => {
    const tip =
      status === 'resolved'
        ? '确认处置该举报？（对应内容如需隐藏，请到评论/评价管理页操作）'
        : '确认驳回该举报？（判定举报不成立）'
    let remark = ''
    try {
      const { value } = await ElMessageBox.prompt(
        tip,
        status === 'resolved' ? '处置举报' : '驳回举报',
        {
          type: 'warning',
          inputPlaceholder: '处理说明（可选）',
          inputValidator: () => true
        }
      )
      remark = value || ''
    } catch {
      return
    }
    try {
      await handleReport(row.id, status, remark || undefined)
      ElMessage.success(status === 'resolved' ? '已处置' : '已驳回')
      getData()
    } catch (error) {
      console.error('处理举报失败:', error)
    }
  }

  const statusTagType = (status: string | null) => {
    if (status === 'resolved') return 'success'
    if (status === 'rejected') return 'info'
    return 'warning'
  }
  const statusLabel = (status: string | null) => {
    const map: Record<string, string> = {
      pending: '待处理',
      resolved: '已处置',
      rejected: '已驳回'
    }
    return map[status || ''] || status || '-'
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<Report>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'target_type',
      label: '目标类型',
      width: 90,
      formatter: (row) =>
        h(ElTag, { size: 'small', effect: 'plain' }, () =>
          row.target_type === 'review' ? '评价' : row.target_type || '-'
        )
    },
    {
      prop: 'reason_type',
      label: '举报原因',
      width: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.reason_type || '-'
    },
    {
      prop: 'description',
      label: '举报说明',
      minWidth: 200,
      showOverflowTooltip: true,
      formatter: (row) => row.description || '-'
    },
    {
      prop: 'target_id',
      label: '目标 ID',
      width: 130,
      showOverflowTooltip: true,
      formatter: (row) => row.target_id || '-'
    },
    {
      prop: 'reporter_id',
      label: '举报人',
      width: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.reporter_id || '-'
    },
    {
      prop: 'status',
      label: '状态',
      width: 90,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
    },
    {
      prop: 'handler_remark',
      label: '处理说明',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.handler_remark || '-'
    },
    {
      prop: 'created_at',
      label: '举报时间',
      width: 160,
      formatter: (row) => formatTime(row.created_at)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 140,
      fixed: 'right',
      formatter: (row) => {
        if (row.status !== 'pending') return '-'
        return h('div', null, [
          h(
            ElButton,
            {
              type: 'success',
              link: true,
              size: 'small',
              onClick: () => doHandle(row, 'resolved')
            },
            () => '处置'
          ),
          h(
            ElButton,
            { type: 'info', link: true, size: 'small', onClick: () => doHandle(row, 'rejected') },
            () => '驳回'
          )
        ])
      }
    }
  ])

  onMounted(getData)
</script>
