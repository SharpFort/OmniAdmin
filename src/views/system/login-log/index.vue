<!-- 登录日志（rpc_search_login_logs：用户下拉 + 结果下拉 + 时间范围，无关键词搜索）
  ⚠️ sys:login-log:list 仅超管绑定 → tenant_admin 42501 全局提示 + 页面降级文案（B-3） -->
<template>
  <div class="login-log-page art-full-height">
    <ElCard class="art-table-card">
      <div class="flex flex-wrap items-center gap-3 p-4">
        <ElSelect
          v-model="filters.user_id"
          filterable
          clearable
          placeholder="用户"
          class="w-48"
          @change="handleSearch"
        >
          <ElOption
            v-for="user in userOptions"
            :key="user.id"
            :label="user.username"
            :value="user.id"
          />
        </ElSelect>
        <ElSelect
          v-model="filters.result"
          clearable
          placeholder="结果"
          class="w-32"
          @change="handleSearch"
        >
          <ElOption label="成功" value="success" />
          <ElOption label="失败" value="failure" />
        </ElSelect>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DD HH:mm:ss"
          class="w-72"
          @change="handleSearch"
        />
        <ElButton @click="handleReset">重置</ElButton>
      </div>

      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看登录日志（sys:login-log:list 仅超管可用），请联系管理员"
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
  import { getUserList } from '@/api/system-manage'
  import { PostgrestRequestError } from '@/api/request'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'LoginLog' })

  type LoginLog = Api.SystemManage.LoginLog

  const filters = reactive({
    user_id: '',
    result: ''
  })
  const dateRange = ref<[string, string] | null>(null)
  const userOptions = ref<Array<{ id: string; username: string }>>([])

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<LoginLog[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await searchLoginLogs({
        user_id: filters.user_id || undefined,
        result: filters.result || undefined,
        from: dateRange.value?.[0],
        to: dateRange.value?.[1],
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

  const handleSearch = () => {
    pagination.current = 1
    getData()
  }
  const handleReset = () => {
    filters.user_id = ''
    filters.result = ''
    dateRange.value = null
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
      minWidth: 140,
      formatter: (row) => row.region || '-'
    },
    {
      prop: 'created_at',
      label: '时间',
      width: 160,
      formatter: (row) => row.created_at?.replace('T', ' ').slice(0, 19) || '-'
    }
  ])

  onMounted(async () => {
    getData()
    // 用户下拉（v_user_list，仅取前 100）
    try {
      const result = await getUserList({ limit: 100, offset: 0 })
      userOptions.value = result.items.map((user) => ({
        id: user.id,
        username: user.username
      }))
    } catch (error) {
      console.warn('加载用户下拉失败:', error)
    }
  })
</script>
