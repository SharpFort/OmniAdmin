<!-- 岗位管理（rpc_get_position_tree depth/path_name + CRUD + assignUserPositions 分配） -->
<template>
  <div class="position-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton v-perm="'platform:position:create'" type="primary" v-ripple @click="handleAdd">
            新增岗位
          </ElButton>
          <ElButton v-perm="'platform:position:assign'" v-ripple @click="showAssignDialog">
            分配岗位
          </ElButton>
          <ElButton v-ripple @click="toggleExpand">
            {{ isExpanded ? '收起' : '展开' }}
          </ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        ref="tableRef"
        rowKey="id"
        :loading="loading"
        :columns="columns"
        :data="tree"
        :stripe="false"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="false"
      />

      <PositionDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :edit-data="editData"
        :position-tree="tree"
        @submit="getData"
      />

      <AssignDialog v-model:visible="assignDialogVisible" @submit="getData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getPositionTree, deletePosition } from '@/api/system-manage'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import PositionDialog from './modules/position-dialog.vue'
  import AssignDialog from './modules/assign-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Position' })

  type PositionNode = Api.SystemManage.PositionNode & { children?: PositionNode[] }

  const loading = ref(false)
  const isExpanded = ref(false)
  const tableRef = ref()
  const tree = ref<PositionNode[]>([])

  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const editData = ref<PositionNode | null>(null)
  const assignDialogVisible = ref(false)

  /** 扁平列表 → 树（两遍构建） */
  const buildTree = (items: Api.SystemManage.PositionNode[]): PositionNode[] => {
    const nodeMap = new Map<string, PositionNode>()
    items.forEach((item) => nodeMap.set(item.id, { ...item }))
    const roots: PositionNode[] = []
    items.forEach((item) => {
      const node = nodeMap.get(item.id)!
      if (item.parent_id && nodeMap.has(item.parent_id)) {
        const parent = nodeMap.get(item.parent_id)!
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots
  }

  const { columnChecks, columns } = useTableColumns<PositionNode>(() => [
    { prop: 'pos_name', label: '岗位名称', minWidth: 150 },
    { prop: 'pos_code', label: '岗位编码', minWidth: 120, formatter: (row) => row.pos_code || '-' },
    {
      prop: 'path_name',
      label: '层级路径',
      minWidth: 180,
      formatter: (row) => row.path_name || '-'
    },
    {
      prop: 'sort_no',
      label: '排序',
      width: 70,
      align: 'center'
    },
    {
      prop: 'status',
      label: '状态',
      width: 80,
      formatter: (row) => {
        const raw = row.status as unknown
        const active =
          raw === true || raw === 'true' || raw === 'active' || raw === 1 || raw === '1'
        return h(ElTag, { type: active ? 'success' : 'warning' }, () => (active ? '启用' : '禁用'))
      }
    },
    {
      prop: 'operation',
      label: '操作',
      width: 180,
      align: 'right',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: right' }, [
          h(ArtButtonTable, {
            type: 'add',
            title: '新增子岗位',
            onClick: () => handleAddChild(row)
          }),
          h(ArtButtonTable, { type: 'edit', onClick: () => handleEdit(row) }),
          h(ArtButtonTable, { type: 'delete', onClick: () => handleDelete(row) })
        ])
    }
  ])

  const getData = async () => {
    loading.value = true
    try {
      const items = await getPositionTree()
      tree.value = buildTree(items)
    } catch (error) {
      console.error('获取岗位树失败:', error)
      tree.value = []
    } finally {
      loading.value = false
    }
  }

  onMounted(getData)

  const handleAdd = () => {
    dialogType.value = 'add'
    editData.value = null
    dialogVisible.value = true
  }

  const handleAddChild = (parent: PositionNode) => {
    dialogType.value = 'add'
    editData.value = { parent_id: parent.id } as unknown as PositionNode
    dialogVisible.value = true
  }

  const handleEdit = (row: PositionNode) => {
    dialogType.value = 'edit'
    editData.value = row
    dialogVisible.value = true
  }

  const handleDelete = async (row: PositionNode) => {
    try {
      await ElMessageBox.confirm(`确定删除岗位「${row.pos_name}」吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deletePosition(row.id)
      ElMessage.success('删除成功')
      getData()
    } catch (error) {
      console.warn('删除岗位失败:', error)
    }
  }

  const showAssignDialog = () => {
    assignDialogVisible.value = true
  }

  const toggleExpand = () => {
    isExpanded.value = !isExpanded.value
    nextTick(() => {
      if (tableRef.value?.elTableRef && tree.value) {
        const processRows = (rows: PositionNode[]) => {
          rows.forEach((row) => {
            if (row.children?.length) {
              tableRef.value.elTableRef.toggleRowExpansion(row, isExpanded.value)
              processRows(row.children)
            }
          })
        }
        processRows(tree.value)
      }
    })
  }
</script>
