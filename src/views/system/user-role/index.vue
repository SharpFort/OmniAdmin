<!-- 用户角色管理（v_user_roles：用户×角色分配镜像；⚠️ 仅超管完整，角色分配在 Logto Console） -->
<template>
  <div class="user-role-page art-full-height">
    <UserRoleSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <span class="text-xs opacity-60"
            >用户与角色的分配关系（仅超级管理员可见完整数据），分配在 Logto Console 侧操作</span
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
  import { getUserRoles } from '@/api/system-manage'
  import UserRoleSearch from './modules/user-role-search.vue'

  defineOptions({ name: 'UserRole' })

  type UserRoleRow = Api.Auth.UserRoleRow

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '', role_code: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<UserRoleRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getUserRoles({
        query: searchForm.value.query || undefined,
        roleCode: searchForm.value.role_code || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      // 过滤 LEFT JOIN 产生的空角色行（未分配角色的用户）
      data.value = result.items.filter((row) => row.role_code)
      pagination.total = result.total
    } catch (error) {
      console.error('获取用户角色列表失败:', error)
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

  const { columns, columnChecks } = useTableColumns<UserRoleRow>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'username', label: '用户名', minWidth: 140 },
    { prop: 'email', label: '邮箱', minWidth: 180, formatter: (row) => row.email || '-' },
    {
      prop: 'role_code',
      label: '角色编码',
      minWidth: 160,
      formatter: (row) => row.role_code || '-'
    },
    {
      prop: 'organization_id',
      label: '归属段',
      minWidth: 140,
      formatter: (row) => (row.organization_id ? row.organization_id : '全局')
    }
  ])

  onMounted(getData)
</script>
