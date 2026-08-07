<!-- 字典类型新增/编辑弹窗（rpc_create_dict_type / rpc_update_dict_type） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="type === 'add' ? '新增字典类型' : '编辑字典类型'"
    width="520px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
      <ElFormItem label="字典编码" prop="dict_name">
        <ElInput
          v-model="form.dict_name"
          placeholder="如 sys_gender"
          :disabled="type === 'edit'"
          clearable
        />
      </ElFormItem>
      <ElFormItem label="字典名称" prop="dict_label">
        <ElInput v-model="form.dict_label" placeholder="如 性别" clearable />
      </ElFormItem>
      <ElFormItem label="租户级" prop="tenant_scoped">
        <ElSwitch v-model="form.tenant_scoped" active-text="租户级" inactive-text="全局" />
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
  import { createDictType, updateDictType } from '@/api/dict'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    editData: Api.SystemManage.DictType | null
  }
  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  const formRef = ref<FormInstance>()
  const saving = ref(false)

  const form = reactive({
    dict_name: '',
    dict_label: '',
    tenant_scoped: false,
    sort_no: 0,
    status: 'active' as string
  })

  const rules = reactive<FormRules>({
    dict_name: [{ required: true, message: '请输入字典编码', trigger: 'blur' }],
    dict_label: [{ required: true, message: '请输入字典名称', trigger: 'blur' }]
  })

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      if (props.type === 'edit' && props.editData) {
        form.dict_name = props.editData.dict_name
        form.dict_label = props.editData.dict_label
        form.sort_no = props.editData.sort_no
        form.status = String(props.editData.status)
      } else {
        form.dict_name = ''
        form.dict_label = ''
        form.tenant_scoped = false
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
        await createDictType({
          p_dict_name: form.dict_name,
          p_dict_label: form.dict_label,
          p_tenant_scoped: form.tenant_scoped,
          p_sort_no: form.sort_no
        })
        ElMessage.success('创建成功')
      } else if (props.editData) {
        await updateDictType({
          p_id: props.editData.id,
          p_dict_label: form.dict_label,
          p_sort_no: form.sort_no,
          p_status: form.status === 'active'
        })
        ElMessage.success('更新成功')
      }
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存字典类型失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
