<!-- 字典数据项新增/编辑弹窗（rpc_create_dict_data / rpc_update_dict_data）
  注意：update RPC 无 p_dict_name 参数 → 编辑时字典编码只读展示 -->
<template>
  <ElDialog
    :model-value="visible"
    :title="type === 'add' ? '新增数据项' : '编辑数据项'"
    width="480px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="字典编码" prop="dict_name">
        <ElSelect
          v-if="type === 'add'"
          v-model="form.dict_name"
          filterable
          placeholder="选择字典类型"
          class="w-full"
        >
          <ElOption
            v-for="item in dictTypeOptions"
            :key="item.dict_name"
            :label="`${item.dict_label}（${item.dict_name}）`"
            :value="item.dict_name"
          />
        </ElSelect>
        <ElInput v-else :model-value="form.dict_name" disabled />
      </ElFormItem>
      <ElFormItem label="显示名" prop="item_label">
        <ElInput v-model="form.item_label" placeholder="如 男" clearable />
      </ElFormItem>
      <ElFormItem label="值" prop="item_value">
        <ElInput v-model="form.item_value" placeholder="如 male" clearable />
      </ElFormItem>
      <ElFormItem label="类型" prop="item_type">
        <ElInput v-model="form.item_type" placeholder="如 string / number" clearable />
      </ElFormItem>
      <ElFormItem label="默认" prop="is_default">
        <ElSwitch v-model="form.is_default" />
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
  import { getDictTypes, createDictData, updateDictData } from '@/api/dict'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    type: 'add' | 'edit'
    editData: Api.SystemManage.DictData | null
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  const formRef = ref<FormInstance>()
  const saving = ref(false)
  const dictTypeOptions = ref<Api.SystemManage.DictType[]>([])

  const form = reactive({
    dict_name: '',
    item_label: '',
    item_value: '',
    item_type: 'string',
    is_default: false,
    sort_no: 0,
    status: 'active' as string
  })

  const rules = reactive<FormRules>({
    dict_name: [{ required: true, message: '请选择字典类型', trigger: 'change' }],
    item_label: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
    item_value: [{ required: true, message: '请输入值', trigger: 'blur' }]
  })

  // 新增时加载字典类型下拉（编辑无需，编码只读）
  const loadDictTypes = async () => {
    if (props.type !== 'add') return
    try {
      const result = await getDictTypes({ limit: 200 })
      dictTypeOptions.value = result.items
    } catch (error) {
      console.error('加载字典类型失败:', error)
      dictTypeOptions.value = []
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      loadDictTypes()
      if (props.type === 'edit' && props.editData) {
        form.dict_name = props.editData.dict_name
        form.item_label = props.editData.item_label
        form.item_value = props.editData.item_value
        form.item_type = props.editData.item_type
        form.is_default = props.editData.is_default
        form.sort_no = props.editData.sort_no
        form.status = String(props.editData.status)
      } else {
        form.dict_name = ''
        form.item_label = ''
        form.item_value = ''
        form.item_type = 'string'
        form.is_default = false
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
        await createDictData({
          p_dict_name: form.dict_name,
          p_item_label: form.item_label,
          p_item_value: form.item_value,
          p_item_type: form.item_type,
          p_is_default: form.is_default,
          p_sort_no: form.sort_no
        })
        ElMessage.success('创建成功')
      } else if (props.editData) {
        await updateDictData({
          p_id: props.editData.id,
          p_item_label: form.item_label,
          p_item_value: form.item_value,
          p_item_type: form.item_type,
          p_is_default: form.is_default,
          p_sort_no: form.sort_no,
          p_status: form.status === 'active'
        })
        ElMessage.success('更新成功')
      }
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存数据项失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
