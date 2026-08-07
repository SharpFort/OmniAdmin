<!-- 用户管理页面 -->
<template>
  <div class="user-page art-full-height">
    <!-- 搜索栏 -->
    <UserSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <!-- 表格头部 -->
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refresh">
        <template #left>
          <ElSpace wrap>
            <ElButton @click="showDialog('add')" v-ripple>新增用户</ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- 表格 -->
      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <!-- 用户弹窗 -->
      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUserData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { usePostgrestTable } from '@/hooks/core/usePostgrestTable'
  import { fetchGetUserList } from '@/api/system-manage'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'User' })

  type UserListItem = Api.SystemManage.UserListItem

  // 弹窗相关
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserListItem>>({})

  // 选中行
  const selectedRows = ref<UserListItem[]>([])

  // 搜索表单
  const searchForm = ref({
    query: '',
    dept_id: '',
    status: ''
  })

  // 用户状态配置
  const USER_STATUS_CONFIG: Record<string, { type: 'success' | 'warning'; text: string }> = {
    true: { type: 'success', text: '启用' },
    false: { type: 'warning', text: '禁用' }
  }

  const getUserStatusConfig = (isActive: boolean) => {
    return USER_STATUS_CONFIG[String(isActive)] || { type: 'info', text: '未知' }
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    refresh,
    handleSizeChange,
    handleCurrentChange,
    search: tableSearch,
    resetSearch: tableResetSearch
  } = usePostgrestTable<UserListItem>({
    apiFn: fetchGetUserList,
    columnsFactory: () => [
      { type: 'selection' },
      { type: 'index', width: 60, label: '序号' },
      {
        prop: 'username',
        label: '用户名',
        minWidth: 120
      },
      { prop: 'email', label: '邮箱', minWidth: 160 },
      { prop: 'phone', label: '电话', minWidth: 120 },
      { prop: 'tenant_name', label: '租户', minWidth: 100 },
      { prop: 'dept_name', label: '部门', minWidth: 100 },
      {
        prop: 'roles',
        label: '角色',
        minWidth: 150,
        formatter: (row) => {
          if (!row.roles || !row.roles.length) return '-'
          return row.roles.join(', ')
        }
      },
      {
        prop: 'is_active',
        label: '状态',
        width: 80,
        formatter: (row) => {
          const statusConfig = getUserStatusConfig(row.is_active)
          return h(ElTag, { type: statusConfig.type }, () => statusConfig.text)
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
        width: 150,
        fixed: 'right',
        formatter: (row) =>
          h('div', [
            h(
              'ElButton',
              {
                type: 'primary',
                link: true,
                onClick: () => showDialog('edit', row)
              },
              () => '编辑'
            ),
            h(
              'ElButton',
              {
                type: 'danger',
                link: true,
                onClick: () => deleteUser(row)
              },
              () => '删除'
            )
          ])
      }
    ]
  })

  // 搜索处理
  const handleSearch = (params: any) => {
    tableSearch(params)
  }

  // 重置搜索
  const resetSearch = () => {
    searchForm.value = { query: '', dept_id: '', status: '' }
    tableResetSearch()
  }

  // 显示用户弹窗
  const showDialog = (type: DialogType, row?: UserListItem): void => {
    dialogType.value = type
    currentUserData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  // 删除用户
  const deleteUser = (row: UserListItem): void => {
    ElMessageBox.confirm(`确定要删除用户 "${row.username}" 吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      ElMessage.success('删除成功')
      refresh()
    })
  }

  // 处理弹窗提交事件
  const handleDialogSubmit = async () => {
    dialogVisible.value = false
    currentUserData.value = {}
    refresh()
  }

  // 处理表格行选择变化
  const handleSelectionChange = (selection: UserListItem[]): void => {
    selectedRows.value = selection
  }
</script>
