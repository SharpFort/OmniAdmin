<!-- 岗位新增/编辑弹窗（rpc_create_position / rpc_update_position） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="type === 'add' ? '新增岗位' : '编辑岗位'"
    width="520px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="上级岗位" prop="parent_id">
        <el-tree-select
          v-model="form.parent_id"
          :data="parentOptions"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          check-strictly
          clearable
          placeholder="不选则为顶级岗位"
          class="w-full"
        />
      </ElFormItem>
      <ElFormItem label="岗位名称" prop="pos_name">
        <ElInput v-model="form.pos_name" placeholder="请输入岗位名称" clearable />
      </ElFormItem>
      <ElFormItem label="岗位编码" prop="pos_code">
        <ElInput v-model="form.pos_code" placeholder="如 frontend-engineer" clearable />
      </ElFormItem>
      <ElFormItem label="排序" prop="sort_no">
        <ElInputNumber v-model="form.sort_no" :min="0" class="w-full" />
      </ElFormItem>
      <ElFormItem v-if="type === 'edit'" label="启用状态" prop="status">
        <ElSwitch
          v-model="form.status"
          active-value="active"
          inactive-value="inactive"
          active-text="启用"
          inactive-text="禁用"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { createPosition, updatePosition } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    editData: (Api.SystemManage.PositionNode & { children?: unknown[] }) | null
    positionTree: Array<Api.SystemManage.PositionNode & { children?: unknown[] }>
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
    pos_name: '',
    pos_code: '',
    sort_no: 0,
    status: 'active' as string
  })

  const rules = reactive<FormRules>({
    pos_name: [{ required: true, message: '请输入岗位名称', trigger: 'blur' }]
  })

  const parentOptions = computed(() => {
    const editId = props.editData?.id
    const excluded = new Set<string>()
    if (editId) {
      const collect = (nodes: Array<Api.SystemManage.PositionNode & { children?: unknown[] }>) => {
        nodes.forEach((node) => {
          excluded.add(node.id)
          if (node.children?.length) collect(node.children as typeof nodes)
        })
      }
      collect(props.positionTree.filter((node) => node.id === editId))
    }
    const mapNode = (node: Api.SystemManage.PositionNode & { children?: unknown[] }): any => ({
      id: node.id,
      label: node.pos_name,
      children: node.children?.length
        ? (node.children as typeof props.positionTree)
            .filter((child) => !excluded.has(child.id))
            .map(mapNode)
        : undefined
    })
    return props.positionTree.filter((node) => !excluded.has(node.id)).map(mapNode)
  })

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      if (props.type === 'edit' && props.editData) {
        form.parent_id = props.editData.parent_id
        form.pos_name = props.editData.pos_name
        form.pos_code = props.editData.pos_code || ''
        form.sort_no = props.editData.sort_no
        // 后端 status 可能为 boolean/1/active 等形式，统一归一到 active/inactive 供 Switch 使用
        const raw = props.editData.status as unknown
        const active =
          raw === true || raw === 'true' || raw === 'active' || raw === 1 || raw === '1'
        form.status = active ? 'active' : 'inactive'
      } else {
        form.parent_id = (props.editData?.parent_id as string | null) ?? null
        form.pos_name = ''
        form.pos_code = ''
        form.sort_no = 0
        form.status = 'active'
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
        await createPosition({
          p_pos_name: form.pos_name,
          p_parent_id: form.parent_id,
          p_pos_code: form.pos_code || null,
          p_sort_no: form.sort_no
        })
        ElMessage.success('创建成功')
      } else if (props.editData) {
        await updatePosition({
          p_id: props.editData.id,
          p_parent_id: form.parent_id,
          p_pos_name: form.pos_name,
          p_pos_code: form.pos_code || null,
          p_sort_no: form.sort_no,
          p_status: form.status === 'active'
        })
        ElMessage.success('更新成功')
      }
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存岗位失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
