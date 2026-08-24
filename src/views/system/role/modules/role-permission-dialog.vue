<!-- 角色权限分配弹窗（055 单表化重写：授权树 = 菜单树勾选——API 授权随按钮菜单勾选继承，
  SharpFort RoleMenu 单绑定模型；删除 API 权限 tab / 041 一键授权联动 / setRoleApis 保存通道；
  按钮叶子行内展示 api_code + api_url/api_method；父子联动保留（checked + halfChecked 合并））
  042 数据范围：radio 四态 + 自定义部门树多选（rpc_get_dept_tree），独立保存（platform:data-scope:bind） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`权限分配 - ${roleCode}`"
    width="800px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="菜单权限" name="menus">
          <div class="mb-2 text-xs opacity-60">
            菜单树勾选 = 授权（目录/菜单/按钮）；按钮行即权限点——勾选按钮 = 授予该权限码与其接口端点
          </div>
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
              <span class="flex flex-col py-0.5">
                <span class="flex items-center">
                  {{ data.label }}
                  <el-tag size="small" class="ml-2" :type="menuTypeTag(data.menu_type)">
                    {{ menuTypeText(data.menu_type) }}
                  </el-tag>
                  <el-tag
                    v-if="data.menu_type === 'button' && data.api_method"
                    size="small"
                    type="info"
                    class="ml-1 font-mono"
                  >
                    {{ data.api_method }}
                  </el-tag>
                </span>
                <!-- 按钮叶子：权限码 + 接口端点展示（055 单表化） -->
                <span v-if="data.menu_type === 'button'" class="text-xs opacity-60">
                  <code class="mr-1">{{ data.api_code || '（无权限码）' }}</code>
                  <code v-if="data.api_url">{{ data.api_url }}</code>
                </span>
              </span>
            </template>
          </el-tree>
        </el-tab-pane>
        <el-tab-pane label="数据范围" name="scope">
          <div v-loading="scopeLoading" class="flex flex-col gap-3">
            <el-radio-group v-model="scopeType" class="flex flex-col items-start gap-2">
              <el-radio value="all">全部数据</el-radio>
              <el-radio value="dept_and_child">本部门及以下</el-radio>
              <el-radio value="self">仅本人</el-radio>
              <el-radio value="custom">自定义部门</el-radio>
            </el-radio-group>
            <div v-if="scopeType === 'custom'" class="border border-g-300 rounded p-3">
              <div class="mb-1 text-xs opacity-60">勾选可访问的部门（含子部门）</div>
              <el-tree
                ref="deptTreeRef"
                :data="deptTree"
                show-checkbox
                node-key="id"
                default-expand-all
                :props="{ label: 'label', children: 'children' }"
                class="max-h-72 overflow-auto"
              />
            </div>
            <div class="flex justify-end">
              <ElButton
                type="primary"
                :loading="scopeSaving"
                v-perm="'platform:data-scope:bind'"
                @click="handleSaveScope"
              >
                保存数据范围
              </ElButton>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton
        type="primary"
        :loading="saving"
        v-perm="'platform:role-menu:bind'"
        @click="handleSave"
      >
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { ElTree } from 'element-plus'
  import {
    getRolePermissions,
    setRoleMenus,
    getMenuList,
    getDeptTree,
    getRoleDataScope,
    setRoleDataScope
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
  const deptTreeRef = ref<InstanceType<typeof ElTree>>()

  // 菜单树（iam_menu 全量视图 + 前端两遍构建；055 单表化：button 叶子 = 权限点）
  interface MenuTreeNode {
    id: string
    label: string
    menu_type: string
    api_code: string | null
    api_url: string | null
    api_method: string | null
    children?: MenuTreeNode[]
  }
  const menuTree = ref<MenuTreeNode[]>([])

  const menuTypeText = (type: string) =>
    ({ directory: '目录', menu: '菜单', button: '按钮', link: '外链' })[type] || type
  const menuTypeTag = (type: string) =>
    (
      ({ directory: 'info', menu: 'primary', button: 'warning', link: 'success' }) as Record<
        string,
        'primary' | 'success' | 'warning' | 'info'
      >
    )[type] || 'info'

  /** 菜单树（iam_menu 全量；055：按钮叶子携带端点信息） */
  const buildMenuTree = (items: Api.Menu.MenuAdminNode[]): MenuTreeNode[] => {
    const nodeMap = new Map<string, MenuTreeNode>()
    items.forEach((item) => {
      nodeMap.set(item.id, {
        id: item.id,
        label: item.menu_name,
        menu_type: item.menu_type,
        api_code: item.api_code,
        api_url: item.api_url,
        api_method: item.api_method
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

  /** 部门树（rpc_get_dept_tree 扁平带 parent_id） */
  interface DeptTreeNode {
    id: string
    label: string
    children?: DeptTreeNode[]
  }
  const deptTree = ref<DeptTreeNode[]>([])
  const buildDeptTree = (items: Api.SystemManage.DeptNode[]): DeptTreeNode[] => {
    const nodeMap = new Map<string, DeptTreeNode>()
    items.forEach((item) => {
      nodeMap.set(item.id, { id: item.id, label: item.dept_name })
    })
    const roots: DeptTreeNode[] = []
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

  // 042 数据范围
  const scopeLoading = ref(false)
  const scopeSaving = ref(false)
  const scopeType = ref<Api.SystemManage.RoleDataScope['scope_type']>('self')
  const scopeLoaded = ref(false)

  /** 进入数据范围 tab 时加载（默认 self；custom 时回显部门勾选） */
  const loadScope = async () => {
    if (scopeLoading.value || scopeLoaded.value) return
    scopeLoading.value = true
    try {
      const [scope, depts] = await Promise.all([getRoleDataScope(props.roleCode), getDeptTree()])
      scopeType.value = scope.scope_type || 'self'
      deptTree.value = buildDeptTree(depts)
      nextTick(() => {
        const ids = (scope.depts || []).map((d) => d.id)
        deptTreeRef.value?.setCheckedKeys(ids)
      })
      scopeLoaded.value = true
    } catch (error) {
      console.error('加载数据范围失败:', error)
      ElMessage.error('加载数据范围失败')
    } finally {
      scopeLoading.value = false
    }
  }

  const handleSaveScope = async () => {
    if (!props.roleCode) return
    scopeSaving.value = true
    try {
      let deptIds: string[] | undefined
      if (scopeType.value === 'custom') {
        const checked = deptTreeRef.value?.getCheckedKeys() || []
        const halfChecked = deptTreeRef.value?.getHalfCheckedKeys() || []
        deptIds = [...new Set([...checked, ...halfChecked])] as string[]
        if (!deptIds.length) {
          ElMessage.warning('请选择自定义部门')
          return
        }
      }
      await setRoleDataScope(props.roleCode, scopeType.value, deptIds)
      ElMessage.success('数据范围保存成功')
    } catch (error) {
      console.error('保存数据范围失败:', error)
    } finally {
      scopeSaving.value = false
    }
  }

  watch(activeTab, (tab) => {
    if (tab === 'scope') loadScope()
  })

  const loadData = async () => {
    if (!props.roleCode) return
    loading.value = true
    try {
      // 1. iam_menu 全量视图（055 单表化：button 叶子含端点信息，树即授权树）
      const menuResult = await getMenuList({ limit: 1000, offset: 0 })
      menuTree.value = buildMenuTree(menuResult.items)

      // 2. 已选回显（get_role_permissions：menus 段 = role_menu 绑定；055 后唯一授权数据）
      const detail = await getRolePermissions(props.roleCode)
      const menuIds = detail.menus.map((item) => item.id)

      nextTick(() => {
        // 父子联动回显：setCheckedKeys 自动带父链（half-checked 由树内部维护）
        menuTreeRef.value?.setCheckedKeys(menuIds)
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
      if (val) {
        scopeLoaded.value = false
        loadData()
      }
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

      // 055 单表化：唯一授权保存通道（API 授权随按钮菜单勾选继承，rpc_set_role_apis 已删除）
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
</script>
