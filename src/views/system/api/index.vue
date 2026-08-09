<!-- API 权限点管理（iam_api 视图；039 按 api_group 分组展示 + menu_id 归属菜单；
  043 写 RPC：新增/编辑/删除，sys:api:create/update/delete） -->
<template>
  <div class="api-page art-full-height">
    <ApiSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton v-perm="'sys:api:create'" type="primary" v-ripple @click="handleAddApi">
            新增 API
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

      <!-- API 新增/编辑弹窗 -->
      <ApiDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :edit-data="editData"
        :menu-tree="menuTree"
        @submit="getData"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getApiList, getMenuList, deleteApi } from '@/api/system-manage'
  import ApiSearch from './modules/api-search.vue'
  import ApiDialog from './modules/api-dialog.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { ElTag, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Api' })

  type ApiRow = Api.SystemManage.ApiAdminNode

  /** 分组色板（13 组业务分组循环取色） */
  const GROUP_COLORS = [
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'primary',
    'success',
    'warning'
  ] as const
  const groupColorIndex = new Map<string, number>()
  const getGroupColor = (group: string | null): string => {
    if (!group) return 'info'
    if (!groupColorIndex.has(group)) groupColorIndex.set(group, groupColorIndex.size)
    return GROUP_COLORS[groupColorIndex.get(group)! % GROUP_COLORS.length]
  }

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '', api_group: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<ApiRow[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  // 新增/编辑弹窗
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const editData = ref<ApiRow | null>(null)

  /** menu_id → 菜单名 映射（039 归属菜单列展示；iam_menu 全量） */
  const menuNameMap = ref<Record<string, string>>({})

  /** 归属菜单树（弹窗 el-tree-select 数据源；与映射同源一次拉取） */
  const menuTree = ref<Array<{ id: string; label: string; children?: unknown[] }>>([])

  const loadMenuNames = async () => {
    try {
      const result = await getMenuList({ limit: 1000, offset: 0 })
      const map: Record<string, string> = {}
      result.items.forEach((item) => {
        map[item.id] = item.menu_name
      })
      menuNameMap.value = map
      // 两遍构建树（先 Map 后挂载，不假设父先于子）
      const nodeMap = new Map<string, { id: string; label: string; children?: unknown[] }>()
      result.items.forEach((item) => {
        nodeMap.set(item.id, { id: item.id, label: item.menu_name })
      })
      const roots: Array<{ id: string; label: string; children?: unknown[] }> = []
      result.items.forEach((item) => {
        const node = nodeMap.get(item.id)!
        if (item.parent_id && nodeMap.has(item.parent_id)) {
          const parent = nodeMap.get(item.parent_id)!
          parent.children = parent.children || []
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      })
      menuTree.value = roots
    } catch (error) {
      console.warn('拉取菜单映射失败（归属菜单列显示 -）:', error)
    }
  }

  const getData = async () => {
    loading.value = true
    try {
      const result = await getApiList({
        query: searchForm.value.query || undefined,
        apiGroup: searchForm.value.api_group || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取 API 列表失败:', error)
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

  const { columns, columnChecks } = useTableColumns<ApiRow>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'api_code', label: '权限编码', minWidth: 140, formatter: (row) => row.api_code || '-' },
    { prop: 'name', label: '名称', minWidth: 140, formatter: (row) => row.name || '-' },
    {
      prop: 'method',
      label: '方法',
      width: 90,
      formatter: (row) => h(ElTag, { type: 'info', size: 'small' }, () => row.method)
    },
    { prop: 'path', label: '路径', minWidth: 200 },
    // ↓↓↓ 039 分组/归属展示 ↓↓↓
    {
      prop: 'api_group',
      label: '分组',
      width: 110,
      align: 'center',
      formatter: (row) =>
        row.api_group
          ? h(
              ElTag,
              {
                type: getGroupColor(row.api_group) as
                  'primary' | 'success' | 'warning' | 'danger' | 'info',
                size: 'small'
              },
              () => row.api_group
            )
          : '-'
    },
    {
      prop: 'menu_id',
      label: '归属菜单',
      minWidth: 120,
      formatter: (row) =>
        row.menu_id ? menuNameMap.value[row.menu_id] || row.menu_id.slice(0, 8) : '-'
    },
    {
      prop: 'is_active',
      label: '状态',
      width: 80,
      formatter: (row) =>
        h(ElTag, { type: row.is_active ? 'success' : 'warning' }, () =>
          row.is_active ? '启用' : '禁用'
        )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 130,
      align: 'right',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: right' }, [
          h(ArtButtonTable, {
            type: 'edit',
            onClick: () => handleEditApi(row)
          }),
          h(ArtButtonTable, {
            type: 'delete',
            onClick: () => handleDeleteApi(row)
          })
        ])
    }
  ])

  const handleAddApi = (): void => {
    dialogType.value = 'add'
    editData.value = null
    dialogVisible.value = true
  }

  const handleEditApi = (row: ApiRow): void => {
    dialogType.value = 'edit'
    editData.value = row
    dialogVisible.value = true
  }

  /** 删除（🔐 sys:api:delete；有角色绑定后端 23503 拒绝） */
  const handleDeleteApi = async (row: ApiRow): Promise<void> => {
    try {
      await ElMessageBox.confirm(
        `确定删除 API「${row.name || row.path}」吗？删除后无法恢复`,
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      await deleteApi(row.id)
      ElMessage.success('删除成功')
      getData()
    } catch (error: any) {
      // 取消弹窗不提示
      if (error === 'cancel' || error === 'close') return
      if (error?.message?.includes('bindings') || error?.message?.includes('23503')) {
        ElMessage.error('该 API 已被角色绑定，请先在角色授权页解绑后再删除')
      } else {
        console.error('删除 API 失败:', error)
        ElMessage.error(`删除失败：${error?.message || '未知错误'}`)
      }
    }
  }

  onMounted(() => {
    getData()
    loadMenuNames()
  })
</script>
