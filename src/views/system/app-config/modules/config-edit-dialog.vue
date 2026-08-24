<!-- 配置值编辑弹窗（update_config RPC；platform:config:write 仅超管） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`编辑配置 - ${editData?.config_key || ''}`"
    width="520px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="配置键" prop="config_key">
        <ElInput :model-value="form.config_key" disabled />
      </ElFormItem>
      <ElFormItem label="类型" prop="config_type">
        <el-tag :type="typeTagType(form.config_type)">{{ form.config_type }}</el-tag>
      </ElFormItem>
      <ElFormItem label="配置值" prop="config_value">
        <ElInput
          v-model="form.config_value"
          type="textarea"
          :rows="3"
          :placeholder="valuePlaceholder"
        />
      </ElFormItem>
      <ElFormItem label="描述">
        <span class="text-xs opacity-70">{{ editData?.description || '—' }}</span>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { updateConfig } from '@/api/system-manage'
  import { ElMessage, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    editData: Api.SystemManage.AppConfigRow | null
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  const formRef = ref<FormInstance>()
  const saving = ref(false)

  const form = reactive({
    config_key: '',
    config_value: '',
    config_type: 'string'
  })

  const rules = reactive<FormRules>({
    config_value: [{ required: true, message: '请输入配置值', trigger: 'blur' }]
  })

  const typeTagType = (type: string) =>
    (
      ({ string: 'info', number: 'warning', boolean: 'success', json: 'danger' }) as Record<
        string,
        any
      >
    )[type] || 'info'

  const valuePlaceholder = computed(() => {
    switch (form.config_type) {
      case 'boolean':
        return 'true / false'
      case 'number':
        return '数字'
      case 'json':
        return 'JSON 文本'
      default:
        return '文本'
    }
  })

  watch(
    () => props.visible,
    (val) => {
      if (!val || !props.editData) return
      form.config_key = props.editData.config_key
      form.config_value = props.editData.config_value ?? ''
      form.config_type = props.editData.config_type
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
      await updateConfig(form.config_key, form.config_value)
      ElMessage.success('更新成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存配置失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
