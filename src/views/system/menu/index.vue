<!-- 菜单管理页面 -->
<template>
  <div class="menu-page art-full-height">
    <ElCard class="art-table-card">
      <!-- 表格头部 -->
      <ArtTableHeader
        :showZebra="false"
        :loading="loading"
        v-model:columns="columnChecks"
        @refresh="handleRefresh"
      >
        <template #left>
          <ElButton v-auth="'add'" @click="handleAddMenu" v-ripple>添加菜单</ElButton>
          <ElButton @click="toggleExpand" v-ripple>
            {{ isExpanded ? '收起' : '展开' }}
          </ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        ref="tableRef"
        rowKey="id"
        :loading="loading"
        :columns="columns"
        :data="menuTree"
        :stripe="false"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="false"
      />

      <!-- 菜单弹窗 -->
      <MenuDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :edit-data="editData"
        :menu-tree="menuTree"
        @submit="handleSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { fetchGetMenuTree } from '@/api/system-manage'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import MenuDialog from './modules/menu-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Menus' })

  // 状态管理
  const loading = ref(false)
  const isExpanded = ref(false)
  const tableRef = ref()
  const menuTree = ref<Api.SystemManage.MenuTreeItem[]>([])

  // 弹窗相关
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const editData = ref<Api.SystemManage.MenuTreeItem | null>(null)

  // 菜单类型配置
  const MENU_TYPE_CONFIG: Record<string, { type: 'primary' | 'success' | 'warning' | 'info'; text: string }> = {
    directory: { type: 'info', text: '目录' },
    menu: { type: 'primary', text: '菜单' },
    button: { type: 'warning', text: '按钮' }
  }

  const getMenuTypeConfig = (type: string) => {
    return MENU_TYPE_CONFIG[type] || { type: 'info', text: '未知' }
  }

  // 表格列配置
  const { columnChecks, columns } = useTableColumns(() => [
    {
      prop: 'title',
      label: '菜单名称',
      minWidth: 150
    },
    {
      prop: 'type',
      label: '类型',
      width: 80,
      formatter: (row) => {
        const config = getMenuTypeConfig(row.type)
        return h(ElTag, { type: config.type }, () => config.text)
      }
    },
    { prop: 'icon', label: '图标', width: 60 },
    { prop: 'path', label: '路径', minWidth: 120 },
    { prop: 'component', label: '组件', minWidth: 150 },
    { prop: 'permission_code', label: '权限标识', minWidth: 120 },
    {
      prop: 'sort_order',
      label: '排序',
      width: 60,
      align: 'center'
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) => {
        const config = row.is_active
          ? { type: 'success', text: '启用' }
          : { type: 'warning', text: '禁用' }
        return h(ElTag, { type: config.type as 'success' | 'warning' }, () => config.text)
      }
    },
    {
      prop: 'operation',
      label: '操作',
      width: 180,
      align: 'right',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: right' }, [
          h(ArtButtonTable, {
            type: 'add',
            onClick: () => handleAddChild(row),
            title: '新增子菜单'
          }),
          h(ArtButtonTable, {
            type: 'edit',
            onClick: () => handleEditMenu(row)
          }),
          h(ArtButtonTable, {
            type: 'delete',
            onClick: () => handleDeleteMenu(row)
          })
        ])
    }
  ])

  onMounted(() => {
    getMenuList()
  })

  const getMenuList = async (): Promise<void> => {
    loading.value = true
    try {
      menuTree.value = await fetchGetMenuTree()
    } catch (error) {
      console.error('获取菜单失败:', error)
      menuTree.value = []
    } finally {
      loading.value = false
    }
  }

  const handleRefresh = () => {
    getMenuList()
  }

  const handleAddMenu = (): void => {
    dialogType.value = 'add'
    editData.value = null
    dialogVisible.value = true
  }

  const handleAddChild = (parent: Api.SystemManage.MenuTreeItem): void => {
    dialogType.value = 'add'
    editData.value = { parent_id: parent.id } as any
    dialogVisible.value = true
  }

  const handleEditMenu = (row: Api.SystemManage.MenuTreeItem): void => {
    dialogType.value = 'edit'
    editData.value = row
    dialogVisible.value = true
  }

  const handleDeleteMenu = async (row: Api.SystemManage.MenuTreeItem): Promise<void> => {
    try {
      await ElMessageBox.confirm('确定要删除该菜单吗？删除后无法恢复', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      ElMessage.success('删除成功')
      getMenuList()
    } catch {
      // cancelled
    }
  }

  const handleSubmit = (): void => {
    dialogVisible.value = false
    getMenuList()
  }

  const toggleExpand = (): void => {
    isExpanded.value = !isExpanded.value
    nextTick(() => {
      if (tableRef.value?.elTableRef && menuTree.value) {
        const processRows = (rows: Api.SystemManage.MenuTreeItem[]) => {
          rows.forEach((row) => {
            if (row.children?.length) {
              tableRef.value.elTableRef.toggleRowExpansion(row, isExpanded.value)
              processRows(row.children)
            }
          })
        }
        processRows(menuTree.value)
      }
    })
  }
</script>
