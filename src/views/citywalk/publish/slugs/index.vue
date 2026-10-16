<!-- Slug 发布管理（api_v1_public：place_slugs 浏览 + 换绑发布/下线 + 301 重定向列表） -->
<template>
  <div class="citywalk-slugs-page art-full-height">
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
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshAll" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看 Slug 管理（仅管理员可用），请联系管理员"
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

    <!-- 301 重定向（换绑历史） -->
    <ElCard shadow="never" class="mt-3">
      <template #header>
        <span class="card-header-title">301 重定向（slug 换绑历史，命中自动计数）</span>
      </template>
      <ElTable :data="redirects" size="small" border max-height="280">
        <ElTableColumn prop="old_slug" label="旧 Slug" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="new_entity_type" label="目标类型" width="100" />
        <ElTableColumn label="命中次数" width="90">
          <template #default="{ row }">{{ row.hit_count ?? 0 }}</template>
        </ElTableColumn>
        <ElTableColumn label="最近命中" width="160">
          <template #default="{ row }">{{ formatTime(row.last_hit_at) }}</template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getPlaceSlugs, getUrlRedirects, publishPlaceSlug, deletePlaceSlug } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkSlugs' })

  type PlaceSlug = Api.Citywalk.PlaceSlug

  const searchKeyword = ref({ keyword: '', onlyActive: false })
  const applied = ref({ keyword: '', onlyActive: false })

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<PlaceSlug[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const boolOptions = [
    { label: '是', value: 'true' },
    { label: '否', value: 'false' }
  ]

  const searchItems = computed(() => [
    {
      label: 'Slug',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配，如 yi-he-yuan',
      clearable: true
    },
    {
      label: '仅看生效',
      key: 'onlyActive',
      type: 'select',
      props: { placeholder: '不限', options: boolOptions, clearable: true }
    }
  ])

  const getData = async () => {
    loading.value = true
    try {
      const result = await getPlaceSlugs({
        keyword: applied.value.keyword || undefined,
        onlyActive: applied.value.onlyActive || undefined,
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
        console.error('获取 Slug 列表失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: any) => {
    applied.value = { keyword: params.keyword || '', onlyActive: params.onlyActive === 'true' }
    pagination.current = 1
    getData()
  }
  const handleReset = () => {
    applied.value = { keyword: '', onlyActive: false }
    searchKeyword.value = { keyword: '', onlyActive: false }
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
  // 换绑 / 下线
  // ------------------------------------------------------------------
  const handleRepublish = async (row: PlaceSlug) => {
    let newSlug = ''
    try {
      const { value } = await ElMessageBox.prompt(
        `为「${row.place_name || row.place_id}」换绑新 Slug（旧 Slug ${row.slug_value} 自动 301）`,
        '换绑 Slug',
        {
          type: 'warning',
          inputValue: row.slug_value,
          inputValidator: (v: string) => (v && v.trim() ? true : 'Slug 不能为空')
        }
      )
      newSlug = value.trim()
    } catch {
      return
    }
    try {
      await publishPlaceSlug(row.place_id, newSlug)
      ElMessage.success('换绑完成（旧 Slug 已建立 301）')
      refreshAll()
    } catch (error) {
      console.error('换绑失败:', error)
    }
  }

  const handleOffline = async (row: PlaceSlug) => {
    try {
      await ElMessageBox.confirm(
        `下线 Slug「${row.slug_value}」？（软删除：is_active=FALSE，主标记清除）`,
        '下线 Slug',
        { type: 'warning' }
      )
    } catch {
      return
    }
    try {
      await deletePlaceSlug(row.id)
      ElMessage.success('已下线')
      refreshAll()
    } catch (error) {
      console.error('下线失败:', error)
    }
  }

  // ------------------------------------------------------------------
  // 重定向列表
  // ------------------------------------------------------------------
  const redirects = ref<Api.Citywalk.UrlRedirect[]>([])
  const loadRedirects = async () => {
    try {
      const result = await getUrlRedirects({ limit: 50, offset: 0 })
      redirects.value = result.items
    } catch (error) {
      console.warn('加载重定向失败:', error)
      redirects.value = []
    }
  }
  const refreshAll = () => {
    getData()
    loadRedirects()
  }

  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<PlaceSlug>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'slug_value', label: 'Slug', minWidth: 160, showOverflowTooltip: true },
    {
      prop: 'place_name',
      label: '景点',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.place_name || '-'
    },
    {
      prop: 'place_entity_id',
      label: '实体 ID',
      width: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.place_entity_id || '-'
    },
    {
      prop: 'language_code',
      label: '语言',
      width: 80,
      formatter: (row) => row.language_code || '-'
    },
    {
      prop: 'is_primary',
      label: '主 Slug',
      width: 80,
      formatter: (row) =>
        row.is_primary ? h(ElTag, { size: 'small', type: 'primary' }, () => '主') : '-'
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: row.is_active ? 'success' : 'info' }, () =>
          row.is_active ? '生效' : '已下线'
        )
    },
    {
      prop: 'published_at',
      label: '发布时间',
      width: 160,
      formatter: (row) => formatTime(row.published_at)
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
            { type: 'primary', link: true, size: 'small', onClick: () => handleRepublish(row) },
            () => '换绑'
          ),
          row.is_active
            ? h(
                ElButton,
                { type: 'danger', link: true, size: 'small', onClick: () => handleOffline(row) },
                () => '下线'
              )
            : null
        ])
    }
  ])

  onMounted(refreshAll)
</script>

<style lang="scss" scoped>
  .card-header-title {
    font-size: 13px;
    font-weight: 600;
  }
</style>
