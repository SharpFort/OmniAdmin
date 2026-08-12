<!-- 用户岗位（user_position 视图：仅 ID 列，用户名/岗位名前端 join v_user_list + 岗位树；
  搜索/分页均为客户端（视图无用户名列可服务端过滤）；分配复用岗位页 AssignDialog） -->
<template>
  <div class="user-position-page art-full-height">
    <UserPositionSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton
            v-perm="'public:position:assign'"
            type="primary"
            v-ripple
            @click="assignVisible = true"
          >
            分配岗位
          </ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="pagedData"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <!-- 复用岗位管理页分配弹窗（rpc_assign_user_positions） -->
      <AssignDialog v-model:visible="assignVisible" @submit="getData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getUserPositions, getUserList, getPositionTree } from '@/api/system-manage'
  import UserPositionSearch from './modules/user-position-search.vue'
  import AssignDialog from '@/views/system/position/modules/assign-dialog.vue'
  import { ElTag } from 'element-plus'

  defineOptions({ name: 'UserPosition' })

  type UserPositionRow = Api.SystemManage.UserPositionRow

  /** 展示行（join 后） */
  interface DisplayRow extends UserPositionRow {
    username: string
    email: string | null
    pos_name: string
    assigner_name: string
  }

  // 搜索表单（客户端过滤）
  const defaultSearchForm = () => ({ username: '', position: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const allRows = ref<UserPositionRow[]>([])
  const userMap = ref<Record<string, { username: string; email: string | null }>>({})
  const positionMap = ref<Record<string, string>>({})
  const assignVisible = ref(false)

  const pagination = reactive({ current: 1, size: 20, total: 0 })

  /** 加载关联行 + 用户/岗位映射（一次性全量，join 后本地过滤） */
  const getData = async () => {
    loading.value = true
    try {
      const [rows, users, positions] = await Promise.all([
        getUserPositions({ limit: 1000, offset: 0 }),
        getUserList({ limit: 500, offset: 0 }),
        getPositionTree()
      ])
      allRows.value = rows.items || []

      const map: Record<string, { username: string; email: string | null }> = {}
      users.items.forEach((u) => {
        map[u.id] = { username: u.username, email: u.email }
      })
      userMap.value = map

      const posMap: Record<string, string> = {}
      positions.forEach((p) => {
        posMap[p.id] = p.path_name || p.pos_name
      })
      positionMap.value = posMap
    } catch (error) {
      console.error('加载用户岗位失败:', error)
      allRows.value = []
    } finally {
      loading.value = false
    }
  }

  /** 客户端过滤（用户名/邮箱/岗位名） */
  const filtered = computed<DisplayRow[]>(() => {
    const kw = searchForm.value.username.trim().toLowerCase()
    const posKw = searchForm.value.position.trim().toLowerCase()
    return allRows.value
      .map((row) => {
        const user = userMap.value[row.user_id]
        return {
          ...row,
          username: user?.username || row.user_id,
          email: user?.email ?? null,
          pos_name: positionMap.value[row.position_id] || row.position_id,
          assigner_name:
            userMap.value[row.created_by || '']?.username || (row.created_by ? row.created_by : '-')
        }
      })
      .filter((row) => {
        if (
          kw &&
          !row.username.toLowerCase().includes(kw) &&
          !(row.email || '').toLowerCase().includes(kw)
        ) {
          return false
        }
        if (posKw && !row.pos_name.toLowerCase().includes(posKw)) return false
        return true
      })
  })

  // 过滤结果变化 → 同步总数并夹紧当前页
  watch(filtered, (rows) => {
    pagination.total = rows.length
    const maxPage = Math.max(1, Math.ceil(rows.length / pagination.size))
    if (pagination.current > maxPage) pagination.current = maxPage
  })

  const pagedData = computed(() => {
    const start = (pagination.current - 1) * pagination.size
    return filtered.value.slice(start, start + pagination.size)
  })

  const fmtTime = (v: string | null) => (v ? String(v).replace('T', ' ').slice(0, 19) : '-')

  // 搜索/重置：客户端直接触发过滤（无需回服务端；仍按规范跳回第 1 页）
  const handleSearch = (params: any) => {
    Object.assign(searchForm.value, defaultSearchForm(), params)
    pagination.current = 1
  }
  const resetSearch = () => {
    searchForm.value = defaultSearchForm()
    pagination.current = 1
  }
  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
  }
  const handleCurrentChange = (page: number) => {
    pagination.current = page
  }

  const { columns, columnChecks } = useTableColumns<DisplayRow>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'username', label: '用户名', minWidth: 140 },
    {
      prop: 'email',
      label: '邮箱',
      minWidth: 160,
      formatter: (row) => row.email || '-'
    },
    { prop: 'pos_name', label: '岗位', minWidth: 150 },
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
      prop: 'assigner_name',
      label: '分配人',
      minWidth: 120,
      formatter: (row) => row.assigner_name
    }
  ])

  onMounted(getData)
</script>
