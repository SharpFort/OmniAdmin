<!-- 审计时间线（get_audit_log_timeline 按天聚合 + v_audit_log_timeline 视图） -->
<template>
  <div v-loading="loading" class="p-4">
    <el-empty v-if="!loading && items.length === 0" description="暂无审计记录" />
    <el-table v-else :data="items" size="small" border>
      <el-table-column prop="log_date" label="日期" min-width="130">
        <template #default="{ row }">
          {{ String(row.log_date).slice(0, 10) }}
        </template>
      </el-table-column>
      <el-table-column prop="table_name" label="表名" min-width="130" />
      <el-table-column prop="operation" label="操作" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.operation" size="small">{{ row.operation }}</el-tag>
          <el-tag v-else size="small" type="info">操作审计</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="change_count" label="变更次数" width="100" align="center" />
      <el-table-column prop="unique_users" label="操作人数" width="100" align="center" />
    </el-table>
  </div>
</template>

<script setup lang="ts">
  import { getAuditLogTimeline } from '@/api/audit'

  const loading = ref(false)
  const items = ref<Api.SystemManage.AuditLogTimeline[]>([])

  /** 时间线数据加载（暴露给父组件在 tab 激活时调用） */
  const loadTimeline = async () => {
    loading.value = true
    try {
      const result = await getAuditLogTimeline({})
      items.value = result.items || []
    } catch (error) {
      console.error('获取审计时间线失败:', error)
      items.value = []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadTimeline)

  defineExpose({ loadTimeline })
</script>
