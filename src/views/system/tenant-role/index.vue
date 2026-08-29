<!-- 组织角色管理（tenant_role 视图 = Logto organization_roles 镜像，只读；管理在 Logto Console） -->
<template>
  <div class="tenant-role-page art-full-height">
    <TenantRoleSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <span class="text-xs opacity-60"
            >组织角色为 Logto organization_roles 镜像，仅查看；新增/删除/改名在 Logto Console
            侧操作</span
          >
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
  import { getTenantRoleList } from '@/api/system-manage'
  import { ElTag } from 'element-plus'
  import TenantRoleSearch from './modules/tenant-role-search.vue'

  defineOptions({ name: 'TenantRole' })

  type TenantRoleItem = Api.SystemManage.TenantRoleItem

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<TenantRoleItem[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getTenantRoleList({
        query: searchForm.value.query || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取组织角色列表失败:', error)
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

  // 组织角色类型（Logto organization_roles.type；常见 role/administration，未知值原样展示）
  const typeText = (type: string | null) => {
    const map: Record<string, string> = { role: '普通角色', administration: '管理角色' }
    return (type && map[type]) || type || '-'
  }

  const { columns, columnChecks } = useTableColumns<TenantRoleItem>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'role_code', label: '角色编码', minWidth: 160 },
    { prop: 'role_name', label: '角色名称', minWidth: 140 },
    {
      prop: 'type',
      label: '类型',
      width: 110,
      align: 'center',
      formatter: (row) => typeText(row.type)
    },
    {
      prop: 'description',
      label: '描述',
      minWidth: 200,
      formatter: (row) => row.description || '-'
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) =>
        h(ElTag, { type: row.is_active ? 'success' : 'warning' }, () =>
          row.is_active ? '启用' : '停用'
        )
    }
  ])

  onMounted(getData)
</script>
