<!-- 租户管理（rpc_list_tenants + rpc_list_tenant_members 成员弹窗；035 补绑 tenant_admin） -->
<template>
  <div class="tenant-page art-full-height">
    <TenantSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <span class="text-xs opacity-60"
            >租户（组织）数据为 Logto 镜像，新增/删除/改名在 Logto Console 侧操作</span
          >
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <!-- 成员弹窗 -->
      <MembersDialog v-model:visible="membersDialogVisible" :org-id="currentOrgId" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { listTenants } from '@/api/tenant'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import TenantSearch from './modules/tenant-search.vue'
  import MembersDialog from './modules/members-dialog.vue'

  defineOptions({ name: 'Tenant' })

  type Tenant = Api.SystemManage.Tenant

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<Tenant[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const membersDialogVisible = ref(false)
  const currentOrgId = ref('')

  const getData = async () => {
    loading.value = true
    try {
      const result = await listTenants({
        query: searchForm.value.query || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取租户列表失败:', error)
      data.value = []
      pagination.total = 0
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

  const { columns, columnChecks } = useTableColumns<Tenant>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'name', label: '租户/组织名称', minWidth: 160 },
    {
      prop: 'tenant_name',
      label: 'Logto 租户',
      minWidth: 110,
      formatter: (row) => row.tenant_name || '-'
    },
    {
      prop: 'organization_id',
      label: '组织 ID',
      minWidth: 130,
      formatter: (row) => row.organization_id || '-'
    },
    {
      prop: 'description',
      label: '描述',
      minWidth: 200,
      formatter: (row) => row.description || '-'
    },
    {
      prop: 'member_count',
      label: '成员数',
      width: 90,
      align: 'center'
    },
    {
      prop: 'created_at',
      label: '创建时间',
      width: 160,
      formatter: (row) => row.created_at?.replace('T', ' ').slice(0, 19) || '-'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 100,
      align: 'right',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: right' }, [
          h(ArtButtonTable, {
            type: 'add',
            title: '查看成员',
            onClick: () => showMembers(row)
          })
        ])
    }
  ])

  onMounted(getData)

  const showMembers = (row: Tenant) => {
    currentOrgId.value = row.organization_id
    nextTick(() => {
      membersDialogVisible.value = true
    })
  }
</script>
