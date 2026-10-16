<!-- 评价管理（api_v1_content_reaction.v_reviews_admin + rpc_moderate_review 单条/批量）
  动作集：publish 发布 / reject 驳回 -->
<template>
  <div class="citywalk-reviews-page art-full-height">
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
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton
            v-if="selectedRows.length"
            size="small"
            type="success"
            :loading="bulkLoading"
            @click="handleBatch('publish')"
          >
            批量发布（{{ selectedRows.length }}）
          </ElButton>
          <ElButton
            v-if="selectedRows.length"
            size="small"
            type="danger"
            :loading="bulkLoading"
            @click="handleBatch('reject')"
          >
            批量驳回
          </ElButton>
        </template>
      </ArtTableHeader>

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看评价管理（仅管理员可用），请联系管理员"
      />

      <ArtTable
        v-else
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
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getReviewsAdminList, moderateReview, batchModerateReviews } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkReviews' })

  type Review = Api.Citywalk.Review

  const searchKeyword = ref({ keyword: '', status: '' })
  const applied = ref({ keyword: '', status: '' })

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Review[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })
  const artTableRef = ref()

  const statusOptions = [
    { label: '待审核', value: 'pending' },
    { label: '已发布', value: 'published' },
    { label: '已驳回', value: 'rejected' }
  ]

  const searchItems = computed(() => [
    {
      label: '评价内容',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配评价内容',
      clearable: true
    },
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
      const result = await getReviewsAdminList({
        keyword: applied.value.keyword || undefined,
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
        console.error('获取评价列表失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: any) => {
    applied.value = { keyword: params.keyword || '', status: params.status || '' }
    pagination.current = 1
    getData()
  }
  const handleReset = () => {
    applied.value = { keyword: '', status: '' }
    searchKeyword.value = { keyword: '', status: '' }
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

  const runAction = async (row: Review, action: 'publish' | 'reject') => {
    const tip = action === 'publish' ? '发布该评价（C 端可见）？' : '驳回该评价（C 端不可见）？'
    try {
      await ElMessageBox.confirm(tip, action === 'publish' ? '发布评价' : '驳回评价', {
        type: 'warning'
      })
    } catch {
      return
    }
    try {
      await moderateReview(row.id, action)
      ElMessage.success(action === 'publish' ? '已发布' : '已驳回')
      getData()
    } catch (error) {
      console.error('审核失败:', error)
    }
  }

  const selectedRows = ref<Review[]>([])
  const bulkLoading = ref(false)
  const handleSelectionChange = (rows: Review[]) => {
    selectedRows.value = rows
  }
  const handleBatch = async (action: 'publish' | 'reject') => {
    try {
      await ElMessageBox.confirm(
        `确认对 ${selectedRows.value.length} 条评价执行「${action === 'publish' ? '发布' : '驳回'}」？`,
        '批量操作',
        { type: 'warning' }
      )
    } catch {
      return
    }
    bulkLoading.value = true
    try {
      await batchModerateReviews(
        selectedRows.value.map((r) => r.id),
        action
      )
      ElMessage.success('批量操作完成')
      artTableRef.value?.elTableRef?.clearSelection()
      selectedRows.value = []
      getData()
    } catch (error) {
      console.error('批量操作失败:', error)
    } finally {
      bulkLoading.value = false
    }
  }

  const statusTagType = (status: string | null) => {
    if (status === 'published') return 'success'
    if (status === 'rejected') return 'info'
    return 'warning'
  }
  const statusLabel = (status: string | null) => {
    const map: Record<string, string> = {
      pending: '待审核',
      published: '已发布',
      rejected: '已驳回'
    }
    return map[status || ''] || status || '-'
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<Review>(() => [
    { type: 'selection', width: 42 },
    {
      prop: 'overall_score',
      label: '评分',
      width: 80,
      formatter: (row) =>
        h(
          ElTag,
          { size: 'small', type: (row.overall_score ?? 0) >= 4 ? 'success' : 'warning' },
          () => (row.overall_score != null ? String(row.overall_score) : '-')
        )
    },
    {
      prop: 'title',
      label: '标题',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.title || '-'
    },
    {
      prop: 'content',
      label: '评价内容',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.content || '-'
    },
    {
      prop: 'entity_type',
      label: '实体类型',
      width: 95,
      formatter: (row) => row.entity_type || '-'
    },
    {
      prop: 'entity_id',
      label: '实体 ID',
      width: 130,
      showOverflowTooltip: true,
      formatter: (row) => row.entity_id || '-'
    },
    {
      prop: 'is_anonymous',
      label: '匿名',
      width: 65,
      formatter: (row) => (row.is_anonymous ? '是' : '否')
    },
    {
      prop: 'is_recommended',
      label: '推荐',
      width: 65,
      formatter: (row) => (row.is_recommended ? '是' : '否')
    },
    {
      prop: 'helpful_count',
      label: '有用',
      width: 65,
      formatter: (row) => row.helpful_count ?? 0
    },
    {
      prop: 'status',
      label: '状态',
      width: 85,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
    },
    {
      prop: 'created_at',
      label: '发布时间',
      width: 160,
      formatter: (row) => formatTime(row.created_at)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 130,
      fixed: 'right',
      formatter: (row) =>
        h('div', null, [
          h(
            ElButton,
            {
              type: 'success',
              link: true,
              size: 'small',
              onClick: () => runAction(row, 'publish')
            },
            () => '发布'
          ),
          h(
            ElButton,
            { type: 'danger', link: true, size: 'small', onClick: () => runAction(row, 'reject') },
            () => '驳回'
          )
        ])
    }
  ])

  onMounted(getData)
</script>
