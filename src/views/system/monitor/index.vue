<!-- 系统监控（v_system_stats 8 项卡片 + pg_cron 任务/运行历史）
  ⚠️ B-4：cron RPC 超管门槛在函数内静默返回空（非 42501）→ 租户管理员显示「仅超管可见」提示
  ⚠️ 不展示 online_users/blacklisted_tokens（恒 NULL，会话交 Logto） -->
<template>
  <div class="monitor-page art-full-height">
    <!-- 统计卡片（8 项） -->
    <ElRow :gutter="16" class="mb-4">
      <ElCol v-for="card in statCards" :key="card.label" :xs="12" :sm="8" :md="6" :lg="3">
        <div class="art-card flex flex-col items-center justify-center h-24 mb-4">
          <span class="text-g-700 text-xs">{{ card.label }}</span>
          <span class="text-[22px] font-medium mt-1">{{ card.value }}</span>
        </div>
      </ElCol>
    </ElRow>
    <p v-if="statsTime" class="text-xs opacity-60 mb-4">统计时间：{{ statsTime }}</p>

    <!-- cron 任务区（超管） -->
    <ElCard class="art-table-card">
      <template #header>
        <span>pg_cron 任务</span>
        <el-tag v-if="!isSuperAdminFlag" type="info" size="small" class="ml-2"> 仅超管可见 </el-tag>
      </template>

      <el-alert
        v-if="!isSuperAdminFlag"
        type="info"
        show-icon
        :closable="false"
        title="cron 任务与运行历史仅超管可见（后端函数内静默返回空）"
      />

      <template v-else>
        <el-tabs v-model="cronTab">
          <el-tab-pane label="任务列表" name="jobs">
            <el-table v-loading="cronLoading" :data="cronJobs" size="small" border>
              <el-table-column prop="jobid" label="ID" width="60" />
              <el-table-column prop="jobname" label="任务名" min-width="150" />
              <el-table-column prop="schedule" label="调度" min-width="120" />
              <el-table-column prop="command" label="命令" min-width="220" show-overflow-tooltip />
              <el-table-column prop="active" label="启用" width="70" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.active ? 'success' : 'info'" size="small">
                    {{ row.active ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="运行历史" name="runs">
            <el-table v-loading="cronLoading" :data="cronRuns" size="small" border>
              <el-table-column prop="runid" label="运行 ID" width="90" />
              <el-table-column prop="jobid" label="任务 ID" width="80" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'succeeded' ? 'success' : 'danger'" size="small">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                prop="return_message"
                label="返回信息"
                min-width="180"
                show-overflow-tooltip
              />
              <el-table-column prop="start_time" label="开始时间" min-width="150">
                <template #default="{ row }">
                  {{
                    String(row.start_time || '')
                      .replace('T', ' ')
                      .slice(0, 19)
                  }}
                </template>
              </el-table-column>
              <el-table-column prop="end_time" label="结束时间" min-width="150">
                <template #default="{ row }">
                  {{ row.end_time ? String(row.end_time).replace('T', ' ').slice(0, 19) : '-' }}
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import {
    getSystemStats,
    getSystemStatsRealtime,
    listCronJobs,
    listCronJobRuns
  } from '@/api/monitor'
  import { isSuperAdmin } from '@/hooks/core/usePermission'
  import { useUserStore } from '@/store/modules/user'

  defineOptions({ name: 'Monitor' })

  const userStore = useUserStore()
  const isSuperAdminFlag = computed(() => isSuperAdmin(userStore.info?.roles))

  // 统计卡片 8 项（§2.5：不展示 online_users/blacklisted）
  const statCards = ref<Array<{ label: string; value: number }>>([
    { label: '租户数', value: 0 },
    { label: '活跃用户', value: 0 },
    { label: '用户总数', value: 0 },
    { label: '角色数', value: 0 },
    { label: '部门数', value: 0 },
    { label: '菜单数', value: 0 },
    { label: 'API 数', value: 0 },
    { label: '24h 审计', value: 0 }
  ])
  const statsTime = ref('')

  const cronTab = ref('jobs')
  const cronLoading = ref(false)
  const cronJobs = ref<Api.SystemManage.CronJob[]>([])
  const cronRuns = ref<Api.SystemManage.CronJobRun[]>([])

  onMounted(async () => {
    // 统计（🟢 全部角色可见；audit_24h 在 realtime 视图）
    try {
      const [stats, realtime] = await Promise.all([getSystemStats(), getSystemStatsRealtime()])
      if (stats) {
        statCards.value = [
          { label: '租户数', value: stats.total_tenants },
          { label: '活跃用户', value: stats.active_users },
          { label: '用户总数', value: stats.total_users },
          { label: '角色数', value: stats.total_roles },
          { label: '部门数', value: stats.total_departments },
          { label: '菜单数', value: stats.total_menus },
          { label: 'API 数', value: stats.total_apis },
          { label: '24h 审计', value: realtime?.audit_24h ?? 0 }
        ]
        statsTime.value = (stats.stats_time || '').replace('T', ' ').slice(0, 19)
        if (realtime?.last_cleanup_time) {
          statsTime.value += ` ｜ 上次清理：${String(realtime.last_cleanup_time)
            .replace('T', ' ')
            .slice(0, 19)}`
        }
      }
    } catch (error) {
      console.warn('加载系统统计失败:', error)
    }

    // cron（仅超管；函数内静默空，非 42501）
    if (isSuperAdminFlag.value) {
      cronLoading.value = true
      try {
        const [jobs, runs] = await Promise.all([listCronJobs(), listCronJobRuns(50)])
        cronJobs.value = jobs || []
        cronRuns.value = runs || []
      } catch (error) {
        console.warn('加载 cron 任务失败:', error)
        cronJobs.value = []
        cronRuns.value = []
      } finally {
        cronLoading.value = false
      }
    }
  })
</script>
