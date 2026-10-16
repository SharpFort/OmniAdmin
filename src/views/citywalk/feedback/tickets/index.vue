<!-- 反馈工单管理（api_v1_content_feedback.v_ticket_list + 状态/受理/批量 RPC）
  工单状态机：Open → Processing → PendingUser/Resolved → Closed / Invalid -->
<template>
  <div class="citywalk-tickets-page art-full-height">
    <TicketsSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <div class="table-toolbar">
        <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
          <template #left>
            <ElButton
              v-if="selectedRows.length"
              type="danger"
              size="small"
              :loading="bulkLoading"
              @click="handleBatchClose"
            >
              批量关闭（{{ selectedRows.length }}）
            </ElButton>
            <ElButton
              v-if="selectedRows.length"
              size="small"
              :loading="bulkLoading"
              @click="batchPriorityVisible = true"
            >
              批量改优先级
            </ElButton>
          </template>
        </ArtTableHeader>
      </div>

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看反馈工单（仅管理员可用），请联系管理员"
      />

      <ArtTable
        v-else
        ref="artTableRef"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <!-- 受理对话框（指派处理人） -->
    <ElDialog v-model="assignVisible" title="受理工单" width="420px">
      <el-form label-width="80px">
        <el-form-item label="工单">
          <span>{{ currentTicket?.ticket_no }} {{ currentTicket?.title }}</span>
        </el-form-item>
        <el-form-item label="处理人">
          <el-select v-model="assigneeId" filterable placeholder="选择处理人" class="w-full">
            <el-option v-for="u in userOptions" :key="u.id" :label="u.label" :value="u.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="assignVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!assigneeId"
          :loading="actionLoading"
          @click="handleAssign"
        >
          确认受理
        </ElButton>
      </template>
    </ElDialog>

    <!-- 转状态对话框 -->
    <ElDialog v-model="statusVisible" title="工单转状态" width="420px">
      <el-form label-width="80px">
        <el-form-item label="新状态">
          <el-select v-model="newStatus" class="w-full">
            <el-option
              v-for="s in statusOptions.filter((o) => o.value !== 'Open')"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="statusRemark"
            type="textarea"
            :rows="2"
            placeholder="处理说明（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="statusVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!newStatus"
          :loading="actionLoading"
          @click="handleChangeStatus"
        >
          确认
        </ElButton>
      </template>
    </ElDialog>

    <!-- 批量改优先级 -->
    <ElDialog v-model="batchPriorityVisible" title="批量改优先级" width="380px">
      <el-select v-model="batchPriority" class="w-full" placeholder="选择优先级">
        <el-option v-for="p in priorityOptions" :key="p.value" :label="p.label" :value="p.value" />
      </el-select>
      <template #footer>
        <ElButton @click="batchPriorityVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!batchPriority"
          :loading="bulkLoading"
          @click="handleBatchPriority"
        >
          确认
        </ElButton>
      </template>
    </ElDialog>

    <!-- 详情抽屉 -->
    <ElDrawer
      :model-value="detailVisible"
      :title="currentTicket?.ticket_no || '工单详情'"
      size="400px"
      @update:model-value="detailVisible = $event"
    >
      <el-descriptions v-if="currentTicket" :column="1" border size="small">
        <el-descriptions-item label="标题">{{ currentTicket.title }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{
          typeLabel(currentTicket.ticket_type)
        }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{
          statusLabel(currentTicket.status)
        }}</el-descriptions-item>
        <el-descriptions-item label="优先级">{{
          priorityLabel(currentTicket.priority)
        }}</el-descriptions-item>
        <el-descriptions-item label="提交人">{{
          currentTicket.submitter_user_id || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="处理人">{{
          currentTicket.assignee_id || '（未受理）'
        }}</el-descriptions-item>
        <el-descriptions-item label="目标类型">{{
          currentTicket.target_type || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="目标 ID">{{
          currentTicket.target_id || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatTime(currentTicket.created_at)
        }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{
          formatTime(currentTicket.updated_at)
        }}</el-descriptions-item>
      </el-descriptions>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import {
    getTicketList,
    changeTicketStatus,
    assignTicket,
    batchCloseTickets,
    batchUpdatePriority
  } from '@/api/citywalk'
  import { getUserList } from '@/api/system-manage'
  import { PostgrestRequestError } from '@/api/request'
  import TicketsSearch from './modules/tickets-search.vue'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkTickets' })

  type Ticket = Api.Citywalk.Ticket

  const statusOptions = [
    { label: '待处理', value: 'Open' },
    { label: '处理中', value: 'Processing' },
    { label: '待用户', value: 'PendingUser' },
    { label: '已解决', value: 'Resolved' },
    { label: '已关闭', value: 'Closed' },
    { label: '无效', value: 'Invalid' }
  ]
  const typeOptions = [
    { label: '内容纠错', value: 'ContentError' },
    { label: '内容举报', value: 'ContentReport' },
    { label: '数据缺失', value: 'DataMissing' },
    { label: '缺陷报告', value: 'BugReport' },
    { label: '功能建议', value: 'FeatureRequest' },
    { label: '账号问题', value: 'AccountIssue' },
    { label: '其他', value: 'Other' }
  ]
  const priorityOptions = [
    { label: '低', value: 'Low' },
    { label: '中', value: 'Medium' },
    { label: '高', value: 'High' },
    { label: '紧急', value: 'Urgent' }
  ]
  const statusLabel = (v: string | null) =>
    statusOptions.find((o) => o.value === v)?.label || v || '-'
  const typeLabel = (v: string | null) => typeOptions.find((o) => o.value === v)?.label || v || '-'
  const priorityLabel = (v: string | null) =>
    priorityOptions.find((o) => o.value === v)?.label || v || '-'
  const statusTagType = (v: string | null) => {
    if (v === 'Open') return 'warning'
    if (v === 'Processing') return 'primary'
    if (v === 'Resolved') return 'success'
    if (v === 'Closed' || v === 'Invalid') return 'info'
    return 'info'
  }
  const priorityTagType = (v: string | null) => {
    if (v === 'Urgent') return 'danger'
    if (v === 'High') return 'warning'
    if (v === 'Medium') return 'primary'
    return 'info'
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const defaultSearchForm = () => ({ keyword: '', status: '', ticketType: '', priority: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Ticket[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })
  const artTableRef = ref()

  const getData = async () => {
    loading.value = true
    try {
      const result = await getTicketList({
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined,
        ticketType: searchForm.value.ticketType || undefined,
        priority: searchForm.value.priority || undefined,
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
        console.error('获取工单列表失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: any) => {
    Object.assign(searchForm.value, defaultSearchForm(), params)
    pagination.current = 1
    getData()
  }
  const resetSearch = () => {
    searchForm.value = defaultSearchForm()
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

  // ------------------------------------------------------------------
  // 行动作：受理 / 转状态 / 详情
  // ------------------------------------------------------------------
  const currentTicket = ref<Ticket | null>(null)
  const assignVisible = ref(false)
  const statusVisible = ref(false)
  const detailVisible = ref(false)
  const assigneeId = ref('')
  const newStatus = ref('')
  const statusRemark = ref('')
  const actionLoading = ref(false)

  const userOptions = ref<Array<{ label: string; value: string; id: string }>>([])
  onMounted(async () => {
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

  const openAssign = (row: Ticket) => {
    currentTicket.value = row
    assigneeId.value = row.assignee_id || ''
    assignVisible.value = true
  }
  const handleAssign = async () => {
    if (!currentTicket.value || !assigneeId.value) return
    actionLoading.value = true
    try {
      await assignTicket(currentTicket.value.id, assigneeId.value)
      ElMessage.success('已受理指派')
      assignVisible.value = false
      getData()
    } catch (error) {
      console.error('受理失败:', error)
    } finally {
      actionLoading.value = false
    }
  }

  const openStatus = (row: Ticket) => {
    currentTicket.value = row
    newStatus.value = ''
    statusRemark.value = ''
    statusVisible.value = true
  }
  const handleChangeStatus = async () => {
    if (!currentTicket.value || !newStatus.value) return
    actionLoading.value = true
    try {
      await changeTicketStatus(currentTicket.value.id, newStatus.value, statusRemark.value)
      ElMessage.success('状态已更新')
      statusVisible.value = false
      getData()
    } catch (error) {
      console.error('转状态失败:', error)
    } finally {
      actionLoading.value = false
    }
  }

  // ------------------------------------------------------------------
  // 批量动作
  // ------------------------------------------------------------------
  const selectedRows = ref<Ticket[]>([])
  const bulkLoading = ref(false)
  const batchPriorityVisible = ref(false)
  const batchPriority = ref('')

  const handleSelectionChange = (rows: Ticket[]) => {
    selectedRows.value = rows
  }
  const clearSelection = () => {
    artTableRef.value?.elTableRef?.clearSelection()
    selectedRows.value = []
  }

  const handleBatchClose = async () => {
    try {
      await ElMessageBox.confirm(`确认批量关闭 ${selectedRows.value.length} 个工单？`, '批量关闭', {
        type: 'warning'
      })
    } catch {
      return
    }
    bulkLoading.value = true
    try {
      await batchCloseTickets(selectedRows.value.map((r) => r.id))
      ElMessage.success('批量关闭完成')
      clearSelection()
      getData()
    } catch (error) {
      console.error('批量关闭失败:', error)
    } finally {
      bulkLoading.value = false
    }
  }

  const handleBatchPriority = async () => {
    bulkLoading.value = true
    try {
      await batchUpdatePriority(
        selectedRows.value.map((r) => r.id),
        batchPriority.value
      )
      ElMessage.success('优先级已更新')
      batchPriorityVisible.value = false
      clearSelection()
      getData()
    } catch (error) {
      console.error('批量改优先级失败:', error)
    } finally {
      bulkLoading.value = false
    }
  }

  const { columns, columnChecks } = useTableColumns<Ticket>(() => [
    { type: 'selection', width: 42 },
    { prop: 'ticket_no', label: '工单号', width: 150, showOverflowTooltip: true },
    { prop: 'title', label: '标题', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'ticket_type',
      label: '类型',
      width: 100,
      formatter: (row) => typeLabel(row.ticket_type)
    },
    {
      prop: 'status',
      label: '状态',
      width: 90,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
    },
    {
      prop: 'priority',
      label: '优先级',
      width: 85,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: priorityTagType(row.priority), effect: 'plain' }, () =>
          priorityLabel(row.priority)
        )
    },
    {
      prop: 'assignee_id',
      label: '处理人',
      width: 110,
      showOverflowTooltip: true,
      formatter: (row) =>
        userOptions.value.find((u) => u.id === row.assignee_id)?.label || '（未受理）'
    },
    {
      prop: 'created_at',
      label: '创建时间',
      width: 160,
      formatter: (row) => formatTime(row.created_at)
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
            { type: 'primary', link: true, size: 'small', onClick: () => openAssign(row) },
            () => '受理'
          ),
          h(
            ElButton,
            { type: 'warning', link: true, size: 'small', onClick: () => openStatus(row) },
            () => '转状态'
          ),
          h(
            ElButton,
            {
              link: true,
              size: 'small',
              onClick: () => {
                currentTicket.value = row
                detailVisible.value = true
              }
            },
            () => '详情'
          )
        ])
    }
  ])

  onMounted(getData)
</script>

<style lang="scss" scoped>
  .table-toolbar {
    :deep(.art-table-header) {
      padding-bottom: 8px;
    }
  }
</style>
