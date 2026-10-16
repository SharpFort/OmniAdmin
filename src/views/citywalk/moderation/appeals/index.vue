<!-- 申诉处理（api_v1_moderation.v_appeals_admin + rpc_admin_handle_appeal）
  用户对审核结果/处罚的申诉：通过 = 支持申诉（撤销原判），驳回 = 维持原判 -->
<template>
  <div class="citywalk-appeals-page art-full-height">
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
        title="无权限查看申诉处理（仅管理员可用），请联系管理员"
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
  import { getAppealsAdminList, handleAppeal } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkAppeals' })

  type Appeal = Api.Citywalk.Appeal

  const searchKeyword = ref({ status: 'Pending' })
  const applied = ref({ status: 'Pending' })

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Appeal[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const statusOptions = [
    { label: '待处理', value: 'Pending' },
    { label: '已通过', value: 'Approved' },
    { label: '已驳回', value: 'Rejected' }
  ]

  const searchItems = computed(() => [
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { placeholder: '全部', options: statusOptions, clearable: true }
    }
  ])

  const getData = async () => {
    loading.value = true
    try {
      const result = await getAppealsAdminList({
        status: applied.value.status || undefined,
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
        console.error('获取申诉列表失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: any) => {
    applied.value = { status: params.status || '' }
    pagination.current = 1
    getData()
  }
  const handleReset = () => {
    applied.value = { status: '' }
    searchKeyword.value = { status: '' }
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

  const doHandle = async (row: Appeal, isApproved: boolean) => {
    const tip = isApproved
      ? '支持该申诉（原审核结果/处罚将被撤销）？'
      : '驳回该申诉（维持原审核结果/处罚）？'
    try {
      await ElMessageBox.confirm(tip, isApproved ? '支持申诉' : '驳回申诉', { type: 'warning' })
    } catch {
      return
    }
    try {
      await handleAppeal(row.id, isApproved)
      ElMessage.success(isApproved ? '已支持申诉' : '已驳回申诉')
      getData()
    } catch (error) {
      console.error('处理申诉失败:', error)
    }
  }

  const statusTagType = (status: string) => {
    if (status === 'Approved') return 'success'
    if (status === 'Rejected') return 'info'
    return 'warning'
  }
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      Pending: '待处理',
      Approved: '已通过',
      Rejected: '已驳回'
    }
    return map[status] || status
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<Appeal>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'appeal_reason',
      label: '申诉原因',
      minWidth: 240,
      showOverflowTooltip: true
    },
    {
      prop: 'submitter_user_id',
      label: '申诉人',
      width: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.submitter_user_id || '-'
    },
    {
      prop: 'target_type',
      label: '涉及内容',
      width: 100,
      formatter: (row) =>
        row.target_type
          ? h(ElTag, { size: 'small', effect: 'plain' }, () => row.target_type as string)
          : '-'
    },
    {
      prop: 'audit_status',
      label: '原审核结果',
      width: 100,
      formatter: (row) => row.audit_status || '-'
    },
    {
      prop: 'penalty_type',
      label: '涉及处罚',
      width: 100,
      showOverflowTooltip: true,
      formatter: (row) => row.penalty_type || '（无）'
    },
    {
      prop: 'status',
      label: '申诉状态',
      width: 90,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
    },
    {
      prop: 'created_at',
      label: '申诉时间',
      width: 160,
      formatter: (row) => formatTime(row.created_at)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 130,
      fixed: 'right',
      formatter: (row) => {
        if (row.status !== 'Pending') return '-'
        return h('div', null, [
          h(
            ElButton,
            { type: 'success', link: true, size: 'small', onClick: () => doHandle(row, true) },
            () => '支持'
          ),
          h(
            ElButton,
            { type: 'danger', link: true, size: 'small', onClick: () => doHandle(row, false) },
            () => '驳回'
          )
        ])
      }
    }
  ])

  onMounted(getData)
</script>
