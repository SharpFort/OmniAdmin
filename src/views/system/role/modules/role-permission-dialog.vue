<!-- 角色权限分配弹窗（C-4：iam_menu 全量视图组树 + get_role_permissions 已选回显 + 父子联动）
  父子联动（§2.4 风险）：勾选子节点自动带父链；提交 = checkedKeys + halfCheckedKeys 合并
  （半选父节点也要进绑定集，否则 get_user_menu 递归 CTE 会丢失子树）
  041 一键授权：勾选菜单自动 grant 子树 API / 取消勾选自动 revoke；行内「授权API」按钮可补授
  042 数据范围：radio 四态 + 自定义部门树多选（rpc_get_dept_tree），独立保存（sys:data-scope:bind） -->
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
            勾选菜单 → 自动一键授权其子树 API；取消勾选 → 自动撤销；行内「授权API」可随时补授
          </div>
          <el-tree
            ref="menuTreeRef"
            :data="menuTree"
            show-checkbox
            node-key="id"
            default-expand-all
            :props="{ label: 'label', children: 'children' }"
            class="max-h-96 overflow-auto"
            @check="handleMenuCheck"
          >
            <template #default="{ data }">
              <span class="flex items-center">
                {{ data.label }}
                <el-tag size="small" class="ml-2" :type="menuTypeTag(data.menu_type)">
                  {{ menuTypeText(data.menu_type) }}
                </el-tag>
                <el-button
                  v-if="data.menu_type !== 'button'"
                  v-perm="'sys:role-api:bind'"
                  link
                  type="primary"
                  size="small"
                  class="ml-2"
                  @click.stop="handleGrantOne(data)"
                >
                  授权API
                </el-button>
              </span>
            </template>
          </el-tree>
        </el-tab-pane>
        <el-tab-pane label="API 权限" name="apis">
          <div class="max-h-96 overflow-auto border border-g-300 rounded p-3">
            <div v-if="!apiGroups.length" class="text-xs opacity-60">暂无 API 权限点</div>
            <div v-for="group in apiGroups" :key="group.name" class="mb-3">
              <div class="mb-1 flex items-center gap-2">
                <span class="text-xs font-semibold">{{ group.name }}</span>
                <span class="text-xs opacity-50">{{ group.items.length }} 个</span>
              </div>
              <el-checkbox-group v-model="checkedApis" class="flex flex-col gap-1">
                <el-checkbox v-for="api in group.items" :key="api.id" :value="api.id">
                  <span class="flex items-center gap-2">
                    <el-tag size="small" type="info">{{ api.method }}</el-tag>
                    <code class="text-xs">{{ api.path }}</code>
                    <span class="text-xs opacity-70">{{ api.api_code || api.name }}</span>
                  </span>
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
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
                v-perm="'sys:data-scope:bind'"
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
    getApiList,
    getDeptTree,
    getRoleDataScope,
    setRoleDataScope,
    grantMenuSubtreeApis,
    revokeMenuSubtreeApis
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

  // 菜单树（iam_menu 全量视图 + 前端两遍构建）
  interface MenuTreeNode {
    id: string
    label: string
    menu_type: string
    children?: MenuTreeNode[]
  }
  const menuTree = ref<MenuTreeNode[]>([])

  // API 权限点（iam_api 全量；039 api_group 分组展示）
  const apiList = ref<Api.SystemManage.ApiAdminNode[]>([])
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

  /** 菜单树（iam_menu 全量） */
  const buildMenuTree = (items: Api.Menu.MenuAdminNode[]): MenuTreeNode[] => {
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

  // 041 一键授权联动
  const handleMenuCheck = async (
    data: MenuTreeNode,
    info: { checkedKeys: Array<string | number> }
  ) => {
    // button 节点无归属 API 语义，跳过联动
    if (data.menu_type === 'button') return
    const checked = info.checkedKeys.includes(data.id)
    try {
      if (checked) {
        const res = await grantMenuSubtreeApis(props.roleCode, data.id)
        ElMessage.success(`「${data.label}」新增授权 ${res.granted} 个 API（共 ${res.total} 个）`)
      } else {
        const res = await revokeMenuSubtreeApis(props.roleCode, data.id)
        ElMessage.success(`「${data.label}」已撤销 ${res.removed} 个 API`)
      }
      // 授权结果影响 API 勾选回显，重新拉取
      await reloadApiChecked()
    } catch (error) {
      console.error('菜单子树 API 联动失败:', error)
      ElMessage.warning('菜单子树 API 联动失败（可能无 sys:role-api:bind 权限），请检查')
    }
  }

  /** 行内「授权API」按钮：对单个菜单（含子树）一键授权 */
  const handleGrantOne = async (data: MenuTreeNode) => {
    try {
      const res = await grantMenuSubtreeApis(props.roleCode, data.id)
      ElMessage.success(`「${data.label}」新增授权 ${res.granted} 个 API（共 ${res.total} 个）`)
      await reloadApiChecked()
    } catch (error) {
      console.error('一键授权失败:', error)
      ElMessage.warning('一键授权失败（可能无 sys:role-api:bind 权限），请检查')
    }
  }

  /** 刷新 API 勾选回显（grant/revoke 后） */
  const reloadApiChecked = async () => {
    try {
      const detail = await getRolePermissions(props.roleCode)
      checkedApis.value = detail.apis.map((item) => item.id)
    } catch (error) {
      console.warn('刷新 API 勾选失败:', error)
    }
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
      // 1. iam_menu 全量视图（含 button/perms/component，编辑回显用）
      const menuResult = await getMenuList({ limit: 1000, offset: 0 })
      menuTree.value = buildMenuTree(menuResult.items)

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
      if (val) {
        scopeLoaded.value = false
        loadData()
      }
    }
  )

  /** API 列表按 api_group 分组（039；空分组归「未分组」） */
  const apiGroups = computed(() => {
    const map = new Map<string, Api.SystemManage.ApiAdminNode[]>()
    apiList.value.forEach((api) => {
      const group = api.api_group || '未分组'
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(api)
    })
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
  })

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
