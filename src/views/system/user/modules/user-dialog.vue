<!-- 用户资料编辑弹窗（rpc_get_user_profile / rpc_update_user_profile） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`编辑资料 - ${username}`"
    width="560px"
    @update:model-value="emit('update:visible', $event)"
    @closed="handleClosed"
  >
    <div v-loading="loading">
      <ElAlert
        v-if="!hasEditableFields"
        type="info"
        :closable="false"
        show-icon
        title="该用户暂无资料字段可编辑（user_profile 未初始化），请先确认后端资料表结构"
        class="mb-3"
      />
      <ElForm ref="formRef" :model="form" label-width="100px">
        <ElFormItem
          v-for="field in editableFields"
          :key="field"
          :label="fieldLabel(field)"
          :prop="field"
        >
          <ElInput v-model="form[field]" :placeholder="`请输入${fieldLabel(field)}`" clearable />
        </ElFormItem>
      </ElForm>
    </div>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { getUserProfile, updateUserProfile } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import type { FormInstance } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    userId: string
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  // user_profile 系统列（白名单排除；§2.5：tenant_id/dept_id/时间戳/审计列不可改）
  const EXCLUDE_COLUMNS = new Set([
    'user_id',
    'tenant_id',
    'organization_id',
    'dept_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'created_by',
    'updated_by',
    'deleted_by'
  ])

  const loading = ref(false)
  const saving = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive<Record<string, any>>({})
  const editableFields = ref<string[]>([])
  const username = ref('')

  const hasEditableFields = computed(() => editableFields.value.length > 0)

  const fieldLabel = (field: string) => {
    const labelMap: Record<string, string> = {
      nickname: '昵称',
      avatar: '头像',
      gender: '性别',
      birthday: '生日',
      signature: '个性签名',
      remark: '备注'
    }
    return labelMap[field] || field
  }

  const loadProfile = async () => {
    if (!props.userId) return
    loading.value = true
    try {
      const profile = await getUserProfile(props.userId)
      username.value = String(profile.username ?? '')
      // 动态业务列：profile 返回键 − 系统排除列（后端白名单 = 全列 − 9 排除列）
      const keys = Object.keys(profile).filter((key) => !EXCLUDE_COLUMNS.has(key))
      editableFields.value = keys
      keys.forEach((key) => {
        form[key] = profile[key] == null ? '' : String(profile[key])
      })
    } catch (error) {
      console.error('获取用户资料失败:', error)
      editableFields.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) loadProfile()
    }
  )

  const handleClosed = () => {
    Object.keys(form).forEach((key) => delete form[key])
    editableFields.value = []
    username.value = ''
  }

  const handleSave = async () => {
    if (!props.userId || editableFields.value.length === 0) return
    saving.value = true
    try {
      // 只提交已填写的字段（空字符串不提交，避免误清空后端字段）
      const updates: Record<string, unknown> = {}
      editableFields.value.forEach((key) => {
        if (form[key] !== '' && form[key] != null) {
          updates[key] = form[key]
        }
      })
      await updateUserProfile(props.userId, updates)
      ElMessage.success('保存成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存用户资料失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
