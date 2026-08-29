<!-- 用户岗位（search_user_positions RPC：后端 join 用户名/岗位路径 + 服务端分页/过滤；
  分配复用岗位页 AssignDialog，编辑回填/删除前经 p_user_id 拉取该用户全部分配） -->
<template>
  <div class="user-position-page art-full-height">
    <UserPositionSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton
            v-perm="'platform:position:assign'"
            type="primary"
            v-ripple
            @click="openAssignAdd"
          >
            分配岗位
          </ElButton>
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

      <!-- 分配/编辑复用岗位页 AssignDialog（rpc_assign_user_positions 全量覆盖） -->
      <AssignDialog v-model:visible="assignVisible" :edit-data="assignEditData" @submit="getData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { searchUserPositions, assignUserPositions } from '@/api/system-manage'
  import UserPositionSearch from './modules/user-position-search.vue'
  import AssignDialog from '@/views/system/position/modules/assign-dialog.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'UserPosition' })

  type UserPositionItem = Api.SystemManage.UserPositionItem

  // 搜索表单（服务端过滤：username → p_query 匹配用户名/邮箱/姓名；position → p_position_name）
  const defaultSearchForm = () => ({ username: '', position: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<UserPositionItem[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })
  const assignVisible = ref(false)
  /** 编辑分配时的回填数据（null = 新增分配） */
  const assignEditData = ref<{
    userId: string
    username: string
    email: string | null
    positionIds: string[]
    primaryPositionId: string | null
  } | null>(null)

  const getData = async () => {
    loading.value = true
    try {
      const result = await searchUserPositions({
        query: searchForm.value.username || null,
        position_name: searchForm.value.position || null,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取用户岗位失败:', error)
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  // 搜索 → 合并参数并跳回第 1 页（分页跳转规范：搜索/重置/改每页条数均回第 1 页）
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

  /** 新增分配（清空编辑回填） */
  const openAssignAdd = () => {
    assignEditData.value = null
    assignVisible.value = true
  }

  /** 取某用户的全部分配（rpc_assign_user_positions 为全量覆盖，编辑/删除前必须取全量） */
  const fetchUserAssignments = async (userId: string) => {
    const result = await searchUserPositions({ user_id: userId, limit: 100 })
    return result.items
  }

  /** 编辑某用户的岗位分配（回填其全部岗位与主岗位） */
  const handleAssignEdit = async (row: UserPositionItem) => {
    try {
      const userRows = await fetchUserAssignments(row.user_id)
      assignEditData.value = {
        userId: row.user_id,
        username: row.username || row.user_id,
        email: row.email,
        positionIds: userRows.map((r) => r.position_id),
        primaryPositionId: userRows.find((r) => r.is_primary)?.position_id ?? null
      }
      assignVisible.value = true
    } catch (error) {
      console.error('获取用户岗位分配失败:', error)
    }
  }

  /** 移除单条分配（rpc_assign_user_positions 为全量覆盖，提交移除后剩余岗位） */
  const handleAssignDelete = async (row: UserPositionItem) => {
    try {
      await ElMessageBox.confirm(
        `确定移除用户「${row.username || row.user_id}」的岗位「${row.pos_name}」分配吗？`,
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      const userRows = await fetchUserAssignments(row.user_id)
      const remaining = userRows
        .filter((r) => r.position_id !== row.position_id)
        .map((r) => r.position_id)
      const primaryId = userRows.find((r) => r.is_primary)?.position_id ?? null
      await assignUserPositions({
        p_user_id: row.user_id,
        p_position_ids: remaining,
        p_primary_position_id: remaining.includes(primaryId as string) ? primaryId : null
      })
      ElMessage.success('移除成功')
      getData()
    } catch (error) {
      console.warn('移除用户岗位失败:', error)
    }
  }

  const fmtTime = (v: string | null) => (v ? String(v).replace('T', ' ').slice(0, 19) : '-')

  const { columns, columnChecks } = useTableColumns<UserPositionItem>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'username',
      label: '用户名',
      minWidth: 140,
      formatter: (row) => row.username || row.user_id
    },
    {
      prop: 'email',
      label: '邮箱',
      minWidth: 160,
      formatter: (row) => row.email || '-'
    },
    {
      prop: 'pos_name',
      label: '岗位',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => row.path_name || row.pos_name
    },
    {
      prop: 'is_primary',
      label: '主岗位',
      width: 90,
      align: 'center',
      formatter: (row) =>
        row.is_primary ? h(ElTag, { type: 'success', size: 'small' }, () => '主岗') : '-'
    },
    {
      prop: 'created_at',
      label: '分配时间',
      minWidth: 150,
      formatter: (row) => fmtTime(row.created_at)
    },
    {
      prop: 'created_by_username',
      label: '分配人',
      minWidth: 120,
      formatter: (row) => row.created_by_username || '-'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 130,
      align: 'center',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: center' }, [
          h(ArtButtonTable, {
            type: 'edit',
            title: '编辑分配',
            onClick: () => handleAssignEdit(row)
          }),
          h(ArtButtonTable, {
            type: 'delete',
            title: '移除分配',
            onClick: () => handleAssignDelete(row)
          })
        ])
    }
  ])

  onMounted(getData)
</script>
