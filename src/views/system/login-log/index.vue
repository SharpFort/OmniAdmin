<!-- 登录日志（rpc_search_login_logs：用户/结果下拉 + 登录方式/地区模糊 + 时间范围；037 扩展）
  ⚠️ public:login-log:list 仅超管绑定 → tenant_admin 42501 全局提示 + 页面降级文案（B-3） -->
<template>
  <div class="login-log-page art-full-height">
    <ElCard class="art-table-card">
      <LoginLogSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看登录日志（public:login-log:list 仅超管可用），请联系管理员"
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
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { searchLoginLogs } from '@/api/system-manage'
  import LoginLogSearch from './modules/login-log-search.vue'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'LoginLog' })

  type LoginLog = Api.SystemManage.LoginLog

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({
    user_id: '',
    result: '',
    login_type: '',
    region: '',
    date_range: [] as [string, string] | []
  })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<LoginLog[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await searchLoginLogs({
        user_id: searchForm.value.user_id || null,
        result: searchForm.value.result || null,
        login_type: searchForm.value.login_type || null,
        region: searchForm.value.region || null,
        from: searchForm.value.date_range?.[0] || null,
        to: searchForm.value.date_range?.[1] || null,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      permissionDenied.value = false
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      if (error instanceof PostgrestRequestError && error.code === '42501') {
        // B-3：42501 全局提示已由 request.ts 弹出，页面降级为提示文案
        permissionDenied.value = true
        data.value = []
        pagination.total = 0
      } else {
        console.error('获取登录日志失败:', error)
        data.value = []
        pagination.total = 0
      }
    } finally {
      loading.value = false
    }
  }

  // 搜索 → 合并清洗后参数并跳回第 1 页（分页跳转规范：搜索/重置/改每页条数均回第 1 页）
  const handleSearch = (params: any) => {
    Object.assign(searchForm.value, defaultSearchForm(), params)
    pagination.current = 1
    getData()
  }
  // 重置 → 恢复默认条件并跳回第 1 页
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

  const { columns, columnChecks } = useTableColumns<LoginLog>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'username', label: '用户名', minWidth: 110, formatter: (row) => row.username || '-' },
    {
      prop: 'login_type',
      label: '登录方式',
      width: 100,
      formatter: (row) => row.login_type || '-'
    },
    {
      prop: 'result',
      label: '结果',
      width: 80,
      formatter: (row) =>
        h(ElTag, { type: row.result === 'success' ? 'success' : 'danger' }, () =>
          row.result === 'success' ? '成功' : '失败'
        )
    },
    {
      prop: 'fail_reason',
      label: '失败原因',
      minWidth: 140,
      formatter: (row) => row.fail_reason || '-'
    },
    { prop: 'ip', label: 'IP', width: 130, formatter: (row) => row.ip || '-' },
    {
      prop: 'region',
      label: '地区',
      minWidth: 170,
      formatter: (row) => row.region || '-'
    },
    {
      prop: 'user_agent',
      label: 'User-Agent',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.user_agent || '-'
    },
    {
      prop: 'logto_event',
      label: 'Logto 事件',
      width: 120,
      formatter: (row) => row.logto_event || '-'
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
