<!-- 菜单/接口资源树管理页（044 字段改名后重写：资源树一体化——目录-菜单-按钮树形 + 接口挂载叶子；
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
          <ElButton v-perm="'sys:menu:create'" type="primary" v-ripple @click="handleAddTop"
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
        :indent="0"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="false"
      >
        <!-- 名称列：菜单=图标+名称；接口=方法Tag+名称
          树形缩进 sharpfort 同款：EP 原生 indent 归零（箭头左对齐），
          名称内容按 level 手动 padding-left 逐级缩进（目录-菜单-按钮三级层次） -->
        <template #menu_name="{ row }">
          <div class="menu-name-cell" :style="{ paddingLeft: `${(row.level || 0) * 24}px` }">
            <ArtSvgIcon v-if="row.kind === 'menu' && row.icon" :icon="row.icon" :size="16" />
            <ElTag
              v-if="row.kind === 'api'"
              :type="methodTagType(row.method)"
              size="small"
              class="method-tag"
            >
              {{ row.method }}
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

        <!-- 操作列：目录/菜单=新增下级/编辑/删除；按钮=编辑/删除（绑定在编辑弹窗内）；接口=解绑（数据删除在 API 页） -->
        <template #operation="{ row }">
          <ElSpace :size="4">
            <ElButton
              v-if="row.kind === 'menu' && row.menu_type !== 'button'"
              link
              type="primary"
              @click="handleAddChild(row)"
            >
              新增下级
            </ElButton>
            <ElButton v-if="row.kind === 'menu'" link type="primary" @click="handleEdit(row)"
              >编辑</ElButton
            >
            <ElButton v-if="row.kind === 'api'" link type="warning" @click="handleUnbind(row)"
              >解绑</ElButton
            >
            <ElButton v-if="row.kind === 'menu'" link type="danger" @click="handleDelete(row)"
              >删除</ElButton
            >
          </ElSpace>
        </template>
      </ArtTable>

      <!-- 资源弹窗（菜单/按钮/接口动态表单） -->
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
  import { getMenuList, getApiList, deleteMenu, setMenuApis } from '@/api/system-manage'
  import { isSuperAdmin } from '@/hooks/core/usePermission'
  import { useUserStore } from '@/store/modules/user'
  import MenuDialog from './modules/menu-dialog.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Menus' })

  /** 资源树节点（合成：iam_menu 树形 + iam_api 挂载叶子；044 新字段 router/api_code） */
  type ResourceNode = {
    id: string
    kind: 'menu' | 'api'
    menu_type?: Api.Common.MenuType
    parent_id: string | null
    menu_id: string | null
    menu_name: string
    api_code: string | null
    router: string | null
    path: string | null
    method: string | null
    component: string | null
    icon: string | null
    order_num: number
    is_visible: boolean
    is_active: boolean
    api_group: string | null
    description: string | null
    remark: string | null
    route_name: string | null
    query: string | null
    is_link: boolean
    is_iframe: boolean
    redirect: string | null
    keep_alive: boolean
    /** 上级选择时不可选（接口节点不可作为挂载点） */
    disabled?: boolean
    /** 树层级（sharpfort 同款：目录=0，逐级 +1，名称列缩进用） */
    level?: number
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
          { label: '外链', value: 'link' },
          { label: '接口', value: 'api' }
        ]
      }
    }
  ])

  /** 类型展示配置（接口=danger 区分；目录/菜单/按钮/外链沿用既有配色） */
  const TYPE_CONFIG: Record<
    string,
    { type: 'info' | 'primary' | 'warning' | 'success' | 'danger'; text: string }
  > = {
    directory: { type: 'info', text: '目录' },
    menu: { type: 'primary', text: '菜单' },
    button: { type: 'warning', text: '按钮' },
    link: { type: 'success', text: '外链' },
    api: { type: 'danger', text: '接口' }
  }
  const getTypeConfig = (row: ResourceNode) => {
    const key = row.kind === 'api' ? 'api' : row.menu_type || ''
    return TYPE_CONFIG[key] || { type: 'info' as const, text: '未知' }
  }

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

  /** 合成资源树：菜单树（parent_id）→ 接口叶子（menu_id 挂载）；无归属接口平铺视图兜底 */
  const buildResourceTree = (
    menus: Api.Menu.MenuAdminNode[],
    apis: Api.SystemManage.ApiAdminNode[]
  ): ResourceNode[] => {
    const nodeMap = new Map<string, ResourceNode>()
    menus.forEach((m) => {
      nodeMap.set(m.id, {
        id: m.id,
        kind: 'menu',
        menu_type: m.menu_type,
        parent_id: m.parent_id,
        menu_id: null,
        menu_name: m.menu_name,
        api_code: m.api_code,
        router: m.router,
        path: null,
        method: null,
        component: m.component,
        icon: m.icon,
        order_num: m.order_num,
        is_visible: m.is_visible,
        is_active: m.is_active,
        api_group: null,
        description: null,
        remark: m.remark,
        route_name: m.route_name,
        query: m.query,
        is_link: m.is_link,
        is_iframe: m.is_iframe,
        redirect: m.redirect,
        keep_alive: m.keep_alive,
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
    // 接口叶子挂载（disabled：不可作为上级挂载点）
    apis.forEach((a) => {
      const apiNode: ResourceNode = {
        id: a.id,
        kind: 'api',
        parent_id: null,
        menu_id: a.menu_id,
        menu_name: a.name,
        api_code: a.api_code,
        router: null,
        path: a.path,
        method: a.method,
        component: null,
        icon: null,
        order_num: a.order_num,
        is_visible: true,
        is_active: a.is_active,
        api_group: a.api_group,
        description: a.description,
        remark: null,
        route_name: null,
        query: null,
        is_link: false,
        is_iframe: false,
        redirect: null,
        keep_alive: true,
        disabled: true
      }
      if (a.menu_id && nodeMap.has(a.menu_id)) {
        nodeMap.get(a.menu_id)!.children!.push(apiNode)
      }
      // 无归属接口：树不展示（接口平铺视图兜底）
    })
    // 排序（菜单 order_num；接口 order_num）
    const sortNodes = (nodes: ResourceNode[]) => {
      nodes.sort((x, y) => x.order_num - y.order_num)
      nodes.forEach((n) => n.children?.length && sortNodes(n.children))
    }
    sortNodes(roots)
    // 计算层级（sharpfort 同款：目录=0，逐级 +1，名称列缩进）
    const setLevel = (nodes: ResourceNode[], level = 0) => {
      nodes.forEach((n) => {
        n.level = level
        if (n.children?.length) setLevel(n.children, level + 1)
      })
    }
    setLevel(roots)
    return roots
  }

  const loadResourceTree = async (): Promise<void> => {
    loading.value = true
    try {
      const [menuRes, apiRes] = await Promise.all([
        getMenuList({ limit: 1000, offset: 0 }),
        getApiList({ limit: 1000, offset: 0 })
      ])
      treeData.value = buildResourceTree(menuRes.items, apiRes.items)
      filteredTree.value = treeData.value
    } catch (error) {
      console.error('获取资源树失败:', error)
      treeData.value = []
      filteredTree.value = []
    } finally {
      loading.value = false
    }
  }

  // 表格列配置
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
      prop: 'path',
      label: '路径',
      minWidth: 160,
      formatter: (row) => (row.kind === 'api' ? row.path || '-' : row.router || '-')
    },
    {
      prop: 'component',
      label: '组件',
      minWidth: 130,
      formatter: (row) => (row.kind === 'menu' ? row.component || '-' : '-')
    },
    {
      prop: 'api_code',
      label: '权限码',
      minWidth: 120,
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
      width: 190,
      align: 'right',
      fixed: 'right',
      useSlot: true
    }
  ])

  // 搜索/重置（树上递归过滤，sharpfort 同款）
  const matchNode = (node: ResourceNode): boolean => {
    const q = formFilters.query?.trim().toLowerCase()
    if (q) {
      const haystack = [node.menu_name, node.path, node.router, node.api_code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (formFilters.menu_type) {
      const nodeType = node.kind === 'api' ? 'api' : node.menu_type
      if (nodeType !== formFilters.menu_type) return false
    }
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
    // 按父节点类型给默认子类型：目录→菜单；菜单→按钮（按钮是树叶子，接口绑定走编辑弹窗）
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

  /** 删除菜单节点（按钮：其下接口自动解绑回池——FK ON DELETE SET NULL，数据保留在 API 页；
   * 目录/菜单：有子节点后端 23503 拒绝） */
  const handleDelete = async (row: ResourceNode): Promise<void> => {
    try {
      const apiChildren = row.children?.filter((c) => c.kind === 'api') || []
      const tip =
        row.menu_type === 'button' && apiChildren.length > 0
          ? `确定删除按钮「${row.menu_name}」吗？其下 ${apiChildren.length} 个接口将解除绑定（接口数据保留，可在 API 管理页重新绑定）`
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

  /** 解绑接口（回未挂载池；rpc_set_menu_apis 全量对齐——父节点剩余绑定集合不变） */
  const handleUnbind = async (row: ResourceNode): Promise<void> => {
    try {
      const parentId = row.menu_id
      if (!parentId) {
        ElMessage.info('该接口未绑定任何节点')
        return
      }
      // 找父节点剩余接口集合
      const findParent = (nodes: ResourceNode[]): ResourceNode | null => {
        for (const n of nodes) {
          if (n.children?.some((c) => c.id === row.id)) return n
          const found = n.children?.length ? findParent(n.children) : null
          if (found) return found
        }
        return null
      }
      const parent = findParent(treeData.value)
      const remaining = (parent?.children || [])
        .filter((c) => c.kind === 'api' && c.id !== row.id)
        .map((c) => c.id)

      await ElMessageBox.confirm(
        `确定解绑接口「${row.menu_name}」吗？解绑后回到未绑定池，可在其他按钮或 API 管理页重新绑定`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
      await setMenuApis({ p_menu_id: parentId, p_api_ids: remaining })
      ElMessage.success('解绑成功')
      loadResourceTree()
    } catch (error: any) {
      if (error === 'cancel' || error === 'close') return
      console.error('解绑失败:', error)
      ElMessage.error(`解绑失败：${error?.message || '未知错误'}`)
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
  /* inline-flex：与 EP 树形箭头同行排列（块级 flex 会换行并忽略前置缩进 span，
     sharpfort 名称列缩进依赖 inline 布局 + level padding-left） */
  .menu-name-cell {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    white-space: nowrap;
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
