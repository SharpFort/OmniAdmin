<!-- 部门新增/编辑弹窗（rpc_create_department / rpc_update_department） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="type === 'add' ? '新增部门' : '编辑部门'"
    width="520px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="上级部门" prop="parent_id">
        <el-tree-select
          v-model="form.parent_id"
          :data="parentOptions"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          check-strictly
          clearable
          placeholder="不选则为顶级部门"
          class="w-full"
        />
      </ElFormItem>
      <ElFormItem label="部门名称" prop="dept_name">
        <ElInput v-model="form.dept_name" placeholder="请输入部门名称" clearable />
      </ElFormItem>
      <ElFormItem label="排序" prop="sort_order">
        <ElInputNumber v-model="form.sort_order" :min="0" class="w-full" />
      </ElFormItem>
      <ElFormItem v-if="type === 'edit'" label="启用状态" prop="is_active">
        <ElSwitch v-model="form.is_active" active-text="启用" inactive-text="禁用" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { createDept, updateDept } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    editData: (Api.SystemManage.DeptNode & { children?: unknown[] }) | null
    deptTree: Array<Api.SystemManage.DeptNode & { children?: unknown[] }>
  }
  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  const formRef = ref<FormInstance>()
  const saving = ref(false)

  const form = reactive({
    parent_id: null as string | null,
    dept_name: '',
    sort_order: 0,
    is_active: true
  })

  const rules = reactive<FormRules>({
    dept_name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }]
  })

  const parentOptions = computed(() => {
    const editId = props.editData?.id
    const excluded = new Set<string>()
    if (editId) {
      const collect = (nodes: Array<Api.SystemManage.DeptNode & { children?: unknown[] }>) => {
        nodes.forEach((node) => {
          excluded.add(node.id)
          if (node.children?.length) collect(node.children as typeof nodes)
        })
      }
      collect(props.deptTree.filter((node) => node.id === editId))
    }
    const mapNode = (node: Api.SystemManage.DeptNode & { children?: unknown[] }): any => ({
      id: node.id,
      label: node.dept_name,
      children: node.children?.length
        ? (node.children as typeof props.deptTree)
            .filter((child) => !excluded.has(child.id))
            .map(mapNode)
        : undefined
    })
    return props.deptTree.filter((node) => !excluded.has(node.id)).map(mapNode)
  })

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      if (props.type === 'edit' && props.editData) {
        form.parent_id = props.editData.parent_id
        form.dept_name = props.editData.dept_name
        form.sort_order = props.editData.sort_order
        form.is_active = props.editData.is_active
      } else {
        form.parent_id = (props.editData?.parent_id as string | null) ?? null
        form.dept_name = ''
        form.sort_order = 0
        form.is_active = true
      }
      formRef.value?.clearValidate()
    }
  )

  const handleSave = async () => {
    if (!formRef.value) return
    try {
      await formRef.value.validate()
    } catch {
      return
    }
    saving.value = true
    try {
      if (props.type === 'add') {
        await createDept({
          p_dept_name: form.dept_name,
          p_parent_id: form.parent_id,
          p_sort_order: form.sort_order
        })
        ElMessage.success('创建成功')
      } else if (props.editData) {
        await updateDept({
          p_id: props.editData.id,
          p_parent_id: form.parent_id,
          p_dept_name: form.dept_name,
          p_sort_order: form.sort_order,
          p_is_active: form.is_active
        })
        ElMessage.success('更新成功')
      }
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存部门失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
