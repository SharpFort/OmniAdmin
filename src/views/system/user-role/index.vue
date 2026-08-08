<!-- 用户角色管理（v_user_roles：用户×角色分配镜像；⚠️ 仅超管完整，角色分配在 Logto Console） -->
<template>
  <div class="user-role-page art-full-height">
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

  defineOptions({ name: 'UserRole' })

  type UserRoleRow = Api.Auth.UserRoleRow

  const query = ref('')
  const loading = ref(false)
  const data = ref<UserRoleRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getUserRoles({
        query: query.value || undefined,
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
      prop: 'assigned_at',
      label: '分配时间',
      width: 160,
      formatter: (row) => row.assigned_at?.replace('T', ' ').slice(0, 19) || '-'
    }
  ])

  onMounted(getData)
</script>
