<!-- 个人中心（rpc_get_user_profile / update_user_profile 本人免权限点；
  保存成功后同步更新 userStore.userInfo → 侧栏/头像即时刷新） -->
<template>
  <div class="w-full h-full p-0 bg-transparent border-none shadow-none">
    <div class="relative flex-b mt-2.5 max-md:block max-md:mt-1">
      <div class="w-112 mr-5 max-md:w-full max-md:mr-0">
        <div class="art-card-sm relative p-9 pb-6 overflow-hidden text-center">
          <img class="absolute top-0 left-0 w-full h-50 object-cover" src="@imgs/user/bg.webp" />
          <img
            class="relative z-10 w-20 h-20 mt-30 mx-auto object-cover border-2 border-white rounded-full"
            src="@imgs/user/avatar.webp"
          />
          <h2 class="mt-5 text-xl font-normal">{{ userInfo.username || '-' }}</h2>
          <p class="mt-2 text-sm">
            <el-tag v-for="role in userInfo.roles || []" :key="role" size="small" class="mr-1">
              {{ role }}
            </el-tag>
          </p>

          <div class="w-75 mx-auto mt-7.5 text-left">
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:mail-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ userInfo.email || '-' }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:phone-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ userInfo.phone || '-' }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:building-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{
                userInfo.organization_name || userInfo.tenant_name || '-'
              }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:community-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ userInfo.dept_name || '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-hidden max-md:w-full max-md:mt-3.5">
        <div class="art-card-sm">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">基本设置</h1>

          <div v-loading="loading" class="p-5">
            <ElAlert
              v-if="!loading && editableFields.length === 0"
              type="info"
              :closable="false"
              show-icon
              title="暂无资料字段可编辑（user_profile 未初始化业务列）"
              class="mb-3"
            />
            <ElForm :model="form" ref="ruleFormRef" label-width="86px" label-position="top">
              <ElRow>
                <ElFormItem
                  v-for="field in editableFields"
                  :key="field"
                  :label="fieldLabel(field)"
                  :prop="field"
                  class="w-1/2"
                >
                  <ElInput v-model="form[field]" :placeholder="`请输入${fieldLabel(field)}`" />
                </ElFormItem>
              </ElRow>

              <div class="flex-c justify-end">
                <ElButton type="primary" v-ripple :loading="saving" @click="save"> 保存 </ElButton>
              </div>
            </ElForm>
          </div>
        </div>

        <div class="art-card-sm my-5">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">账号与安全</h1>
          <div class="p-5">
            <ElAlert
              type="info"
              :closable="false"
              show-icon
              title="修改密码、更换邮箱/手机请在 Logto 托管登录页操作（统一身份认证）"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useUserStore } from '@/store/modules/user'
  import { getUserProfile, updateUserProfile } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import type { FormInstance } from 'element-plus'

  defineOptions({ name: 'UserCenter' })

  const userStore = useUserStore()
  const userInfo = computed(() => userStore.getUserInfo)

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
  const ruleFormRef = ref<FormInstance>()
  const form = reactive<Record<string, any>>({})
  const editableFields = ref<string[]>([])

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

  onMounted(async () => {
    const userId = userInfo.value?.id
    if (!userId) return
    loading.value = true
    try {
      const profile = await getUserProfile(userId)
      const keys = Object.keys(profile).filter((key) => !EXCLUDE_COLUMNS.has(key))
      editableFields.value = keys
      keys.forEach((key) => {
        form[key] = profile[key] == null ? '' : String(profile[key])
      })
    } catch (error) {
      console.error('获取个人资料失败:', error)
      editableFields.value = []
    } finally {
      loading.value = false
    }
  })

  const save = async () => {
    const userId = userInfo.value?.id
    if (!userId || editableFields.value.length === 0) return
    saving.value = true
    try {
      const updates: Record<string, unknown> = {}
      editableFields.value.forEach((key) => {
        if (form[key] !== '' && form[key] != null) {
          updates[key] = form[key]
        }
      })
      await updateUserProfile(userId, updates)
      ElMessage.success('保存成功')
      // 同步更新 userStore（§5b.8：侧栏/头像即时刷新）
      await userStore.refreshUserInfo?.()
    } catch (error) {
      console.error('保存个人资料失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
