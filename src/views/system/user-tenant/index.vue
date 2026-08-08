<!-- 用户租户管理（v_user_role_detail：用户×组织成员关系投影；只读，成员管理在 Logto Console） -->
<template>
  <div class="user-tenant-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElInput
            v-model="query"
            placeholder="按用户名过滤"
            clearable
            class="w-60"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <ElButton @click="handleSearch">搜索</ElButton>
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

  defineOptions({ name: 'UserTenant' })

  type UserTenantRow = Api.SystemManage.UserTenantRow

  const query = ref('')
  const loading = ref(false)
  const data = ref<UserTenantRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getUserRoleDetail({
        query: query.value || undefined,
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

  const { columns, columnChecks } = useTableColumns<UserTenantRow>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'username', label: '用户名', minWidth: 140 },
    { prop: 'email', label: '邮箱', minWidth: 180, formatter: (row) => row.email || '-' },
    {
      prop: 'tenant_name',
      label: '租户',
      minWidth: 140,
      formatter: (row) => row.tenant_name || '-'
    },
    {
      prop: 'created_at',
      label: '加入时间',
      width: 160,
      formatter: (row) => row.created_at?.replace('T', ' ').slice(0, 19) || '-'
    }
  ])

  onMounted(getData)
</script>
