<!-- 菜单管理页面（iam_menu 视图全列 + 前端组树；C-3：新建含 is_visible 开关） -->
<template>
  <div class="menu-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="loadMenuList">
        <template #left>
          <ElButton v-perm="'sys:menu:create'" type="primary" v-ripple @click="handleAddMenu">
            添加菜单
          </ElButton>
          <ElButton v-ripple @click="toggleExpand">
            {{ isExpanded ? '收起' : '展开' }}
          </ElButton>
          <span v-if="!isSuperAdminFlag" class="text-xs opacity-60">只读（菜单写权限仅超管）</span>
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
  import { getMenuList as fetchMenuList, deleteMenu } from '@/api/system-manage'
  import { isSuperAdmin } from '@/hooks/core/usePermission'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import MenuDialog from './modules/menu-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Menus' })

  type MenuNode = Api.Menu.MenuAdminNode & { children?: MenuNode[] }

  const userStore = useUserStore()
  const isSuperAdminFlag = computed(() => isSuperAdmin(userStore.info?.roles))

  // 状态管理
  const loading = ref(false)
  const isExpanded = ref(false)
  const tableRef = ref()
  const menuTree = ref<MenuNode[]>([])

  // 弹窗相关
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const editData = ref<MenuNode | null>(null)

  // 菜单类型配置
  const MENU_TYPE_CONFIG: Record<
    string,
    { type: 'info' | 'primary' | 'warning' | 'success'; text: string }
  > = {
    directory: { type: 'info', text: '目录' },
    menu: { type: 'primary', text: '菜单' },
    button: { type: 'warning', text: '按钮' },
    link: { type: 'success', text: '外链' }
  }
  const getMenuTypeConfig = (type: string) =>
    MENU_TYPE_CONFIG[type] || { type: 'info', text: '未知' }

  /** 扁平列表 → 树（两遍构建：先 Map 后挂载，不假设父先于子） */
  const buildTree = (items: Api.Menu.MenuAdminNode[]): MenuNode[] => {
    const nodeMap = new Map<string, MenuNode>()
    items.forEach((item) => {
      nodeMap.set(item.id, { ...item })
    })
    const roots: MenuNode[] = []
    items.forEach((item) => {
      const node = nodeMap.get(item.id)!
      if (item.parent_id && nodeMap.has(item.parent_id)) {
        const parent = nodeMap.get(item.parent_id)!
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots
  }

  // 表格列配置
  const { columnChecks, columns } = useTableColumns<MenuNode>(() => [
    {
      prop: 'menu_name',
      label: '菜单名称',
      minWidth: 160
    },
    {
      prop: 'menu_type',
      label: '类型',
      width: 80,
      formatter: (row) => {
        const config = getMenuTypeConfig(row.menu_type)
        return h(ElTag, { type: config.type }, () => config.text)
      }
    },
    { prop: 'path', label: '路径', minWidth: 110, formatter: (row) => row.path || '-' },
    {
      prop: 'component',
      label: '组件',
      minWidth: 140,
      formatter: (row) => row.component || '-'
    },
    { prop: 'perms', label: '权限标识', minWidth: 110, formatter: (row) => row.perms || '-' },
    { prop: 'icon', label: '图标', width: 60, formatter: (row) => row.icon || '-' },
    {
      prop: 'order_num',
      label: '排序',
      width: 60,
      align: 'center'
    },
    {
      prop: 'is_visible',
      label: '显示',
      width: 70,
      align: 'center',
      formatter: (row) =>
        h(ElTag, { type: row.is_visible ? 'success' : 'info' }, () =>
          row.is_visible ? '显示' : '隐藏'
        )
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) =>
        h(ElTag, { type: row.is_active ? 'success' : 'warning' }, () =>
          row.is_active ? '启用' : '禁用'
        )
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
            title: '新增子菜单',
            onClick: () => handleAddChild(row)
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

  const loadMenuList = async (): Promise<void> => {
    loading.value = true
    try {
      const result = await fetchMenuList({ limit: 1000, offset: 0 })
      menuTree.value = buildTree(result.items)
    } catch (error) {
      console.error('获取菜单失败:', error)
      menuTree.value = []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadMenuList)

  const handleAddMenu = (): void => {
    dialogType.value = 'add'
    editData.value = null
    dialogVisible.value = true
  }

  const handleAddChild = (parent: MenuNode): void => {
    dialogType.value = 'add'
    editData.value = { parent_id: parent.id } as unknown as MenuNode
    dialogVisible.value = true
  }

  const handleEditMenu = (row: MenuNode): void => {
    dialogType.value = 'edit'
    editData.value = row
    dialogVisible.value = true
  }

  const handleDeleteMenu = async (row: MenuNode): Promise<void> => {
    try {
      await ElMessageBox.confirm(`确定要删除菜单「${row.menu_name}」吗？删除后无法恢复`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteMenu(row.id)
      ElMessage.success('删除成功')
      loadMenuList()
    } catch (error) {
      // cancelled 或删除失败（有子菜单后端拒绝）
      console.warn('删除菜单失败:', error)
    }
  }

  const handleSubmit = (): void => {
    dialogVisible.value = false
    loadMenuList()
  }

  const toggleExpand = (): void => {
    isExpanded.value = !isExpanded.value
    nextTick(() => {
      if (tableRef.value?.elTableRef && menuTree.value) {
        const processRows = (rows: MenuNode[]) => {
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
