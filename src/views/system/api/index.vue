<!-- API 权限点管理（iam_api 视图；只读列表 + 关键词过滤；无写路径） -->
<template>
  <div class="api-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElInput
            v-model="query"
            placeholder="按名称/路径/编码过滤"
            clearable
            class="w-60"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <ElButton @click="handleSearch">搜索</ElButton>
        </template>
      </ArtTableHeader>

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
  import { getApiList } from '@/api/system-manage'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'Api' })

  type ApiItem = Api.SystemManage.ApiItem

  const query = ref('')
  const loading = ref(false)
  const data = ref<ApiItem[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getApiList({
        query: query.value || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取 API 列表失败:', error)
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
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

  const { columns, columnChecks } = useTableColumns<ApiItem>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'api_code', label: '权限编码', minWidth: 140, formatter: (row) => row.api_code || '-' },
    { prop: 'name', label: '名称', minWidth: 140, formatter: (row) => row.name || '-' },
    {
      prop: 'method',
      label: '方法',
      width: 90,
      formatter: (row) => h(ElTag, { type: 'info', size: 'small' }, () => row.method)
    },
    { prop: 'path', label: '路径', minWidth: 200 },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) =>
        h(ElTag, { type: row.is_active ? 'success' : 'warning' }, () =>
          row.is_active ? '启用' : '禁用'
        )
    }
  ])

  onMounted(getData)
</script>
