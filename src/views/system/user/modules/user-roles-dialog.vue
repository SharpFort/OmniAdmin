<!-- 查看用户角色弹窗（v_user_roles；⚠️ LEFT JOIN role_code 可为 null，前端过滤；
     视图无角色名称列——按 role_code 关联 v_role_list 补齐 role_name） -->
<template>
  <ElDialog
    :model-value="visible"
    title="用户角色"
    width="560px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading" class="min-h-30">
      <el-empty v-if="!loading && roles.length === 0" description="未分配角色" />
      <el-table v-else :data="roles" size="small" border>
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="role_code" label="角色编码" min-width="140" />
        <el-table-column prop="role_name" label="角色名称" min-width="140">
          <template #default="{ row }">{{ row.role_name || '-' }}</template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { getUserRoles, getRoleList } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    userId: string
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
  }>()

  const loading = ref(false)
  const roles = ref<Array<{ role_code: string; role_name: string | null }>>([])

  const loadRoles = async () => {
    if (!props.userId) return
    loading.value = true
    try {
      // 并行拉取：用户角色分配行 + 角色目录（role_code → role_name 映射）
      const [result, roleCatalog] = await Promise.all([
        getUserRoles({ userId: props.userId, limit: 100 }),
        getRoleList({ limit: 100 })
      ])
      const roleNameMap = new Map(roleCatalog.items.map((r) => [r.role_code, r.role_name]))
      // 过滤 role_code 为 null 的行（LEFT JOIN 未分配角色）
      roles.value = result.items
        .filter((row) => row.role_code)
        .map((row) => ({
          role_code: row.role_code as string,
          role_name: roleNameMap.get(row.role_code as string) ?? null
        }))
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
