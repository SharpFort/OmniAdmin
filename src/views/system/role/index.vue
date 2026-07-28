<!-- 角色管理页面 -->
<template>
  <div class="art-full-height">
    <RoleSearch
      v-show="showSearchBar"
      v-model="searchForm"
      @search="handleSearch"
      @reset="resetSearch"
    />

    <ElCard class="art-table-card" :style="{ 'margin-top': showSearchBar ? '12px' : '0' }">
      <ArtTableHeader
        v-model:columns="columnChecks"
        v-model:showSearchBar="showSearchBar"
        :loading="loading"
        @refresh="refresh"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton @click="showDialog('add')" v-ripple>新增角色</ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- 表格 -->
      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>
    </ElCard>

    <!-- 角色编辑弹窗 -->
    <RoleEditDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :role-data="currentRoleData"
      @success="refresh"
    />

    <!-- 菜单权限弹窗 -->
    <RolePermissionDialog
      v-model="permissionDialog"
      :role-data="currentRoleData"
      @success="refresh"
    />
  </div>
</template>

<script setup lang="ts">
  import { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { usePostgrestTable } from '@/hooks/core/usePostgrestTable'
  import { fetchGetRoleList } from '@/api/system-manage'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import RoleSearch from './modules/role-search.vue'
  import RoleEditDialog from './modules/role-edit-dialog.vue'
  import RolePermissionDialog from './modules/role-permission-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Role' })

  type RoleListItem = Api.SystemManage.RoleListItem

  // 搜索表单
  const searchForm = ref({
    query: '',
    is_active: ''
  })

  const showSearchBar = ref(false)
  const dialogVisible = ref(false)
  const permissionDialog = ref(false)
  const currentRoleData = ref<RoleListItem | undefined>(undefined)
  const dialogType = ref<'add' | 'edit'>('add')

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
  } = usePostgrestTable<RoleListItem>({
    apiFn: fetchGetRoleList,
    columnsFactory: () => [
      { type: 'index', width: 60, label: '序号' },
      { prop: 'role_code', label: '角色编码', minWidth: 120 },
      { prop: 'role_name', label: '角色名称', minWidth: 120 },
      { prop: 'description', label: '角色描述', minWidth: 150, showOverflowTooltip: true },
      { prop: 'tenant_name', label: '租户', minWidth: 100 },
      {
        prop: 'api_count',
        label: 'API数',
        width: 80,
        align: 'center'
      },
      {
        prop: 'menu_count',
        label: '菜单数',
        width: 80,
        align: 'center'
      },
      {
        prop: 'users_count',
        label: '用户数',
        width: 80,
        align: 'center'
      },
      {
        prop: 'is_active',
        label: '状态',
        width: 80,
        formatter: (row) => {
          const statusConfig = row.is_active
            ? { type: 'success', text: '启用' }
            : { type: 'warning', text: '禁用' }
          return h(ElTag, { type: statusConfig.type as 'success' | 'warning' }, () => statusConfig.text)
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
            h(ArtButtonMore, {
              list: [
                { key: 'permission', label: '菜单权限', icon: 'ri:user-3-line' },
                { key: 'edit', label: '编辑角色', icon: 'ri:edit-2-line' },
                { key: 'delete', label: '删除角色', icon: 'ri:delete-bin-4-line', color: '#f56c6c' }
              ],
              onClick: (item: ButtonMoreItem) => buttonMoreClick(item, row)
            })
          ])
      }
    ]
  })

  const showDialog = (type: 'add' | 'edit', row?: RoleListItem) => {
    dialogVisible.value = true
    dialogType.value = type
    currentRoleData.value = row
  }

  const handleSearch = (params: any) => {
    tableSearch(params)
  }

  const resetSearch = () => {
    searchForm.value = { query: '', is_active: '' }
    tableResetSearch()
  }

  const buttonMoreClick = (item: ButtonMoreItem, row: RoleListItem) => {
    switch (item.key) {
      case 'permission':
        showPermissionDialog(row)
        break
      case 'edit':
        showDialog('edit', row)
        break
      case 'delete':
        deleteRole(row)
        break
    }
  }

  const showPermissionDialog = (row?: RoleListItem) => {
    permissionDialog.value = true
    currentRoleData.value = row
  }

  const deleteRole = (row: RoleListItem) => {
    ElMessageBox.confirm(`确定删除角色"${row.role_name}"吗？此操作不可恢复！`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => {
        ElMessage.success('删除成功')
        refresh()
      })
      .catch(() => {
        ElMessage.info('已取消删除')
      })
  }
</script>
