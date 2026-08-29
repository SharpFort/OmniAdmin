<!-- 角色成员弹窗（v_role_users；⚠️ LEFT JOIN user_id 可为 null，前端过滤；服务端分页） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`角色成员 - ${roleCode}`"
    width="640px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading" class="min-h-30">
      <el-empty v-if="!loading && members.length === 0" description="暂无成员" />
      <template v-else>
        <el-table :data="members" size="small" border>
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="username" label="用户名称" min-width="120">
            <template #default="{ row }">{{ row.username || '-' }}</template>
          </el-table-column>
          <el-table-column prop="user_id" label="用户 ID" min-width="200" show-overflow-tooltip />
        </el-table>
        <div class="mt-3 flex justify-end">
          <el-pagination
            v-model:current-page="pagination.current"
            :page-size="pagination.size"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            small
            @size-change="handleSizeChange"
            @current-change="loadMembers"
          />
        </div>
      </template>
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
  const pagination = reactive({ current: 1, size: 10, total: 0 })

  const loadMembers = async () => {
    if (!props.roleCode) return
    loading.value = true
    try {
      const result = await getRoleUsers({
        roleCode: props.roleCode,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      members.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取角色成员失败:', error)
      ElMessage.error('获取角色成员失败')
      members.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
    loadMembers()
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) {
        pagination.current = 1
        loadMembers()
      }
    }
  )
</script>
