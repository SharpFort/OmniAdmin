<!-- 用户租户管理（v_user_role_detail：用户×组织成员关系投影；只读，成员管理在 Logto Console） -->
<template>
  <div class="user-tenant-page art-full-height">
    <UserTenantSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <span class="text-xs opacity-60"
            >用户与租户（组织）的成员关系，新增/移除在 Logto Console 侧操作</span
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
  import { getUserRoleDetail } from '@/api/tenant'
  import UserTenantSearch from './modules/user-tenant-search.vue'

  defineOptions({ name: 'UserTenant' })

  type UserTenantRow = Api.SystemManage.UserTenantRow

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '', organization_id: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<UserTenantRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getUserRoleDetail({
        query: searchForm.value.query || undefined,
        organizationId: searchForm.value.organization_id || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取用户租户列表失败:', error)
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

  const { columns, columnChecks } = useTableColumns<UserTenantRow>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'username', label: '用户名', minWidth: 140 },
    { prop: 'email', label: '邮箱', minWidth: 180, formatter: (row) => row.email || '-' },
    {
      prop: 'organization_name',
      label: '租户/组织',
      minWidth: 140,
      formatter: (row) => row.organization_name || '-'
    },
    {
      prop: 'tenant_name',
      label: 'Logto 租户',
      minWidth: 110,
      formatter: (row) => row.tenant_name || '-'
    }
  ])

  onMounted(getData)
</script>
