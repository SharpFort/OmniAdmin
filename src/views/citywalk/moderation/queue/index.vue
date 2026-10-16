<!-- 内容审核工作台（api_v1_moderation：v_pending_audit_queue + v_admin_risk_dashboard）
  动作：通过 / 驳回（原因码+备注） / 指派（处理人+优先级+截止时间）；顶部风险看板汇总 -->
<template>
  <div class="citywalk-mod-queue-page art-full-height">
    <!-- 风险看板汇总（v_admin_risk_dashboard 近 7 天聚合） -->
    <ElRow v-if="dashTotals" :gutter="12" class="mb-3">
      <ElCol v-for="card in dashCards" :key="card.label" :span="6" :xs="12">
        <ElCard shadow="never" class="dash-card">
          <div class="dash-label">{{ card.label }}</div>
          <div class="dash-value">{{ card.value }}</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ArtSearchBar
      v-model="searchKeyword"
      :items="searchItems"
      :rules="{}"
      :span="8"
      :is-expand="true"
      @search="handleSearch"
      @reset="handleReset"
    >
    </ArtSearchBar>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshAll" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看审核队列（仅管理员可用），请联系管理员"
      />

      <ArtTable
        v-else
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <!-- 指派对话框 -->
    <ElDialog v-model="assignVisible" title="指派审核任务" width="440px">
      <el-form label-width="80px">
        <el-form-item label="内容">
          <span class="text-secondary"
            >{{ currentRow?.target_type }} / {{ currentRow?.target_id }}</span
          >
        </el-form-item>
        <el-form-item label="处理人">
          <el-select
            v-model="assignForm.assigneeId"
            filterable
            placeholder="选择处理人"
            class="w-full"
          >
            <el-option v-for="u in userOptions" :key="u.id" :label="u.label" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="assignForm.priority" class="w-full">
            <el-option label="低" value="Low" />
            <el-option label="中" value="Medium" />
            <el-option label="高" value="High" />
            <el-option label="紧急" value="Urgent" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker
            v-model="assignForm.dueTime"
            type="datetime"
            placeholder="可选"
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="w-full"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="assignVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!assignForm.assigneeId"
          :loading="actionLoading"
          @click="handleAssign"
        >
          确认指派
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import {
    getModerationQueue,
    getRiskDashboard,
    approveContent,
    rejectContent,
    assignModerationTask
  } from '@/api/citywalk'
  import { getUserList } from '@/api/system-manage'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkModerationQueue' })

  type QueueItem = Api.Citywalk.ModerationQueueItem

  // ------------------------------------------------------------------
  // 风险看板（近 7 天聚合，4 张汇总卡）
  // ------------------------------------------------------------------
  const dashTotals = ref<{
    total: number
    approved: number
    rejected: number
    avgHours: string
  } | null>(null)

  const loadDashboard = async () => {
    try {
      const rows = await getRiskDashboard(500)
      // 近 7 天（有数据的最近 7 个自然日）
      const days = [...new Set(rows.map((r) => r.review_date))].sort().reverse().slice(0, 7)
      const recent = rows.filter((r) => days.includes(r.review_date))
      const total = recent.reduce((s, r) => s + Number(r.total_count || 0), 0)
      const approved = recent.reduce((s, r) => s + Number(r.approved_count || 0), 0)
      const rejected = recent.reduce((s, r) => s + Number(r.rejected_count || 0), 0)
      const hours = recent.map((r) => r.avg_review_hours).filter((h) => h != null) as number[]
      dashTotals.value = {
        total,
        approved,
        rejected,
        avgHours: hours.length ? (hours.reduce((s, h) => s + h, 0) / hours.length).toFixed(1) : '-'
      }
    } catch (error) {
      console.warn('加载风险看板失败:', error)
    }
  }

  const dashCards = computed(() => {
    const t = dashTotals.value
    return t
      ? [
          { label: '近 7 天审核量', value: t.total.toLocaleString() },
          { label: '通过数', value: t.approved.toLocaleString() },
          { label: '驳回数', value: t.rejected.toLocaleString() },
          { label: '平均审核耗时 (h)', value: t.avgHours }
        ]
      : []
  })

  // ------------------------------------------------------------------
  // 待审队列
  // ------------------------------------------------------------------
  const searchKeyword = ref({ targetType: '', riskLevel: '', onlyOverdue: false })
  const applied = ref({ targetType: '', riskLevel: '', onlyOverdue: false })

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<QueueItem[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const targetOptions = [
    { label: '笔记', value: 'note' },
    { label: '评论', value: 'comment' },
    { label: '评价', value: 'review' }
  ]
  const riskOptions = [
    { label: '高风险', value: 'High' },
    { label: '中风险', value: 'Medium' },
    { label: '低风险', value: 'Low' }
  ]
  const boolOptions = [
    { label: '是', value: 'true' },
    { label: '否', value: 'false' }
  ]

  const searchItems = computed(() => [
    {
      label: '目标类型',
      key: 'targetType',
      type: 'select',
      props: { placeholder: '全部', options: targetOptions, clearable: true }
    },
    {
      label: '风险级',
      key: 'riskLevel',
      type: 'select',
      props: { placeholder: '全部', options: riskOptions, clearable: true }
    },
    {
      label: '仅看逾期',
      key: 'onlyOverdue',
      type: 'select',
      props: { placeholder: '不限', options: boolOptions, clearable: true }
    }
  ])

  const getData = async () => {
    loading.value = true
    try {
      const result = await getModerationQueue({
        targetType: applied.value.targetType || undefined,
        riskLevel: applied.value.riskLevel || undefined,
        onlyOverdue: applied.value.onlyOverdue || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      permissionDenied.value = false
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      if (error instanceof PostgrestRequestError && error.code === '42501') {
        permissionDenied.value = true
      } else {
        console.error('获取审核队列失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: any) => {
    applied.value = {
      targetType: params.targetType || '',
      riskLevel: params.riskLevel || '',
      onlyOverdue: params.onlyOverdue === 'true'
    }
    pagination.current = 1
    getData()
  }
  const handleReset = () => {
    applied.value = { targetType: '', riskLevel: '', onlyOverdue: false }
    searchKeyword.value = { targetType: '', riskLevel: '', onlyOverdue: false }
    pagination.current = 1
    getData()
  }
  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
    getData()
  }
  const handleCurrentChange = (page: number) => {
    pagination.current = page
    getData()
  }
  const refreshAll = () => {
    getData()
    loadDashboard()
  }

  // ------------------------------------------------------------------
  // 审核动作
  // ------------------------------------------------------------------
  const currentRow = ref<QueueItem | null>(null)
  const actionLoading = ref(false)

  const handleApprove = async (row: QueueItem) => {
    try {
      await ElMessageBox.confirm('确认通过该内容审核？', '审核通过', { type: 'warning' })
    } catch {
      return
    }
    try {
      await approveContent(row.content_id)
      ElMessage.success('已通过')
      refreshAll()
    } catch (error) {
      console.error('通过失败:', error)
    }
  }

  const handleReject = async (row: QueueItem) => {
    let remark = ''
    try {
      const { value } = await ElMessageBox.prompt('驳回该内容审核', '审核驳回', {
        type: 'warning',
        inputPlaceholder: '驳回原因（可选）',
        inputValidator: () => true
      })
      remark = value || ''
    } catch {
      return
    }
    try {
      await rejectContent(row.content_id, undefined, remark || undefined)
      ElMessage.success('已驳回')
      refreshAll()
    } catch (error) {
      console.error('驳回失败:', error)
    }
  }

  // 指派
  const assignVisible = ref(false)
  const userOptions = ref<Array<{ label: string; value: string; id: string }>>([])
  const assignForm = reactive({ assigneeId: '', priority: 'Medium', dueTime: '' })

  const openAssign = (row: QueueItem) => {
    currentRow.value = row
    assignForm.assigneeId = row.assignee_id || ''
    assignForm.priority = row.priority || 'Medium'
    assignForm.dueTime = ''
    assignVisible.value = true
  }
  const handleAssign = async () => {
    if (!currentRow.value || !assignForm.assigneeId) return
    actionLoading.value = true
    try {
      await assignModerationTask(
        currentRow.value.content_id,
        assignForm.assigneeId,
        assignForm.priority,
        assignForm.dueTime || undefined
      )
      ElMessage.success('已指派')
      assignVisible.value = false
      refreshAll()
    } catch (error) {
      console.error('指派失败:', error)
    } finally {
      actionLoading.value = false
    }
  }

  onMounted(async () => {
    getData()
    loadDashboard()
    try {
      const result = await getUserList({ limit: 100, offset: 0 })
      userOptions.value = result.items.map((u: any) => ({
        id: u.id,
        label: u.username || u.id,
        value: u.id
      }))
    } catch (error) {
      console.warn('加载用户下拉失败:', error)
    }
  })

  const riskTagType = (risk: string | null) => {
    if (risk === 'High') return 'danger'
    if (risk === 'Medium') return 'warning'
    return 'success'
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<QueueItem>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'target_type',
      label: '目标类型',
      width: 90,
      formatter: (row) => row.target_type || '-'
    },
    {
      prop: 'target_id',
      label: '目标 ID',
      width: 135,
      showOverflowTooltip: true,
      formatter: (row) => row.target_id || '-'
    },
    {
      prop: 'submitter_user_id',
      label: '提交者',
      width: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.submitter_user_id || '-'
    },
    {
      prop: 'risk_level',
      label: '风险级',
      width: 85,
      formatter: (row) =>
        h(
          ElTag,
          { size: 'small', type: riskTagType(row.risk_level), effect: 'plain' },
          () => row.risk_level || '-'
        )
    },
    {
      prop: 'initial_audit_type',
      label: '初审类型',
      width: 95,
      showOverflowTooltip: true,
      formatter: (row) => row.initial_audit_type || '-'
    },
    {
      prop: 'waiting_hours',
      label: '等待 (h)',
      width: 90,
      formatter: (row) => (row.waiting_hours != null ? Number(row.waiting_hours).toFixed(1) : '-')
    },
    {
      prop: 'is_overdue',
      label: '逾期',
      width: 70,
      formatter: (row) =>
        row.is_overdue ? h(ElTag, { size: 'small', type: 'danger' }, () => '是') : '否'
    },
    {
      prop: 'assignee_id',
      label: '处理人',
      width: 110,
      showOverflowTooltip: true,
      formatter: (row) =>
        userOptions.value.find((u) => u.id === row.assignee_id)?.label || '（未指派）'
    },
    {
      prop: 'submitted_at',
      label: '提交时间',
      width: 160,
      formatter: (row) => formatTime(row.submitted_at)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 170,
      fixed: 'right',
      formatter: (row) =>
        h('div', null, [
          h(
            ElButton,
            { type: 'success', link: true, size: 'small', onClick: () => handleApprove(row) },
            () => '通过'
          ),
          h(
            ElButton,
            { type: 'danger', link: true, size: 'small', onClick: () => handleReject(row) },
            () => '驳回'
          ),
          h(ElButton, { link: true, size: 'small', onClick: () => openAssign(row) }, () => '指派')
        ])
    }
  ])
</script>

<style lang="scss" scoped>
  .dash-card {
    .dash-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
    .dash-value {
      font-size: 20px;
      font-weight: 600;
      margin-top: 6px;
    }
  }
  .text-secondary {
    color: var(--el-text-color-secondary);
  }
</style>
