<!-- 用户管理页面（v_user_list + search_users；写操作引导至 Logto Console） -->
<template>
  <div class="user-page art-full-height">
    <UserSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refresh">
        <template #left>
          <span class="text-xs opacity-60">用户的新增/删除/禁用在 Logto Console 侧操作</span>
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

      <!-- 编辑资料弹窗 -->
      <UserDialog v-model:visible="dialogVisible" :user-id="currentUserId" @submit="refresh" />

      <!-- 查看角色弹窗 -->
      <UserRolesDialog v-model:visible="roleDialogVisible" :user-id="currentUserId" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getUserList } from '@/api/system-manage'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import UserRolesDialog from './modules/user-roles-dialog.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'User' })

  type UserListItem = Api.Auth.UserListItem

  // 弹窗相关
  const dialogVisible = ref(false)
  const roleDialogVisible = ref(false)
  const currentUserId = ref('')

  // 搜索表单
  const searchForm = ref({
    query: '',
    dept_id: '',
    status: ''
  })

  // 列表数据（手动管理：getUserList 返回 PageResult）
  const loading = ref(false)
  const data = ref<UserListItem[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getUserList({
        query: searchForm.value.query || undefined,
        dept_id: searchForm.value.dept_id || undefined,
        is_active:
          searchForm.value.status === 'active'
            ? true
            : searchForm.value.status === 'inactive'
              ? false
              : undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取用户列表失败:', error)
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const refresh = () => getData()
  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
    getData()
  }
  const handleCurrentChange = (page: number) => {
    pagination.current = page
    getData()
  }

  // 用户状态配置
  const USER_STATUS_CONFIG: Record<string, { type: 'success' | 'warning'; text: string }> = {
    true: { type: 'success', text: '启用' },
    false: { type: 'warning', text: '禁用' }
  }
  const getUserStatusConfig = (isActive: boolean) =>
    USER_STATUS_CONFIG[String(isActive)] || { type: 'info', text: '未知' }

  // 表格列配置
  const { columns, columnChecks } = useTableColumns<UserListItem>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'username', label: '用户名', minWidth: 120 },
    { prop: 'email', label: '邮箱', minWidth: 160, formatter: (row) => row.email || '-' },
    { prop: 'phone', label: '电话', minWidth: 120, formatter: (row) => row.phone || '-' },
    {
      prop: 'organization_name',
      label: '租户/组织',
      minWidth: 120,
      formatter: (row) => row.organization_name || row.tenant_name || '-'
    },
    { prop: 'dept_name', label: '部门', minWidth: 100, formatter: (row) => row.dept_name || '-' },
    {
      prop: 'organizations',
      label: '组织',
      minWidth: 120,
      formatter: (row) => (row.organizations?.length ? row.organizations.join(', ') : '-')
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) => {
        const config = getUserStatusConfig(row.is_active)
        return h(ElTag, { type: config.type }, () => config.text)
      }
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
      width: 160,
      fixed: 'right',
      formatter: (row) =>
        h('div', [
          h(
            'ElButton',
            {
              type: 'primary',
              link: true,
              onClick: () => showRoles(row)
            },
            () => '查看角色'
          ),
          h(
            'ElButton',
            {
              type: 'primary',
              link: true,
              onClick: () => showDialog(row)
            },
            () => '编辑资料'
          )
        ])
    }
  ])

  onMounted(getData)

  // 查看角色弹窗
  const showRoles = (row: UserListItem) => {
    currentUserId.value = row.id
    nextTick(() => {
      roleDialogVisible.value = true
    })
  }

  // 编辑资料弹窗
  const showDialog = (row: UserListItem) => {
    currentUserId.value = row.id
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const handleSearch = (params: any) => {
    Object.assign(searchForm.value, params)
    pagination.current = 1
    getData()
  }

  const resetSearch = () => {
    searchForm.value = { query: '', dept_id: '', status: '' }
    pagination.current = 1
    getData()
  }
</script>
