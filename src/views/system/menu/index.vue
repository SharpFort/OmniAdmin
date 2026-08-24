<!-- 菜单资源树管理页（055 单表化重写：纯 iam_menu 树——目录-菜单-按钮，端点信息内嵌按钮行；
  SharpFort 单表模型；接口管理页已并入本页（按钮行 api_url/api_method 直接编辑）；
  借鉴 sharpfort-net-vue menu 页面：搜索栏 + 树表格 + 类型Tag + 名称列图标 + 新增下级/编辑/删除） -->
<template>
  <div class="menu-page art-full-height">
    <!-- 搜索栏（sharpfort 同款：名称 + 类型） -->
    <ArtSearchBar
      v-model="formFilters"
      :items="formItems"
      @reset="handleReset"
      @search="handleSearch"
    />

    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="loadResourceTree">
        <template #left>
          <ElButton v-perm="'platform:menu:create'" type="primary" v-ripple @click="handleAddTop"
            >新增菜单</ElButton
          >
          <ElButton v-ripple @click="toggleExpand">{{ isExpanded ? '收起' : '展开' }}</ElButton>
          <span v-if="!isSuperAdminFlag" class="text-xs opacity-60">只读（菜单写权限仅超管）</span>
        </template>
      </ArtTableHeader>

      <ArtTable
        ref="tableRef"
        row-key="id"
        :loading="loading"
        :columns="columns"
        :data="filteredTree"
        :stripe="false"
        :border="true"
        :indent="24"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="false"
      >
        <!-- 名称列：菜单=图标+名称；按钮=方法Tag+名称
          树形缩进：EP 原生 indent=24（折叠箭头与内容整体按层级右移） -->
        <template #menu_name="{ row }">
          <div class="menu-name-cell">
            <!-- 固定 16px 图标槽位（按钮行留空）：保证同级行名称横向对齐 -->
            <span class="menu-cell-icon">
              <ArtSvgIcon
                v-if="row.menu_type !== 'button' && row.icon"
                :icon="row.icon"
                :size="16"
              />
            </span>
            <ElTag
              v-if="row.menu_type === 'button' && row.api_method"
              :type="methodTagType(row.api_method)"
              size="small"
              class="method-tag"
            >
              {{ row.api_method }}
            </ElTag>
            <span class="menu-title">{{ row.menu_name }}</span>
          </div>
        </template>

        <!-- 类型列 -->
        <template #menu_type="{ row }">
          <ElTag :type="getTypeConfig(row).type">{{ getTypeConfig(row).text }}</ElTag>
        </template>

        <!-- 显示/状态列 -->
        <template #is_visible="{ row }">
          <ElTag :type="row.is_visible ? 'success' : 'info'" size="small">
            {{ row.is_visible ? '显示' : '隐藏' }}
          </ElTag>
        </template>
        <template #is_active="{ row }">
          <ElTag :type="row.is_active ? 'success' : 'warning'" size="small">
            {{ row.is_active ? '启用' : '禁用' }}
          </ElTag>
        </template>

        <!-- 操作列：目录/菜单=新增下级/编辑/删除；按钮=编辑/删除（端点信息在编辑弹窗内） -->
        <template #operation="{ row }">
          <ElSpace :size="4">
            <ElButton
              v-if="row.menu_type !== 'button'"
              link
              type="primary"
              @click="handleAddChild(row)"
            >
              新增下级
            </ElButton>
            <ElButton link type="primary" @click="handleEdit(row)">编辑</ElButton>
            <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
          </ElSpace>
        </template>
      </ArtTable>

      <!-- 菜单弹窗（菜单/按钮动态表单；055 单表化后端点直接编辑） -->
      <MenuDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :node="editNode"
        :tree="filteredTree"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getMenuList, deleteMenu } from '@/api/system-manage'
  import { isSuperAdmin } from '@/hooks/core/usePermission'
  import { useUserStore } from '@/store/modules/user'
  import MenuDialog from './modules/menu-dialog.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Menus' })

  /** 菜单树节点（iam_menu 全列；055 单表化后无接口叶子——端点内嵌按钮行） */
  type ResourceNode = {
    id: string
    menu_type: Api.Common.MenuType
    parent_id: string | null
    menu_name: string
    api_code: string | null
    router: string | null
    component: string | null
    icon: string | null
    order_num: number
    is_visible: boolean
    is_active: boolean
    remark: string | null
    route_name: string | null
    is_link: boolean
    is_iframe: boolean
    redirect: string | null
    is_cache: boolean
    api_url: string | null
    api_method: string | null
    is_affix: boolean
    children?: ResourceNode[]
  }

  const userStore = useUserStore()
  const isSuperAdminFlag = computed(() => isSuperAdmin(userStore.info?.roles))

  // 状态管理
  const loading = ref(false)
  const isExpanded = ref(false)
  const tableRef = ref()
  const treeData = ref<ResourceNode[]>([])
  const filteredTree = ref<ResourceNode[]>([])

  // 弹窗
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const editNode = ref<
    ResourceNode | { parentId: string | null; defaultKind: 'menu' | 'button' } | null
  >(null)

  // 搜索
  const formFilters = reactive({ query: '', menu_type: undefined as string | undefined })

  const formItems = computed(() => [
    {
      label: '名称',
      key: 'query',
      type: 'input',
      props: { clearable: true, placeholder: '名称 / 路径 / 权限码' }
    },
    {
      label: '类型',
      key: 'menu_type',
      type: 'select',
      props: {
        clearable: true,
        options: [
          { label: '目录', value: 'directory' },
          { label: '菜单', value: 'menu' },
          { label: '按钮', value: 'button' },
          { label: '外链', value: 'link' }
        ]
      }
    }
  ])

  /** 类型展示配置（目录/菜单/按钮/外链沿用既有配色） */
  const TYPE_CONFIG: Record<
    string,
    { type: 'info' | 'primary' | 'warning' | 'success' | 'danger'; text: string }
  > = {
    directory: { type: 'info', text: '目录' },
    menu: { type: 'primary', text: '菜单' },
    button: { type: 'warning', text: '按钮' },
    link: { type: 'success', text: '外链' }
  }
  const getTypeConfig = (row: ResourceNode) =>
    TYPE_CONFIG[row.menu_type] || { type: 'info' as const, text: '未知' }

  /** HTTP 方法 Tag 配色 */
  const methodTagType = (method: string | null) => {
    const map: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'info'> = {
      GET: 'success',
      POST: 'primary',
      PUT: 'warning',
      PATCH: 'warning',
      DELETE: 'danger'
    }
    return map[method || ''] || 'info'
  }

  /** 构建菜单树（iam_menu 单数据源；055 单表化） */
  const buildMenuTree = (menus: Api.Menu.MenuAdminNode[]): ResourceNode[] => {
    const nodeMap = new Map<string, ResourceNode>()
    menus.forEach((m) => {
      nodeMap.set(m.id, {
        id: m.id,
        menu_type: m.menu_type,
        parent_id: m.parent_id,
        menu_name: m.menu_name,
        api_code: m.api_code,
        router: m.router,
        component: m.component,
        icon: m.icon,
        order_num: m.order_num,
        is_visible: m.is_visible,
        is_active: m.is_active,
        remark: m.remark,
        route_name: m.route_name,
        is_link: m.is_link,
        is_iframe: m.is_iframe,
        redirect: m.redirect,
        is_cache: m.is_cache,
        api_url: m.api_url,
        api_method: m.api_method,
        is_affix: m.is_affix,
        children: []
      })
    })
    const roots: ResourceNode[] = []
    menus.forEach((m) => {
      const node = nodeMap.get(m.id)!
      if (m.parent_id && nodeMap.has(m.parent_id)) {
        nodeMap.get(m.parent_id)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })
    // 排序（order_num）
    const sortNodes = (nodes: ResourceNode[]) => {
      nodes.sort((x, y) => x.order_num - y.order_num)
      nodes.forEach((n) => n.children?.length && sortNodes(n.children))
    }
    sortNodes(roots)
    return roots
  }

  const loadResourceTree = async (): Promise<void> => {
    loading.value = true
    try {
      const menuRes = await getMenuList({ limit: 1000, offset: 0 })
      treeData.value = buildMenuTree(menuRes.items)
      filteredTree.value = treeData.value
    } catch (error) {
      console.error('获取菜单树失败:', error)
      treeData.value = []
      filteredTree.value = []
    } finally {
      loading.value = false
    }
  }

  // 表格列配置（默认显示 9 列；组件路径/路由名称/接口方法默认隐藏，列设置可勾选）
  const { columnChecks, columns } = useTableColumns<ResourceNode>(() => [
    {
      prop: 'menu_name',
      label: '名称',
      minWidth: 240,
      className: 'menu-name-col',
      useSlot: true
    },
    {
      prop: 'menu_type',
      label: '类型',
      width: 80,
      useSlot: true
    },
    {
      prop: 'router',
      label: '路由地址',
      minWidth: 150,
      formatter: (row) => (row.menu_type === 'button' ? '-' : row.router || '-')
    },
    {
      prop: 'api_url',
      label: '接口路径',
      minWidth: 180,
      formatter: (row) => (row.menu_type === 'button' ? row.api_url || '-' : '-')
    },
    {
      prop: 'api_code',
      label: '权限码',
      minWidth: 140,
      formatter: (row) => row.api_code || '-'
    },
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
      useSlot: true
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 70,
      align: 'center',
      useSlot: true
    },
    {
      prop: 'operation',
      label: '操作',
      width: 180,
      align: 'right',
      fixed: 'right',
      useSlot: true
    },
    // ↓↓↓ 默认隐藏（ArtTableHeader 列设置面板可勾选显示）↓↓↓
    {
      prop: 'component',
      label: '组件路径',
      minWidth: 130,
      visible: false,
      formatter: (row) => (row.menu_type === 'menu' ? row.component || '-' : '-')
    },
    {
      prop: 'route_name',
      label: '路由名称',
      minWidth: 130,
      visible: false,
      formatter: (row) => row.route_name || '-'
    },
    {
      prop: 'api_method',
      label: '接口方法',
      width: 100,
      visible: false,
      formatter: (row) => row.api_method || '-'
    }
  ])

  // 搜索/重置（树上递归过滤，sharpfort 同款）
  const matchNode = (node: ResourceNode): boolean => {
    const q = formFilters.query?.trim().toLowerCase()
    if (q) {
      const haystack = [node.menu_name, node.api_url, node.router, node.api_code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (formFilters.menu_type && node.menu_type !== formFilters.menu_type) return false
    return true
  }
  const filterTree = (nodes: ResourceNode[]): ResourceNode[] => {
    return nodes.reduce((acc: ResourceNode[], node) => {
      const children = node.children?.length ? filterTree(node.children) : []
      if (matchNode(node) || children.length > 0) {
        acc.push({ ...node, children })
      }
      return acc
    }, [])
  }
  const handleSearch = (): void => {
    filteredTree.value = filterTree(treeData.value)
  }
  const handleReset = (): void => {
    formFilters.query = ''
    formFilters.menu_type = undefined
    filteredTree.value = treeData.value
  }

  // 弹窗
  const handleAddTop = (): void => {
    dialogType.value = 'add'
    editNode.value = { parentId: null, defaultKind: 'menu' }
    dialogVisible.value = true
  }
  const handleAddChild = (row: ResourceNode): void => {
    dialogType.value = 'add'
    // 按父节点类型给默认子类型：目录→菜单；菜单→按钮（按钮是树叶子）
    let defaultKind: 'menu' | 'button' = 'menu'
    if (row.menu_type === 'menu') defaultKind = 'button'
    editNode.value = { parentId: row.id, defaultKind }
    dialogVisible.value = true
  }
  const handleEdit = (row: ResourceNode): void => {
    dialogType.value = 'edit'
    editNode.value = row
    dialogVisible.value = true
  }

  /** 删除菜单节点（055 单表化：按钮行删除 = 权限点与端点一并删除——iam_menu 行即权限数据本体） */
  const handleDelete = async (row: ResourceNode): Promise<void> => {
    try {
      const tip =
        row.menu_type === 'button'
          ? `确定删除按钮「${row.menu_name}」吗？其权限码 ${row.api_code || ''} 与接口端点将一并删除`
          : `确定删除菜单「${row.menu_name}」吗？删除后无法恢复`
      await ElMessageBox.confirm(tip, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteMenu(row.id)
      ElMessage.success('删除成功')
      loadResourceTree()
    } catch (error: any) {
      if (error === 'cancel' || error === 'close') return
      if (error?.message?.includes('23503') || error?.message?.includes('children')) {
        ElMessage.error('存在子节点，无法删除（请先删除其下级菜单）')
      } else {
        console.error('删除失败:', error)
        ElMessage.error(`删除失败：${error?.message || '未知错误'}`)
      }
    }
  }

  const handleDialogSubmit = (): void => {
    dialogVisible.value = false
    loadResourceTree()
  }

  const toggleExpand = (): void => {
    isExpanded.value = !isExpanded.value
    nextTick(() => {
      if (tableRef.value?.elTableRef && filteredTree.value) {
        const processRows = (rows: ResourceNode[]) => {
          rows.forEach((row) => {
            if (row.children?.length) {
              tableRef.value.elTableRef.toggleRowExpansion(row, isExpanded.value)
              processRows(row.children)
            }
          })
        }
        processRows(filteredTree.value)
      }
    })
  }

  onMounted(loadResourceTree)
</script>

<style scoped>
  /* inline-flex：与 EP 树形箭头同行排列（块级 flex 会换行并破坏树形缩进） */
  .menu-name-cell {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    white-space: nowrap;
  }

  /* 固定宽度图标槽位（16px + gap 6px = 22px 恒定占位）：无图标行留空，
     标题严格按层级步进，避免图标宽度（≈层级步长 24px）吃掉一层缩进 */
  .menu-cell-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    width: 16px;
  }

  /* 名称列 cell 禁止换行：行内布局下（placeholder/箭头 + 层级 padding）宽度逼近列宽时，
     防止整个名称块折行到第二行（折行会把 inline-flex 块弹回 cell 左缘、破坏缩进）。
     用列级 className（EP 生成的 el-table_N_column_M 类名随实例 id 变化，不可依赖） */
  :deep(.menu-name-col > .cell) {
    white-space: nowrap;
  }

  .menu-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .method-tag {
    flex-shrink: 0;
    font-family: monospace;
  }
</style>
