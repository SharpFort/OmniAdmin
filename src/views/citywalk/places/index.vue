<!-- 景点管理（v_pois_admin：admin 端全状态列表，含 PendingReview/Archived）
  定位：数据准备阶段的 places 基础集管理——匹配管道 ingest_new 产出的 PendingReview
  景点在此浏览核查；状态流转 RPC 待后端补（change_post_status 是帖子状态，不适用） -->
<template>
  <div class="citywalk-places-page art-full-height">
    <PlacesSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看景点管理（仅管理员可用），请联系管理员"
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

    <PlaceDetailDrawer v-model="detailVisible" :place="detailRow" />
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getPlacesAdminList } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import PlacesSearch from './modules/places-search.vue'
  import PlaceDetailDrawer from './modules/place-detail-drawer.vue'
  import { ElTag, ElButton } from 'element-plus'

  defineOptions({ name: 'CitywalkPlaces' })

  type Place = Api.Citywalk.Place

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ keyword: '', status: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Place[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getPlacesAdminList({
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
        data.value = []
        pagination.total = 0
      } else {
        console.error('获取景点列表失败:', error)
        data.value = []
        pagination.total = 0
      }
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

  // 详情抽屉
  const detailVisible = ref(false)
  const detailRow = ref<Place | null>(null)
  const openDetail = (row: Place) => {
    detailRow.value = row
    detailVisible.value = true
  }

  /** 状态着色：Published 绿 / PendingReview 橙 / Archived 灰 */
  const statusTagType = (status: string | null) => {
    if (status === 'Published') return 'success'
    if (status === 'PendingReview') return 'warning'
    return 'info'
  }
  const statusLabel = (status: string | null) => {
    if (status === 'Published') return '已发布'
    if (status === 'PendingReview') return '待审核'
    if (status === 'Archived') return '已归档'
    return status || '-'
  }

  const { columns, columnChecks } = useTableColumns<Place>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'name',
      label: '景点名称',
      minWidth: 180,
      formatter: (row) => row.name || '-'
    },
    {
      prop: 'status',
      label: '状态',
      width: 100,
      formatter: (row) =>
        h(ElTag, { type: statusTagType(row.status), size: 'small' }, () => statusLabel(row.status))
    },
    {
      prop: 'latitude',
      label: '纬度',
      width: 110,
      formatter: (row) => (row.latitude != null ? String(row.latitude) : '-')
    },
    {
      prop: 'longitude',
      label: '经度',
      width: 110,
      formatter: (row) => (row.longitude != null ? String(row.longitude) : '-')
    },
    {
      prop: 'entity_id',
      label: '实体 ID',
      width: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.entity_id || '-'
    },
    {
      prop: 'slug',
      label: 'Slug',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) => row.slug || '（未发布）'
    },
    {
      prop: 'created_at',
      label: '创建时间',
      width: 160,
      formatter: (row) => row.created_at?.replace('T', ' ').slice(0, 19) || '-'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 90,
      fixed: 'right',
      formatter: (row) =>
        h(ElButton, { type: 'primary', link: true, onClick: () => openDetail(row) }, () => '详情')
    }
  ])

  onMounted(getData)
</script>
