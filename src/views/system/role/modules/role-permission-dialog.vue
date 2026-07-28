<template>
  <ElDialog
    v-model="visible"
    title="菜单权限"
    width="600px"
    align-center
    class="el-dialog-border"
    @close="handleClose"
  >
    <ElScrollbar height="60vh">
      <ElTree
        ref="menuTreeRef"
        :data="menuTree"
        show-checkbox
        node-key="id"
        :default-expand-all="isExpandAll"
        :props="{ children: 'children', label: 'title' }"
        @check="handleTreeCheck"
      >
        <template #default="{ data }">
          <div style="display: flex; align-items: center; gap: 8px">
            <span v-if="data.icon" class="menu-icon" v-html="data.icon"></span>
            <span>{{ data.title || data.name }}</span>
            <ElTag v-if="data.type === 'directory'" size="small" type="info">目录</ElTag>
            <ElTag v-else-if="data.type === 'button'" size="small" type="warning">按钮</ElTag>
            <ElTag v-else size="small">菜单</ElTag>
          </div>
        </template>
      </ElTree>
    </ElScrollbar>
    <template #footer>
      <ElButton @click="toggleExpandAll">{{ isExpandAll ? '全部收起' : '全部展开' }}</ElButton>
      <ElButton @click="toggleSelectAll">{{ isSelectAll ? '取消全选' : '全部选择' }}</ElButton>
      <ElButton type="primary" @click="savePermission">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchGetMenuTree, fetchGetRolePermissions, fetchUpdateRolePermissions } from '@/api/system-manage'

  type RoleListItem = Api.SystemManage.RoleListItem

  interface Props {
    modelValue: boolean
    roleData?: RoleListItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    roleData: undefined
  })

  const emit = defineEmits<Emits>()

  const menuTreeRef = ref()
  const isExpandAll = ref(true)
  const isSelectAll = ref(false)
  const menuTree = ref<Api.SystemManage.MenuTreeItem[]>([])
  const loading = ref(false)

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  watch(
    () => props.modelValue,
    async (newVal) => {
      if (newVal && props.roleData) {
        await loadMenuTree()
        await loadRolePermissions()
      }
    }
  )

  const loadMenuTree = async () => {
    loading.value = true
    try {
      menuTree.value = await fetchGetMenuTree()
    } catch (error) {
      console.error('加载菜单树失败:', error)
      menuTree.value = []
    } finally {
      loading.value = false
    }
  }

  const loadRolePermissions = async () => {
    if (!props.roleData) return
    try {
      const permissions = await fetchGetRolePermissions(props.roleData.id)
      // 设置已选中的菜单
      const checkedIds = permissions.menus.map(m => m.id)
      menuTreeRef.value?.setCheckedKeys(checkedIds)
    } catch (error) {
      console.error('加载角色权限失败:', error)
    }
  }

  const handleClose = () => {
    visible.value = false
    menuTreeRef.value?.setCheckedKeys([])
  }

  const savePermission = async () => {
    if (!props.roleData) return
    try {
      const checkedKeys = menuTreeRef.value?.getCheckedKeys() || []
      const halfCheckedKeys = menuTreeRef.value?.getHalfCheckedKeys() || []
      const allMenuIds = [...checkedKeys, ...halfCheckedKeys] as string[]

      await fetchUpdateRolePermissions({
        p_role_id: props.roleData.id,
        p_menu_ids: allMenuIds,
        p_api_ids: [] // TODO: 添加 API 权限
      })
      ElMessage.success('权限保存成功')
      emit('success')
      handleClose()
    } catch (error) {
      ElMessage.error('保存失败')
    }
  }

  const toggleExpandAll = () => {
    const tree = menuTreeRef.value
    if (!tree) return

    const nodes = tree.store.nodesMap
    Object.values(nodes).forEach((node: any) => {
      node.expanded = !isExpandAll.value
    })
    isExpandAll.value = !isExpandAll.value
  }

  const toggleSelectAll = () => {
    const tree = menuTreeRef.value
    if (!tree) return

    if (!isSelectAll.value) {
      const allKeys = getAllNodeKeys(menuTree.value)
      tree.setCheckedKeys(allKeys)
    } else {
      tree.setCheckedKeys([])
    }
    isSelectAll.value = !isSelectAll.value
  }

  const getAllNodeKeys = (nodes: Api.SystemManage.MenuTreeItem[]): string[] => {
    const keys: string[] = []
    const traverse = (nodeList: Api.SystemManage.MenuTreeItem[]): void => {
      nodeList.forEach((node) => {
        keys.push(node.id)
        if (node.children?.length) traverse(node.children)
      })
    }
    traverse(nodes)
    return keys
  }

  const handleTreeCheck = () => {
    const tree = menuTreeRef.value
    if (!tree) return

    const checkedKeys = tree.getCheckedKeys()
    const allKeys = getAllNodeKeys(menuTree.value)
    isSelectAll.value = checkedKeys.length === allKeys.length && allKeys.length > 0
  }
</script>
