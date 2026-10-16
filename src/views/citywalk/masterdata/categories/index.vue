<!-- 分类浏览（api_v1_masterdata.v_categories：五级编码分类树，只读）
  数据准备相关：places.category_id 与 osm.category_map 的映射目标体系，运营查阅用 -->
<template>
  <div class="citywalk-categories-page art-full-height">
    <ArtSearchBar
      v-model="searchKeyword"
      :items="searchItems"
      :rules="{}"
      :span="10"
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
        title="无权限查看分类数据，请联系管理员"
      />

      <ArtTable
        v-else
        :loading="loading"
        :data="pagedTree"
        :columns="columns"
        row-key="id"
        :tree-props="{ children: 'children' }"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getCategoriesList } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'CitywalkCategories' })

  type Category = Api.Citywalk.Category

  // 一次拉全量（五级编码分类为有限集），客户端组树 + 关键词过滤 + 顶层分页
  const allRows = ref<Category[]>([])
  const treeRows = ref<Category[]>([])
  const loading = ref(false)
  const permissionDenied = ref(false)
  const pagination = reactive({ current: 1, size: 50, total: 0 })

  const searchKeyword = ref({ keyword: '' })
  const appliedKeyword = ref('')

  const searchItems = computed(() => [
    {
      label: '分类名',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配，如 公园 / 博物馆',
      clearable: true
    }
  ])

  const getData = async () => {
    loading.value = true
    try {
      const rows = await getCategoriesList({ keyword: appliedKeyword.value || undefined })
      permissionDenied.value = false
      allRows.value = rows
      buildTree(rows)
    } catch (error) {
      if (error instanceof PostgrestRequestError && error.code === '42501') {
        permissionDenied.value = true
      } else {
        console.error('获取分类失败:', error)
      }
      allRows.value = []
      buildTree([])
    } finally {
      loading.value = false
    }
  }

  /** 扁平 → 树（parent_id 关联；过滤态下命中节点的父链保留） */
  const buildTree = (rows: Category[]) => {
    const map = new Map<string, Category>()
    rows.forEach((r) => map.set(r.id, { ...r, children: undefined }))
    const roots: Category[] = []
    rows.forEach((r) => {
      const node = map.get(r.id)!
      if (r.parent_id && map.has(r.parent_id)) {
        const parent = map.get(r.parent_id)!
        ;(parent.children = parent.children || []).push(node)
      } else {
        roots.push(node)
      }
    })
    treeRows.value = roots
    pagination.total = roots.length
    pagination.current = 1
  }

  const handleSearch = (params: any) => {
    appliedKeyword.value = params.keyword || ''
    getData()
  }
  const handleReset = () => {
    appliedKeyword.value = ''
    getData()
  }
  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
  }
  const handleCurrentChange = (page: number) => {
    pagination.current = page
  }
  const pagedTree = computed(() =>
    treeRows.value.slice(
      (pagination.current - 1) * pagination.size,
      pagination.current * pagination.size
    )
  )

  type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
  const levelTagType = (level: number): TagType => {
    const map: Record<number, TagType> = { 1: 'primary', 2: 'success', 3: 'warning', 4: 'danger' }
    return map[level] || 'info'
  }

  const { columns, columnChecks } = useTableColumns<Category>(() => [
    { prop: 'name', label: '分类名', minWidth: 240 },
    {
      prop: 'full_code',
      label: '全编码',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'level',
      label: '层级',
      width: 80,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: levelTagType(row.level), effect: 'plain' }, () =>
          String(row.level)
        )
    },
    {
      prop: 'standard_name',
      label: '分类标准',
      minWidth: 130,
      showOverflowTooltip: true
    },
    {
      prop: 'slug',
      label: 'Slug',
      minWidth: 130,
      showOverflowTooltip: true,
      formatter: (row) => row.slug || '-'
    },
    {
      prop: 'content',
      label: '说明',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => row.content || row.remark || '-'
    },
    {
      prop: 'updated_at',
      label: '更新时间',
      width: 160,
      formatter: (row) => row.updated_at?.replace('T', ' ').slice(0, 19) || '-'
    }
  ])

  onMounted(getData)
</script>
