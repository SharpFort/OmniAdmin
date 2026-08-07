<!-- 角色成员弹窗（v_role_users；⚠️ LEFT JOIN user_id 可为 null，前端过滤） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`角色成员 - ${roleCode}`"
    width="560px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading" class="min-h-30">
      <el-empty v-if="!loading && members.length === 0" description="暂无成员" />
      <el-table v-else :data="members" size="small" border>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="user_id" label="用户 ID" min-width="200" show-overflow-tooltip />
      </el-table>
    </div>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { getRoleUsers } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    roleCode: string
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
  }>()

  const loading = ref(false)
  const members = ref<Api.SystemManage.RoleUserItem[]>([])

  const loadMembers = async () => {
    if (!props.roleCode) return
    loading.value = true
    try {
      const result = await getRoleUsers({ roleCode: props.roleCode, limit: 100 })
      // 过滤 user_id 为 null 的行
      members.value = result.items.filter((row) => row.user_id)
    } catch (error) {
      console.error('获取角色成员失败:', error)
      ElMessage.error('获取角色成员失败')
      members.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) loadMembers()
    }
  )
</script>
