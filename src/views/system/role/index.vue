<!-- 角色管理页面（v_role_list；权限分配/成员查看；新增/删除引导至 Logto Console） -->
<template>
  <div class="role-page art-full-height">
    <RoleSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refresh">
        <template #left>
          <ElButton type="primary" v-ripple @click="showLogtoGuide">新增角色</ElButton>
          <span class="text-xs opacity-60">角色的新增/删除/改名在 Logto Console 侧操作</span>
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

      <!-- 权限分配弹窗 -->
      <RolePermissionDialog
        v-model:visible="permDialogVisible"
        :role-code="currentRoleCode"
        @submit="refresh"
      />

      <!-- 角色成员弹窗 -->
      <RoleMembersDialog v-model:visible="membersDialogVisible" :role-code="currentRoleCode" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getRoleList } from '@/api/system-manage'
  import RoleSearch from './modules/role-search.vue'
  import RolePermissionDialog from './modules/role-permission-dialog.vue'
  import RoleMembersDialog from './modules/role-members-dialog.vue'
  import { ElTag, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Role' })

  type RoleListItem = Api.SystemManage.RoleListItem

  // 弹窗相关
  const permDialogVisible = ref(false)
  const membersDialogVisible = ref(false)
  const currentRoleCode = ref('')

  // 搜索表单
  const searchForm = ref({
    query: '',
    is_active: ''
  })

  // 列表数据
  const loading = ref(false)
  const data = ref<RoleListItem[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getRoleList({
        query: searchForm.value.query || undefined,
        is_active:
          searchForm.value.is_active === 'true'
            ? true
            : searchForm.value.is_active === 'false'
              ? false
              : undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取角色列表失败:', error)
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

  // 表格列配置
  const { columns, columnChecks } = useTableColumns<RoleListItem>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'role_code', label: '角色编码', minWidth: 160 },
    { prop: 'role_name', label: '角色名称', minWidth: 140 },
    { prop: 'api_count', label: 'API 权限数', width: 100, align: 'center' },
    { prop: 'menu_count', label: '菜单权限数', width: 100, align: 'center' },
    { prop: 'users_count', label: '用户数', width: 80, align: 'center' },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) =>
        h(ElTag, { type: row.is_active ? 'success' : 'warning' }, () =>
          row.is_active ? '启用' : '停用'
        )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 170,
      fixed: 'right',
      formatter: (row) =>
        h('div', [
          h(
            'ElButton',
            {
              type: 'primary',
              link: true,
              onClick: () => showPermissionDialog(row)
            },
            () => '权限分配'
          ),
          h(
            'ElButton',
            {
              type: 'primary',
              link: true,
              onClick: () => showMembersDialog(row)
            },
            () => '成员'
          )
        ])
    }
  ])

  onMounted(getData)

  const showLogtoGuide = () => {
    ElMessageBox.alert(
      '角色的新增、删除、改名均在 Logto Console（管理端）操作，前端仅提供权限绑定与成员查看。',
      '提示',
      { confirmButtonText: '知道了', type: 'info' }
    )
  }

  const showPermissionDialog = (row: RoleListItem) => {
    currentRoleCode.value = row.role_code
    nextTick(() => {
      permDialogVisible.value = true
    })
  }

  const showMembersDialog = (row: RoleListItem) => {
    currentRoleCode.value = row.role_code
    nextTick(() => {
      membersDialogVisible.value = true
    })
  }

  const handleSearch = (params: any) => {
    Object.assign(searchForm.value, params)
    pagination.current = 1
    getData()
  }

  const resetSearch = () => {
    searchForm.value = { query: '', is_active: '' }
    pagination.current = 1
    getData()
  }
</script>
