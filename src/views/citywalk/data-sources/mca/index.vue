<!-- MCA 数据源概览（v_place_names_stats 汇总 + v_place_names_by_province 分布 + v_place_names_admin 浏览）
  定位：数据准备阶段的导入验收面板——导入是否到位、覆盖如何、哪些记录还没进匹配管道 -->
<template>
  <div class="citywalk-mca-page art-full-height">
    <!-- 汇总统计卡片 -->
    <ElRow :gutter="12" class="mb-3">
      <ElCol v-for="card in statCards" :key="card.label" :span="6" :xs="12">
        <ElCard shadow="never" class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ stats ? (stats[card.key] ?? 0).toLocaleString() : '…' }}</div>
          <div v-if="card.tip" class="stat-tip">{{ card.tip }}</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- 按省分布（首跑试水选省依据） -->
    <ElCard shadow="never" class="mb-3">
      <template #header>
        <div class="card-header">
          <span>按省分布（试水选省 / 分批匹配依据）</span>
          <span v-if="stats?.last_source_file" class="text-secondary">
            最近导入：{{ stats.last_source_file }}（{{ formatTime(stats.last_imported_at) }}）
          </span>
        </div>
      </template>
      <ElTable :data="provinceRows" size="small" max-height="260" border>
        <ElTableColumn type="index" width="50" label="#" />
        <ElTableColumn prop="province_name" label="省份" min-width="130" />
        <ElTableColumn prop="total" label="地名数" width="110" sortable />
        <ElTableColumn prop="with_origin" label="含来历文本" width="110" />
        <ElTableColumn prop="with_coords" label="含坐标" width="100" />
        <ElTableColumn prop="district_count" label="覆盖区县" width="100" />
      </ElTable>
    </ElCard>

    <!-- 镜像数据浏览 -->
    <McaSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />
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

    <!-- 地名详情抽屉（来历/含义/沿革长文本） -->
    <ElDrawer
      :model-value="detailVisible"
      :title="detailRow?.standard_name || '地名详情'"
      size="480px"
      @update:model-value="detailVisible = $event"
    >
      <el-descriptions v-if="detailRow" :column="1" border size="small">
        <el-descriptions-item label="标准地名">{{ detailRow.standard_name }}</el-descriptions-item>
        <el-descriptions-item label="曾用名">{{ detailRow.old_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="罗马拼写">
          {{ detailRow.roman_alphabet_spelling || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="地名代码">{{ detailRow.place_code }}</el-descriptions-item>
        <el-descriptions-item label="行政区划">
          {{ detailRow.province_name || '-' }} / {{ detailRow.city_name || '-' }} /
          {{ detailRow.district_name || '-' }}（{{ detailRow.district_code || '-' }}）
        </el-descriptions-item>
        <el-descriptions-item label="类别">
          {{ detailRow.place_type || '-' }}（{{ detailRow.place_type_code || '-' }}）
        </el-descriptions-item>
        <el-descriptions-item label="坐标">
          {{ detailRow.latitude ?? '-' }}, {{ detailRow.longitude ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="匹配管道">
          {{
            detailRow.already_bound
              ? '已绑定 place'
              : detailRow.has_open_match
                ? '队列待审中'
                : '未进入匹配'
          }}
        </el-descriptions-item>
        <el-descriptions-item label="来源快照">
          {{ detailRow.source_file || '-' }}（{{ formatTime(detailRow.imported_at) }}）
        </el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">地名来历</el-divider>
      <p class="long-text">{{ detailRow?.place_origin || '（无）' }}</p>
      <el-divider content-position="left">地名含义</el-divider>
      <p class="long-text">{{ detailRow?.place_meaning || '（无）' }}</p>
      <el-divider content-position="left">历史沿革</el-divider>
      <p class="long-text">{{ detailRow?.place_history || '（无）' }}</p>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getPlaceNamesStats, getPlaceNamesByProvince, getPlaceNamesList } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import McaSearch from './modules/mca-search.vue'
  import { ElTag, ElButton } from 'element-plus'

  defineOptions({ name: 'CitywalkMcaData' })

  type PlaceName = Api.Citywalk.PlaceName

  // ------------------------------------------------------------------
  // 汇总 + 按省分布
  // ------------------------------------------------------------------
  const stats = ref<Api.Citywalk.PlaceNamesStats | null>(null)
  const provinceRows = ref<Api.Citywalk.PlaceNamesByProvince[]>([])

  const loadStats = async () => {
    try {
      const [s, p] = await Promise.all([getPlaceNamesStats(), getPlaceNamesByProvince()])
      stats.value = s
      provinceRows.value = p
    } catch (error) {
      if (!(error instanceof PostgrestRequestError && error.code === '42501')) {
        console.error('加载 MCA 统计失败:', error)
      }
    }
  }

  type StatKey = 'total' | 'with_origin' | 'with_coords' | 'province_count'
  interface StatCard {
    key: StatKey
    label: string
    tip: string
  }

  const statCards = computed<StatCard[]>(() => [
    { key: 'total', label: '镜像地名总数', tip: 'place_names 全量' },
    {
      key: 'with_origin',
      label: '含来历文本',
      tip: stats.value
        ? `占比 ${((stats.value.with_origin / Math.max(stats.value.total, 1)) * 100).toFixed(1)}%`
        : ''
    },
    {
      key: 'with_coords',
      label: '含坐标',
      tip: stats.value
        ? `占比 ${((stats.value.with_coords / Math.max(stats.value.total, 1)) * 100).toFixed(1)}%`
        : ''
    },
    {
      key: 'province_count',
      label: '覆盖省份数',
      tip: `覆盖区县 ${stats.value?.district_count ?? '-'} 个`
    }
  ])

  // ------------------------------------------------------------------
  // 镜像浏览列表
  // ------------------------------------------------------------------
  const defaultSearchForm = () => ({
    keyword: '',
    province: '',
    hasDetail: false,
    onlyUnbound: false
  })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<PlaceName[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getPlaceNamesList({
        keyword: searchForm.value.keyword || undefined,
        province: searchForm.value.province || undefined,
        hasDetail: searchForm.value.hasDetail || undefined,
        onlyUnbound: searchForm.value.onlyUnbound || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      if (!(error instanceof PostgrestRequestError && error.code === '42501')) {
        console.error('获取镜像数据失败:', error)
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

  // 详情抽屉
  const detailVisible = ref(false)
  const detailRow = ref<PlaceName | null>(null)
  const openDetail = (row: PlaceName) => {
    detailRow.value = row
    detailVisible.value = true
  }

  const formatTime = (time: string | null) => time?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<PlaceName>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'standard_name',
      label: '标准地名',
      minWidth: 150,
      formatter: (row) =>
        h('span', null, [
          row.standard_name,
          row.old_name
            ? h('span', { class: 'text-secondary' }, `（曾用名：${row.old_name}）`)
            : null
        ])
    },
    {
      prop: 'province_name',
      label: '省',
      width: 90,
      formatter: (row) => row.province_name || '-'
    },
    {
      prop: 'city_name',
      label: '市',
      width: 100,
      showOverflowTooltip: true,
      formatter: (row) => row.city_name || '-'
    },
    {
      prop: 'district_name',
      label: '区县',
      width: 100,
      showOverflowTooltip: true,
      formatter: (row) => row.district_name || '-'
    },
    {
      prop: 'place_type',
      label: '类别',
      width: 80,
      formatter: (row) => row.place_type || '-'
    },
    {
      prop: 'place_origin',
      label: '来历文本',
      width: 90,
      formatter: (row) =>
        h(
          ElTag,
          { size: 'small', type: row.place_origin ? 'success' : 'info', effect: 'plain' },
          () => (row.place_origin ? '有' : '无')
        )
    },
    {
      prop: 'already_bound',
      label: '管道状态',
      width: 100,
      formatter: (row) =>
        h(
          ElTag,
          {
            size: 'small',
            type: row.already_bound ? 'success' : row.has_open_match ? 'warning' : 'info',
            effect: 'plain'
          },
          () => (row.already_bound ? '已绑定' : row.has_open_match ? '待审中' : '未匹配')
        )
    },
    {
      prop: 'imported_at',
      label: '导入时间',
      width: 160,
      formatter: (row) => formatTime(row.imported_at)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 90,
      fixed: 'right',
      formatter: (row) =>
        h(
          ElButton,
          { type: 'primary', link: true, size: 'small', onClick: () => openDetail(row) },
          () => '详情'
        )
    }
  ])

  onMounted(() => {
    loadStats()
    getData()
  })
</script>

<style lang="scss" scoped>
  .stat-card {
    .stat-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
    .stat-value {
      font-size: 22px;
      font-weight: 600;
      margin: 6px 0 2px;
    }
    .stat-tip {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  .text-secondary {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  .long-text {
    font-size: 13px;
    line-height: 1.8;
    white-space: pre-wrap;
    color: var(--el-text-color-regular);
  }
</style>
