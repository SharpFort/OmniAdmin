<!-- 用户资料编辑弹窗（rpc_get_user_profile / rpc_update_user_profile）
     ⚠️ rpc_get_user_profile 在 user_profile 无记录行时返回 {}（未建档）；
     rpc_update_user_profile 为 upsert（无记录自动 INSERT 建档）——
     未建档时也渲染已知业务字段表单，保存即自动建档 -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`编辑资料 - ${displayUsername}`"
    width="560px"
    @update:model-value="emit('update:visible', $event)"
    @closed="handleClosed"
  >
    <div v-loading="loading">
      <ElAlert
        v-if="!profileExists && !loading"
        type="info"
        :closable="false"
        show-icon
        title="该用户尚未建立资料档案（user_profile 无记录），填写后保存将自动创建档案"
        class="mb-3"
      />
      <ElForm ref="formRef" :model="form" label-width="100px">
        <template v-for="field in editableFields" :key="field">
          <!-- 头像：ElUpload 选择图片 / Ctrl+V 粘贴截图，压缩后存 avatar_url -->
          <ElFormItem v-if="meta(field).type === 'avatar'" :label="meta(field).label">
            <div class="flex w-full items-center gap-3">
              <ElUpload
                :auto-upload="false"
                :show-file-list="false"
                accept="image/*"
                :on-change="handleAvatarChange"
              >
                <div class="art-avatar-box" title="点击选择图片">
                  <img v-if="form.avatar_url" :src="String(form.avatar_url)" alt="头像" />
                  <ElIcon v-else :size="20"><Plus /></ElIcon>
                </div>
              </ElUpload>
              <div class="flex-1 text-xs leading-5 opacity-60">
                点击左侧方框选择图片，或直接 <b>Ctrl+V</b> 粘贴截图；图片自动压缩至 256×256 以内
                <div v-if="form.avatar_url">
                  <ElButton text type="danger" size="small" @click="form.avatar_url = ''">
                    移除头像
                  </ElButton>
                </div>
              </div>
            </div>
          </ElFormItem>

          <!-- 性别：枚举下拉（male/female/other/prefer_not_to_say） -->
          <ElFormItem v-else-if="meta(field).type === 'gender'" :label="meta(field).label">
            <ElSelect v-model="form[field]" clearable placeholder="请选择性别" class="w-full">
              <ElOption
                v-for="opt in GENDER_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
          </ElFormItem>

          <!-- 生日：日期选择器（date 列） -->
          <ElFormItem v-else-if="meta(field).type === 'date'" :label="meta(field).label">
            <ElDatePicker
              v-model="form[field]"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择生日"
              class="w-full"
            />
          </ElFormItem>

          <!-- 爱好：text[] 标签多选，可自由输入 -->
          <ElFormItem v-else-if="meta(field).type === 'tags'" :label="meta(field).label">
            <ElSelect
              v-model="form[field]"
              multiple
              filterable
              allow-create
              default-first-option
              :placeholder="meta(field).description"
              class="w-full"
            />
          </ElFormItem>

          <!-- 偏好设置：jsonb，JSON 编辑 -->
          <ElFormItem
            v-else-if="meta(field).type === 'json'"
            :label="meta(field).label"
            :error="preferencesJsonError"
          >
            <ElInput
              v-model="preferencesText"
              type="textarea"
              :rows="4"
              :placeholder="meta(field).description"
            />
          </ElFormItem>

          <!-- 个人简介：多行文本 -->
          <ElFormItem v-else-if="meta(field).type === 'textarea'" :label="meta(field).label">
            <ElInput
              v-model="form[field]"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              :placeholder="meta(field).description"
            />
          </ElFormItem>

          <!-- 其余（含未来新增列）：单行文本兜底 -->
          <ElFormItem v-else :label="meta(field).label">
            <ElInput
              v-model="form[field]"
              :maxlength="meta(field).maxLength"
              :placeholder="meta(field).description"
              clearable
            />
          </ElFormItem>
        </template>
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
  import type { FormInstance, UploadFile } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'

  const props = defineProps<{
    visible: boolean
    userId: string
    /** 列表行传入的用户名（user_profile 表无 username 列，RPC 返回中不含） */
    username?: string
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  // user_profile 系统列（白名单排除；rpc_update_user_profile 同款排除清单）
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

  type FieldType = 'text' | 'textarea' | 'avatar' | 'gender' | 'date' | 'tags' | 'json'
  interface FieldMeta {
    label: string
    /** 占位/说明文案 */
    description: string
    type: FieldType
    maxLength?: number
  }

  // user_profile 业务列元数据（与 OmniPG db/schema.sql 表结构逐一对应）
  const KNOWN_FIELDS: Record<string, FieldMeta> = {
    nickname: {
      label: '昵称',
      description: '请输入昵称（最长 64 字符）',
      type: 'text',
      maxLength: 64
    },
    avatar_url: { label: '头像', description: '支持上传图片或粘贴截图', type: 'avatar' },
    gender: { label: '性别', description: '请选择性别', type: 'gender' },
    birthday: { label: '生日', description: '请选择生日', type: 'date' },
    bio: { label: '个人简介', description: '一句话介绍自己（最长 500 字符）', type: 'textarea' },
    location: {
      label: '所在地',
      description: '如：上海市浦东新区（最长 200 字符）',
      type: 'text',
      maxLength: 200
    },
    hobbies: { label: '爱好', description: '输入后回车添加，可多个', type: 'tags' },
    website: { label: '个人网站', description: '如：https://example.com', type: 'text' },
    preferences: {
      label: '偏好设置',
      description: 'JSON 格式，如 {"theme":"dark","lang":"zh-CN"}',
      type: 'json'
    }
  }

  const GENDER_OPTIONS = [
    { value: 'male', label: '男' },
    { value: 'female', label: '女' },
    { value: 'other', label: '其他' },
    { value: 'prefer_not_to_say', label: '不愿透露' }
  ]

  const loading = ref(false)
  const saving = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive<Record<string, any>>({})
  const editableFields = ref<string[]>([])
  const profileUsername = ref('')
  /** user_profile 是否已有记录行（未建档时保存会自动创建） */
  const profileExists = ref(true)
  /** preferences 的 JSON 文本（jsonb 列 ↔ 编辑态） */
  const preferencesText = ref('')

  const displayUsername = computed(() => props.username || profileUsername.value)

  const meta = (field: string): FieldMeta =>
    KNOWN_FIELDS[field] || { label: field, description: `请输入${field}`, type: 'text' }

  const preferencesJsonError = computed(() => {
    if (!editableFields.value.includes('preferences')) return ''
    if (preferencesText.value.trim() === '') return ''
    try {
      const parsed = JSON.parse(preferencesText.value)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return '偏好设置必须是 JSON 对象（如 {"theme":"dark"}）'
      }
      return ''
    } catch {
      return 'JSON 格式不正确，请检查后重试'
    }
  })

  /** 字段展示顺序：已知列按 schema 顺序在前，动态新列（未来扩展）按字母序在后 */
  const sortFields = (keys: string[]) => {
    const knownOrder = Object.keys(KNOWN_FIELDS)
    return keys.sort((a, b) => {
      const ia = knownOrder.indexOf(a)
      const ib = knownOrder.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }

  const loadProfile = async () => {
    if (!props.userId) return
    loading.value = true
    try {
      const profile = await getUserProfile(props.userId)
      profileUsername.value = String(profile.username ?? '')
      profileExists.value = Object.keys(profile).length > 0
      // 业务列 = profile 返回键 − 系统排除列；未建档（{}）时回退到已知字段全集
      const keys = sortFields(
        Object.keys(profile).filter((key) => !EXCLUDE_COLUMNS.has(key) && key !== 'username')
      )
      const fields = keys.length > 0 ? keys : sortFields(Object.keys(KNOWN_FIELDS))
      editableFields.value = fields
      fields.forEach((key) => {
        const value = profile[key]
        if (KNOWN_FIELDS[key]?.type === 'tags') {
          form[key] = Array.isArray(value) ? value.map(String) : []
        } else if (KNOWN_FIELDS[key]?.type === 'json') {
          form[key] = value ?? {}
          preferencesText.value =
            value == null || (typeof value === 'object' && Object.keys(value).length === 0)
              ? ''
              : JSON.stringify(value, null, 2)
        } else {
          form[key] = value == null ? '' : String(value)
        }
      })
    } catch (error) {
      console.error('获取用户资料失败:', error)
      ElMessage.error('获取用户资料失败')
      editableFields.value = []
    } finally {
      loading.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // 头像：文件选择 / 粘贴截图 → 压缩至 256×256 → data URL 存 avatar_url
  // ---------------------------------------------------------------------------
  const AVATAR_MAX_EDGE = 256

  const compressToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('canvas 不可用'))
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => reject(new Error('图片解析失败'))
        img.src = String(reader.result)
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })

  const handleAvatarFile = async (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      ElMessage.warning('请选择图片文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      ElMessage.warning('图片不能超过 10MB')
      return
    }
    try {
      form.avatar_url = await compressToDataUrl(file)
    } catch (error) {
      console.error('头像处理失败:', error)
      ElMessage.error('头像处理失败')
    }
  }

  const handleAvatarChange = (file: UploadFile) => handleAvatarFile(file.raw)

  // 弹窗打开期间监听粘贴：截图后 Ctrl+V 直接填入头像
  const handlePaste = (event: ClipboardEvent) => {
    if (!props.visible || !editableFields.value.includes('avatar_url')) return
    const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
      i.type.startsWith('image/')
    )
    if (item) {
      event.preventDefault()
      handleAvatarFile(item.getAsFile())
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) loadProfile()
      if (val) window.addEventListener('paste', handlePaste)
      else window.removeEventListener('paste', handlePaste)
    }
  )
  onBeforeUnmount(() => window.removeEventListener('paste', handlePaste))

  const handleClosed = () => {
    Object.keys(form).forEach((key) => delete form[key])
    editableFields.value = []
    preferencesText.value = ''
    profileUsername.value = ''
    profileExists.value = true
  }

  const handleSave = async () => {
    if (!props.userId || editableFields.value.length === 0) return
    if (preferencesJsonError.value) {
      ElMessage.warning(preferencesJsonError.value)
      return
    }
    saving.value = true
    try {
      const updates: Record<string, unknown> = {}
      editableFields.value.forEach((key) => {
        const type = KNOWN_FIELDS[key]?.type
        if (type === 'tags') {
          // 爱好：始终提交数组（允许清空）
          updates[key] = Array.isArray(form[key]) ? form[key] : []
        } else if (type === 'json') {
          // 偏好：空文本不提交（避免误清空），否则提交解析后的对象
          if (preferencesText.value.trim() !== '') {
            updates[key] = JSON.parse(preferencesText.value)
          }
        } else {
          // 文本/枚举/日期：空字符串不提交，避免误清空后端字段
          if (form[key] !== '' && form[key] != null) {
            updates[key] = form[key]
          }
        }
      })
      await updateUserProfile(props.userId, updates)
      ElMessage.success('保存成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存用户资料失败:', error)
      ElMessage.error('保存用户资料失败')
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .art-avatar-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    overflow: hidden;
    cursor: pointer;
    background: var(--el-fill-color-light);
    border: 1px dashed var(--el-border-color);
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .art-avatar-box:hover {
    border-color: var(--el-color-primary);
  }

  .art-avatar-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
