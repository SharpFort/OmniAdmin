<!-- POI 纠错复审（api_v1_content_feedback.v_poi_update_requests_admin + rpc_review_poi_update_request）
  数据质量闭环：C 端提交景点纠错 → 此处人工复审（通过/驳回），直接服务景点数据准确性 -->
<template>
  <div class="citywalk-poi-updates-page art-full-height">
    <PoiUpdatesSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看 POI 纠错（仅管理员可用），请联系管理员"
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
  import { getPoiUpdateRequests, reviewPoiUpdateRequest } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import PoiUpdatesSearch from './modules/poi-updates-search.vue'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkPoiUpdates' })

  type PoiUpdate = Api.Citywalk.PoiUpdateRequest

  const defaultSearchForm = () => ({ keyword: '', status: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<PoiUpdate[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getPoiUpdateRequests({
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined,
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
        console.error('获取纠错列表失败:', error)
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

  const handleReview = async (row: PoiUpdate, decision: 'Approved' | 'Rejected') => {
    const tip =
      decision === 'Approved'
        ? `通过后将「${row.poi_name || row.poi_id}」的 ${row.field_name} 更新为新值？`
        : `驳回该纠错请求（${row.poi_name || row.poi_id} 的 ${row.field_name}）？`
    try {
      await ElMessageBox.confirm(tip, decision === 'Approved' ? '通过纠错' : '驳回纠错', {
        type: 'warning'
      })
    } catch {
      return
    }
    try {
      await reviewPoiUpdateRequest(row.id, decision)
      ElMessage.success(decision === 'Approved' ? '已通过' : '已驳回')
      getData()
    } catch (error) {
      console.error('复审失败:', error)
    }
  }

  const statusLabel = (v: string) => {
    const map: Record<string, string> = {
      Pending: '待复审',
      Approved: '已通过',
      Rejected: '已驳回'
    }
    return map[v] || v
  }
  const statusTagType = (v: string) => {
    if (v === 'Approved') return 'success'
    if (v === 'Rejected') return 'info'
    return 'warning'
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<PoiUpdate>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'poi_name',
      label: '景点',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.poi_name || row.poi_id
    },
    {
      prop: 'field_name',
      label: '纠错字段',
      width: 120,
      showOverflowTooltip: true
    },
    {
      prop: 'old_value',
      label: '旧值',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.old_value || '（空）'
    },
    {
      prop: 'new_value',
      label: '新值',
      minWidth: 140,
      showOverflowTooltip: true
    },
    {
      prop: 'status',
      label: '状态',
      width: 90,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
    },
    {
      prop: 'ticket_no',
      label: '关联工单',
      width: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.ticket_no || '-'
    },
    {
      prop: 'reviewed_at',
      label: '复审时间',
      width: 160,
      formatter: (row) => formatTime(row.reviewed_at)
    },
    {
      prop: 'created_at',
      label: '提交时间',
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
            {
              type: 'success',
              link: true,
              size: 'small',
              onClick: () => handleReview(row, 'Approved')
            },
            () => '通过'
          ),
          h(
            ElButton,
            {
              type: 'danger',
              link: true,
              size: 'small',
              onClick: () => handleReview(row, 'Rejected')
            },
            () => '驳回'
          )
        ])
      }
    }
  ])

  onMounted(getData)
</script>
