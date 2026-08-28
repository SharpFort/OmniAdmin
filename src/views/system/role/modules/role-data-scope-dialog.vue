<!-- 角色数据范围分配弹窗（独立弹窗，参考 sharpfort-net-vue role-data-scope-dialog：
  select 四态 + 自定义部门树 check-strictly + 父子联动仅向下（防权限放大）） -->
<template>
  <ElDialog
    :model-value="visible"
    title="分配数据权限"
    width="600px"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" v-loading="loading">
      <el-form-item label="角色名称">
        <el-input v-model.trim="form.roleName" disabled />
      </el-form-item>
      <el-form-item label="角色编码">
        <el-input v-model.trim="form.roleCode" disabled />
      </el-form-item>

      <el-form-item label="数据范围" prop="scopeType">
        <el-select v-model="form.scopeType" placeholder="请选择数据范围" style="width: 100%">
          <el-option label="全部数据" value="all" />
          <el-option label="本部门及以下" value="dept_and_child" />
          <el-option label="仅本人数据" value="self" />
          <el-option label="自定义部门" value="custom" />
        </el-select>
      </el-form-item>

      <el-form-item label="数据权限" v-if="form.scopeType === 'custom'">
        <div class="dept-scope-box">
          <div class="dept-scope-toolbar">
            <el-checkbox v-model="expandAll" @change="handleExpandChange">展开/折叠</el-checkbox>
            <el-checkbox v-model="linkage">父子联动(仅向下)</el-checkbox>
          </div>
          <el-tree
            ref="deptTreeRef"
            :data="deptTree"
            show-checkbox
            node-key="id"
            :default-expand-all="expandAll"
            :check-strictly="true"
            :props="{ label: 'label', children: 'children' }"
            class="dept-tree"
            @check="handleNodeCheck"
          />
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">确 定</el-button>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { reactive, ref, nextTick } from 'vue'
  import type { ElTree, FormInstance } from 'element-plus'
  import { getRoleDataScope, setRoleDataScope, getDeptTree } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    roleCode: string
    roleName?: string
  }>()

  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  interface DeptNode {
    id: string
    label: string
    children?: DeptNode[]
  }

  const formRef = ref<FormInstance>()
  const deptTreeRef = ref<InstanceType<typeof ElTree>>()
  const loading = ref(false)
  const saving = ref(false)
  const deptTree = ref<DeptNode[]>([])
  const expandAll = ref(true)
  const linkage = ref(true)

  const form = reactive({
    roleName: '',
    roleCode: '',
    scopeType: 'all' as Api.SystemManage.RoleDataScope['scope_type']
  })

  const rules = {
    scopeType: [{ required: true, message: '请选择数据范围', trigger: 'change' }]
  }

  /** get_dept_tree 扁平 → 树 */
  const buildDeptTree = (items: Api.SystemManage.DeptNode[]): DeptNode[] => {
    const nodeMap = new Map<string, DeptNode>()
    items.forEach((item) => nodeMap.set(item.id, { id: item.id, label: item.dept_name }))
    const roots: DeptNode[] = []
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

  /** 展开/折叠 */
  const handleExpandChange = (val: any) => {
    if (!deptTree.value || deptTree.value.length === 0) return
    const nodes = deptTreeRef.value?.store.nodesMap
    if (nodes) {
      for (const key in nodes) {
        nodes[key].expanded = val
      }
    }
  }

  /** 递归取所有子节点 id */
  const getAllChildIds = (node: DeptNode, ids: string[] = []): string[] => {
    if (node.children && node.children.length) {
      node.children.forEach((child) => {
        ids.push(child.id)
        getAllChildIds(child, ids)
      })
    }
    return ids
  }

  /**
   * 严苛的独立勾选逻辑（check-strictly=true）：
   * 勾选/取消父节点 → 仅向下传递给所有子节点；子节点变化绝不向上传递父节点，防止数据权限放大。
   */
  const handleNodeCheck = (data: any, info: any) => {
    if (!linkage.value) return
    const isChecked = info.checkedKeys.includes(data.id)
    const childIds = getAllChildIds(data)
    if (childIds.length === 0) return

    const currentCheckedKeys = new Set(deptTreeRef.value?.getCheckedKeys() || [])
    if (isChecked) {
      childIds.forEach((id) => currentCheckedKeys.add(id))
    } else {
      childIds.forEach((id) => currentCheckedKeys.delete(id))
    }
    deptTreeRef.value?.setCheckedKeys(Array.from(currentCheckedKeys))
  }

  /** 弹窗打开：加载数据范围 + 部门树 + 回显 */
  const handleOpen = async () => {
    if (!props.roleCode) return
    loading.value = true
    form.roleCode = props.roleCode
    form.roleName = props.roleName || props.roleCode
    form.scopeType = 'all'
    linkage.value = true
    expandAll.value = true
    try {
      const [scope, depts] = await Promise.all([getRoleDataScope(props.roleCode), getDeptTree()])
      form.scopeType = scope.scope_type || 'all'
      deptTree.value = buildDeptTree(depts)

      if (form.scopeType === 'custom') {
        const checkedIds = (scope.depts || []).map((d) => d.id)
        nextTick(() => {
          deptTreeRef.value?.setCheckedKeys(checkedIds)
        })
      }
    } catch (error) {
      console.error('加载数据范围失败:', error)
      ElMessage.error('加载数据范围失败')
    } finally {
      loading.value = false
    }
  }

  /** 保存：仅取完全选中的节点（check-strictly 下无半选），防止上级放大 */
  const handleSave = async () => {
    if (!props.roleCode) return
    saving.value = true
    try {
      let deptIds: string[] | undefined
      if (form.scopeType === 'custom') {
        deptIds = (deptTreeRef.value?.getCheckedKeys() || []) as string[]
        if (!deptIds.length) {
          ElMessage.warning('请选择自定义部门')
          return
        }
      }
      await setRoleDataScope(props.roleCode, form.scopeType, deptIds)
      ElMessage.success('分配数据权限成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('分配数据权限失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped lang="scss">
  .dept-scope-box {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
  }

  .dept-scope-toolbar {
    display: flex;
    gap: 16px;
    margin-bottom: 10px;
  }

  .dept-tree {
    max-height: 40vh;
    overflow: auto;
  }
</style>
