<!-- 字典数据项管理弹窗（dict_data 视图 + rpc_create/update/delete_dict_data） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`数据项管理 - ${dictName}`"
    width="760px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="mb-3 flex items-center gap-2">
      <ElButton
        v-perm="'public:dict:create'"
        type="primary"
        size="small"
        @click="showDialog('add')"
      >
        新增数据项
      </ElButton>
    </div>
    <el-table v-loading="loading" :data="items" size="small" border max-height="420">
      <el-table-column prop="item_label" label="显示名" min-width="120" />
      <el-table-column prop="item_value" label="值" min-width="120" />
      <el-table-column prop="item_type" label="类型" width="90" />
      <el-table-column prop="is_default" label="默认" width="70" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.is_default" type="success" size="small">默认</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="sort_no" label="排序" width="70" align="center" />
      <el-table-column label="操作" width="150" align="right" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="showDialog('edit', row)"
            >编辑</el-button
          >
          <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <ElDialog
      :model-value="itemDialogVisible"
      :title="itemDialogType === 'add' ? '新增数据项' : '编辑数据项'"
      width="480px"
      append-to-body
      @update:model-value="itemDialogVisible = $event"
    >
      <ElForm ref="itemFormRef" :model="itemForm" :rules="itemRules" label-width="90px">
        <ElFormItem label="显示名" prop="item_label">
          <ElInput v-model="itemForm.item_label" placeholder="如 男" clearable />
        </ElFormItem>
        <ElFormItem label="值" prop="item_value">
          <ElInput v-model="itemForm.item_value" placeholder="如 male" clearable />
        </ElFormItem>
        <ElFormItem label="类型" prop="item_type">
          <ElInput v-model="itemForm.item_type" placeholder="如 string / number" clearable />
        </ElFormItem>
        <ElFormItem label="默认" prop="is_default">
          <ElSwitch v-model="itemForm.is_default" />
        </ElFormItem>
        <ElFormItem label="排序" prop="sort_no">
          <ElInputNumber v-model="itemForm.sort_no" :min="0" class="w-full" />
        </ElFormItem>
        <ElFormItem v-if="itemDialogType === 'edit'" label="启用状态" prop="status">
          <ElSwitch
            v-model="itemForm.status"
            active-value="active"
            inactive-value="inactive"
            active-text="启用"
            inactive-text="禁用"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="itemDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleItemSave">保存</ElButton>
      </template>
    </ElDialog>
  </ElDialog>
</template>

<script setup lang="ts">
  import { getDictDataList, createDictData, updateDictData, deleteDictData } from '@/api/dict'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    dictName: string
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  type DictData = Api.SystemManage.DictData

  const loading = ref(false)
  const saving = ref(false)
  const items = ref<DictData[]>([])

  const itemDialogVisible = ref(false)
  const itemDialogType = ref<'add' | 'edit'>('add')
  const editItemData = ref<DictData | null>(null)
  const itemFormRef = ref<FormInstance>()

  const itemForm = reactive({
    item_label: '',
    item_value: '',
    item_type: 'string',
    is_default: false,
    sort_no: 0,
    status: 'active' as string
  })

  const itemRules = reactive<FormRules>({
    item_label: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
    item_value: [{ required: true, message: '请输入值', trigger: 'blur' }]
  })

  const loadItems = async () => {
    if (!props.dictName) return
    loading.value = true
    try {
      const result = await getDictDataList({ dictName: props.dictName, limit: 200 })
      items.value = result.items
    } catch (error) {
      console.error('获取数据项失败:', error)
      items.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) loadItems()
    }
  )

  const showDialog = (type: 'add' | 'edit', row?: any) => {
    itemDialogType.value = type
    editItemData.value = row || null
    if (type === 'edit' && row) {
      itemForm.item_label = row.item_label
      itemForm.item_value = row.item_value
      itemForm.item_type = row.item_type
      itemForm.is_default = row.is_default
      itemForm.sort_no = row.sort_no
      itemForm.status = String(row.status)
    } else {
      itemForm.item_label = ''
      itemForm.item_value = ''
      itemForm.item_type = 'string'
      itemForm.is_default = false
      itemForm.sort_no = 0
      itemForm.status = 'active'
    }
    itemFormRef.value?.clearValidate()
    itemDialogVisible.value = true
  }

  const handleItemSave = async () => {
    if (!itemFormRef.value) return
    try {
      await itemFormRef.value.validate()
    } catch {
      return
    }
    saving.value = true
    try {
      if (itemDialogType.value === 'add') {
        await createDictData({
          p_dict_name: props.dictName,
          p_item_label: itemForm.item_label,
          p_item_value: itemForm.item_value,
          p_item_type: itemForm.item_type,
          p_is_default: itemForm.is_default,
          p_sort_no: itemForm.sort_no
        })
        ElMessage.success('创建成功')
      } else if (editItemData.value) {
        await updateDictData({
          p_id: editItemData.value.id,
          p_item_label: itemForm.item_label,
          p_item_value: itemForm.item_value,
          p_item_type: itemForm.item_type,
          p_is_default: itemForm.is_default,
          p_sort_no: itemForm.sort_no,
          p_status: itemForm.status === 'active'
        })
        ElMessage.success('更新成功')
      }
      itemDialogVisible.value = false
      loadItems()
      emit('submit')
    } catch (error) {
      console.error('保存数据项失败:', error)
    } finally {
      saving.value = false
    }
  }

  const handleDelete = async (row: any) => {
    try {
      await ElMessageBox.confirm(`确定删除数据项「${row.item_label}」吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteDictData(row.id)
      ElMessage.success('删除成功')
      loadItems()
      emit('submit')
    } catch (error) {
      console.warn('删除数据项失败:', error)
    }
  }
</script>
