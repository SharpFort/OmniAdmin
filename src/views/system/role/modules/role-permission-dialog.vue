<!-- 角色权限分配弹窗（C-4：iam_menu 全量视图组树 + get_role_permissions 已选回显 + 父子联动）
  父子联动（§2.4 风险）：勾选子节点自动带父链；提交 = checkedKeys + halfCheckedKeys 合并
  （半选父节点也要进绑定集，否则 get_user_menu 递归 CTE 会丢失子树） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`权限分配 - ${roleCode}`"
    width="760px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="菜单权限" name="menus">
          <el-tree
            ref="menuTreeRef"
            :data="menuTree"
            show-checkbox
            node-key="id"
            default-expand-all
            :props="{ label: 'label', children: 'children' }"
            class="max-h-96 overflow-auto"
          >
            <template #default="{ data }">
              <span class="flex items-center">
                {{ data.label }}
                <el-tag size="small" class="ml-2" :type="menuTypeTag(data.menu_type)">
                  {{ menuTypeText(data.menu_type) }}
                </el-tag>
              </span>
            </template>
          </el-tree>
        </el-tab-pane>
        <el-tab-pane label="API 权限" name="apis">
          <div class="max-h-96 overflow-auto border border-g-300 rounded p-3">
            <el-checkbox-group v-model="checkedApis" class="flex flex-col gap-2">
              <el-checkbox v-for="api in apiList" :key="api.id" :value="api.id">
                <span class="flex items-center gap-2">
                  <el-tag size="small" type="info">{{ api.method }}</el-tag>
                  <code class="text-xs">{{ api.path }}</code>
                  <span class="text-xs opacity-70">{{ api.api_code || api.name }}</span>
                </span>
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" v-perm="'sys:role-api:bind'" @click="handleSave">
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { ElTree } from 'element-plus'
  import {
    getRolePermissions,
    setRoleApis,
    setRoleMenus,
    getMenuList,
    getApiList
  } from '@/api/system-manage'
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
  const activeTab = ref('menus')
  const menuTreeRef = ref<InstanceType<typeof ElTree>>()

  // 菜单树（iam_menu 全量视图 + 前端两遍构建）
  interface MenuTreeNode {
    id: string
    label: string
    menu_type: string
    children?: MenuTreeNode[]
  }
  const menuTree = ref<MenuTreeNode[]>([])

  // API 权限点（iam_api 全量）
  const apiList = ref<Api.SystemManage.ApiItem[]>([])
  const checkedApis = ref<string[]>([])

  const menuTypeText = (type: string) =>
    ({ directory: '目录', menu: '菜单', button: '按钮', link: '外链' })[type] || type
  const menuTypeTag = (type: string) =>
    (
      ({ directory: 'info', menu: 'primary', button: 'warning', link: 'success' }) as Record<
        string,
        'primary' | 'success' | 'warning' | 'info'
      >
    )[type] || 'info'

  /** 扁平列表 → 树（两遍构建：先 Map 后挂载，不假设父先于子） */
  const buildTree = (items: Api.Menu.MenuAdminNode[]): MenuTreeNode[] => {
    const nodeMap = new Map<string, MenuTreeNode>()
    items.forEach((item) => {
      nodeMap.set(item.id, {
        id: item.id,
        label: item.menu_name,
        menu_type: item.menu_type
      })
    })
    const roots: MenuTreeNode[] = []
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

  const loadData = async () => {
    if (!props.roleCode) return
    loading.value = true
    try {
      // 1. iam_menu 全量视图（含 button/perms/component，编辑回显用）
      const menuResult = await getMenuList({ limit: 1000, offset: 0 })
      menuTree.value = buildTree(menuResult.items)

      // 2. iam_api 全量
      const apiResult = await getApiList({ limit: 1000, offset: 0 })
      apiList.value = apiResult.items

      // 3. 已选回显（get_role_permissions，入参 p_role_code）
      const detail = await getRolePermissions(props.roleCode)
      const menuIds = detail.menus.map((item) => item.id)
      const apiIds = detail.apis.map((item) => item.id)

      nextTick(() => {
        // 父子联动回显：setCheckedKeys 自动带父链（half-checked 由树内部维护）
        menuTreeRef.value?.setCheckedKeys(menuIds)
        checkedApis.value = apiIds
      })
    } catch (error) {
      console.error('加载权限数据失败:', error)
      ElMessage.error('加载权限数据失败')
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) loadData()
    }
  )

  const handleSave = async () => {
    if (!props.roleCode) return
    saving.value = true
    try {
      // 父子联动：checked + halfChecked 合并（半选父节点也要进绑定集）
      const checked = menuTreeRef.value?.getCheckedKeys() || []
      const halfChecked = menuTreeRef.value?.getHalfCheckedKeys() || []
      const menuIds = [...new Set([...checked, ...halfChecked])] as string[]

      // 数组参数：PostgREST 传 JSON 数组（p_menu_ids / p_api_codes）
      await setRoleMenus(props.roleCode, menuIds)
      await setRoleApis(props.roleCode, checkedApis.value)
      ElMessage.success('权限保存成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存权限失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
