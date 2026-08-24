<!-- 租户成员弹窗（rpc_list_tenant_members） -->
<template>
  <ElDialog
    :model-value="visible"
    title="租户成员"
    width="560px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading" class="min-h-30">
      <el-empty v-if="!loading && members.length === 0" description="暂无成员" />
      <el-table v-else :data="members" size="small" border>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="name" label="姓名" min-width="120">
          <template #default="{ row }">{{ row.name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="170">
          <template #default="{ row }">{{ row.email || '-' }}</template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { listTenantMembers } from '@/api/tenant'
  import { ElMessage } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    orgId: string
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
  }>()

  const loading = ref(false)
  const members = ref<Api.SystemManage.TenantMember[]>([])

  const loadMembers = async () => {
    if (!props.orgId) return
    loading.value = true
    try {
      const result = await listTenantMembers({ organizationId: props.orgId, limit: 100 })
      members.value = result.items
    } catch (error) {
      console.error('获取租户成员失败:', error)
      ElMessage.error('获取租户成员失败')
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
