<!-- 角色授权菜单弹窗（055 单表化：授权树 = 菜单树勾选；参考 sharpfort-net-vue：
  大弹窗 + 全部展开/选择/计数工具条 + 仅展示菜单名，按钮节点横向排列；数据范围拆分为独立弹窗） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`授权菜单 - ${roleCode}`"
    :width="dialogWidth"
    align-center
    destroy-on-close
    class="role-permission-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="permission-content">
      <div class="permission-header">
        <ElSpace>
          <ElButton @click="toggleExpandAll" size="small">
            <template #icon>
              <i :class="isExpandAll ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
            </template>
            {{ isExpandAll ? '全部收起' : '全部展开' }}
          </ElButton>
          <ElButton @click="toggleSelectAll" size="small">
            <template #icon>
              <i :class="isSelectAll ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'" />
            </template>
            {{ isSelectAll ? '全部选择' : '取消全选' }}
          </ElButton>
          <ElTag type="info" size="small">已选择 {{ checkedCount }} 项</ElTag>
        </ElSpace>
      </div>

      <ElScrollbar height="60vh" class="permission-tree-scrollbar">
        <ElTree
          ref="treeRef"
          v-loading="loading"
          :data="menuTree"
          show-checkbox
          node-key="id"
          :default-expand-all="true"
          :props="{ label: 'label', children: 'children' }"
          class="permission-tree"
          @check="handleCheck"
        />
      </ElScrollbar>
    </div>

    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { ElTree } from 'element-plus'
  import { getMenuList, getRolePermissions, setRoleMenus } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    roleCode: string
  }>()

  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  const loading = ref(false)
  const saving = ref(false)
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const isExpandAll = ref(true)
  const isSelectAll = ref(false)
  const menuTree = ref<any[]>([])
  const checkedCount = ref(0)

  /** 响应式弹窗宽度（参考 sharpfort-net-vue） */
  const dialogWidth = computed(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth
      if (width < 768) return '95vw'
      if (width < 1200) return '85vw'
      return '90vw'
    }
    return '1400px'
  })

  interface MenuTreeNode {
    id: string
    label: string
    menu_type: string
    children?: MenuTreeNode[]
  }

  /** iam_menu 扁平 → 树（前端两遍构建；仅保留名称/类型用于布局） */
  const buildMenuTree = (items: Api.Menu.MenuAdminNode[]): MenuTreeNode[] => {
    const nodeMap = new Map<string, MenuTreeNode>()
    items.forEach((item) => {
      nodeMap.set(item.id, {
        id: item.id,
        label: item.menu_name,
        menu_type: item.menu_type,
        children: []
      })
    })
    const roots: MenuTreeNode[] = []
    items.forEach((item) => {
      const node = nodeMap.get(item.id)!
      if (item.parent_id && nodeMap.has(item.parent_id)) {
        const parent = nodeMap.get(item.parent_id)!
        parent.children!.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots
  }

  /** 为树节点设置 data-menu-type 属性（按钮节点横向排列、目录/菜单纵向排列） */
  const addMenuTypeAttributes = () => {
    nextTick(() => {
      if (!treeRef.value) return
      const nodes = treeRef.value.$el.querySelectorAll('.el-tree-node')
      nodes.forEach((node: HTMLElement) => {
        const nodeKey = node.getAttribute('data-key')
        if (nodeKey) {
          const nodeData = findNodeData(menuTree.value, nodeKey)
          if (nodeData?.menu_type) {
            node.setAttribute('data-menu-type', nodeData.menu_type)
          }
        }
      })
    })
  }

  const findNodeData = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children?.length) {
        const found = findNodeData(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  /** 勾选变化 → 计数（checked + halfChecked） */
  const handleCheck = () => {
    if (treeRef.value) {
      checkedCount.value =
        treeRef.value.getCheckedKeys().length + treeRef.value.getHalfCheckedKeys().length
    }
  }

  const loadData = async () => {
    if (!props.roleCode) return
    loading.value = true
    try {
      const menuResult = await getMenuList({ limit: 1000, offset: 0 })
      menuTree.value = buildMenuTree(menuResult.items)

      const detail = await getRolePermissions(props.roleCode)
      const menuIds = detail.menus.map((item) => item.id)

      nextTick(() => {
        treeRef.value?.setCheckedKeys(menuIds)
        handleCheck()
        addMenuTypeAttributes()
      })
    } catch (error) {
      console.error('加载权限数据失败:', error)
      ElMessage.error('加载权限数据失败')
    } finally {
      loading.value = false
    }
  }

  /** 全部展开/收起 */
  const toggleExpandAll = () => {
    isExpandAll.value = !isExpandAll.value
    const nodes = treeRef.value?.store.nodesMap
    if (nodes) {
      for (const key in nodes) {
        nodes[key].expanded = isExpandAll.value
      }
    }
    nextTick(() => addMenuTypeAttributes())
  }

  /** 全部选择/取消全选 */
  const toggleSelectAll = () => {
    isSelectAll.value = !isSelectAll.value
    if (isSelectAll.value) {
      treeRef.value?.setCheckedKeys(getAllNodeKeys(menuTree.value))
    } else {
      treeRef.value?.setCheckedKeys([])
    }
    handleCheck()
  }

  const getAllNodeKeys = (nodes: any[]): string[] => {
    const keys: string[] = []
    const traverse = (list: any[]) => {
      list.forEach((n) => {
        keys.push(n.id)
        if (n.children?.length) traverse(n.children)
      })
    }
    traverse(nodes)
    return keys
  }

  /** 保存：checked + halfChecked 合并（半选父节点也要进绑定集） */
  const handleSave = async () => {
    if (!props.roleCode) return
    saving.value = true
    try {
      const checked = treeRef.value?.getCheckedKeys() || []
      const halfChecked = treeRef.value?.getHalfCheckedKeys() || []
      const menuIds = [...new Set([...checked, ...halfChecked])] as string[]

      await setRoleMenus(props.roleCode, menuIds)
      ElMessage.success('权限保存成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存权限失败:', error)
    } finally {
      saving.value = false
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) {
        isExpandAll.value = true
        isSelectAll.value = false
        checkedCount.value = 0
        loadData()
      }
    }
  )
</script>

<style scoped lang="scss">
  .role-permission-dialog {
    :deep(.el-dialog__body) {
      padding: 10px 20px;
    }
  }

  .permission-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .permission-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .permission-tree-scrollbar {
    padding: 12px;
    background-color: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
  }

  .permission-tree {
    :deep(.el-tree-node__content) {
      height: 32px;

      &:hover {
        background-color: var(--el-fill-color-light);
      }
    }

    :deep(.el-tree-node__label) {
      font-size: 14px;
    }

    :deep(.el-checkbox) {
      margin-right: 8px;
    }

    :deep(.el-tree-node__expand-icon) {
      font-size: 16px;
    }

    // 按钮类型节点横向排列（参考 sharpfort-net-vue）
    :deep(.el-tree-node[data-menu-type='button']) {
      display: inline-block;
      margin-right: 8px;
      margin-bottom: 4px;
      vertical-align: top;

      .el-tree-node__content {
        width: auto;
        padding-right: 12px;
      }
    }

    // 目录/菜单保持纵向排列
    :deep(.el-tree-node[data-menu-type='directory']),
    :deep(.el-tree-node[data-menu-type='menu']) {
      display: block;
      width: 100%;
    }

    // 子节点容器：含按钮用 flex 换行，否则块级
    :deep(.el-tree-node__children) {
      padding-left: 24px;

      &:has([data-menu-type='button']) {
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        align-items: flex-start;
      }

      &:not(:has([data-menu-type='button'])) {
        display: block;
      }
    }
  }
</style>
