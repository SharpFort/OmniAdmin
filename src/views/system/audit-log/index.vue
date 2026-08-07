<!-- 审计日志（search_audit_log 关键词/表名/操作筛选 + v_audit_log_timeline 时间线）
  ⚠️ 9.4 已实测：operation 值域 = INSERT/UPDATE/DELETE（大写，audit_trigger_func）；
  log_operate 写入的行 operation 为 NULL → 仅「全部」可见 -->
<template>
  <div class="audit-log-page art-full-height">
    <ElCard class="art-table-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="日志列表" name="list">
          <div class="flex flex-wrap items-center gap-3 p-4">
            <ElInput
              v-model="filters.query"
              placeholder="关键词（表名/操作人等）"
              clearable
              class="w-52"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <ElInput
              v-model="filters.table_name"
              placeholder="表名"
              clearable
              class="w-40"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <ElSelect
              v-model="filters.operation"
              clearable
              placeholder="操作"
              class="w-36"
              @change="handleSearch"
            >
              <ElOption label="INSERT" value="INSERT" />
              <ElOption label="UPDATE" value="UPDATE" />
              <ElOption label="DELETE" value="DELETE" />
            </ElSelect>
            <ElButton type="primary" @click="handleSearch">搜索</ElButton>
            <ElButton @click="handleReset">重置</ElButton>
          </div>

          <ArtTable
            :loading="loading"
            :data="data"
            :columns="columns"
            :pagination="pagination"
            @pagination:size-change="handleSizeChange"
            @pagination:current-change="handleCurrentChange"
          />
        </el-tab-pane>

        <el-tab-pane label="时间线" name="timeline">
          <AuditTimeline />
        </el-tab-pane>
      </el-tabs>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { searchAuditLog } from '@/api/audit'
  import AuditTimeline from './modules/audit-timeline.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'AuditLog' })

  type AuditLog = Api.SystemManage.AuditLog

  const activeTab = ref('list')
  const filters = reactive({
    query: '',
    table_name: '',
    operation: ''
  })

  const loading = ref(false)
  const data = ref<AuditLog[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await searchAuditLog({
        query: filters.query || null,
        table_name: filters.table_name || null,
        operation: filters.operation || null,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取审计日志失败:', error)
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.current = 1
    getData()
  }
  const handleReset = () => {
    filters.query = ''
    filters.table_name = ''
    filters.operation = ''
    handleSearch()
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

  const OPERATION_TAG: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    INSERT: 'success',
    UPDATE: 'warning',
    DELETE: 'danger'
  }

  const { columns } = useTableColumns<AuditLog>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'table_name', label: '表名', minWidth: 130, formatter: (row) => row.table_name || '-' },
    {
      prop: 'operation',
      label: '操作',
      width: 90,
      formatter: (row) =>
        row.operation
          ? h(ElTag, { type: OPERATION_TAG[row.operation] || 'info' }, () => row.operation)
          : h(ElTag, { type: 'info' }, () => '操作审计')
    },
    {
      prop: 'username',
      label: '操作人',
      minWidth: 100,
      formatter: (row) => row.username || '-'
    },
    {
      prop: 'old_data',
      label: '变更前',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => (row.old_data ? JSON.stringify(row.old_data).slice(0, 120) : '-')
    },
    {
      prop: 'new_data',
      label: '变更后',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => (row.new_data ? JSON.stringify(row.new_data).slice(0, 120) : '-')
    },
    {
      prop: 'tenant_name',
      label: '租户',
      minWidth: 100,
      formatter: (row) => row.tenant_name || '-'
    },
    {
      prop: 'created_at',
      label: '时间',
      width: 160,
      formatter: (row) => row.created_at?.replace('T', ' ').slice(0, 19) || '-'
    }
  ])

  onMounted(getData)
</script>
