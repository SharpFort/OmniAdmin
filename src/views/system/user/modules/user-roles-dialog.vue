<!-- 查看用户角色弹窗（v_user_roles；⚠️ LEFT JOIN role_code 可为 null，前端过滤） -->
<template>
  <ElDialog
    :model-value="visible"
    title="用户角色"
    width="480px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading" class="min-h-30">
      <el-empty v-if="!loading && roles.length === 0" description="未分配角色" />
      <el-table v-else :data="roles" size="small" border>
        <el-table-column prop="role_code" label="角色编码" min-width="180" />
      </el-table>
    </div>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { getUserRoles } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    userId: string
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
  }>()

  const loading = ref(false)
  const roles = ref<Array<{ role_code: string }>>([])

  const loadRoles = async () => {
    if (!props.userId) return
    loading.value = true
    try {
      const result = await getUserRoles({ userId: props.userId, limit: 100 })
      // 过滤 role_code 为 null 的行（LEFT JOIN 未分配角色）
      roles.value = result.items
        .filter((row) => row.role_code)
        .map((row) => ({ role_code: row.role_code as string }))
    } catch (error) {
      console.error('获取用户角色失败:', error)
      ElMessage.error('获取用户角色失败')
      roles.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) loadRoles()
    }
  )
</script>
