<!-- 部门管理（get_dept_tree 扁平 level/path + 组树 + rpc_create/update/delete_department） -->
<template>
  <div class="dept-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton v-perm="'sys:dept:create'" type="primary" v-ripple @click="handleAdd">
            新增部门
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

      <DeptDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :edit-data="editData"
        :dept-tree="tree"
        @submit="getData"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getDeptTree, deleteDept } from '@/api/system-manage'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import DeptDialog from './modules/dept-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Dept' })

  type DeptNode = Api.SystemManage.DeptNode & { children?: DeptNode[] }

  const loading = ref(false)
  const isExpanded = ref(false)
  const tableRef = ref()
  const tree = ref<DeptNode[]>([])

  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const editData = ref<DeptNode | null>(null)

  /** 扁平列表 → 树（两遍构建） */
  const buildTree = (items: Api.SystemManage.DeptNode[]): DeptNode[] => {
    const nodeMap = new Map<string, DeptNode>()
    items.forEach((item) => nodeMap.set(item.id, { ...item }))
    const roots: DeptNode[] = []
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

  const { columnChecks, columns } = useTableColumns<DeptNode>(() => [
    { prop: 'dept_name', label: '部门名称', minWidth: 160 },
    { prop: 'path', label: '层级路径', minWidth: 200, formatter: (row) => row.path || '-' },
    {
      prop: 'sort_order',
      label: '排序',
      width: 70,
      align: 'center'
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
      width: 180,
      align: 'right',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: right' }, [
          h(ArtButtonTable, {
            type: 'add',
            title: '新增子部门',
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
      const items = await getDeptTree()
      tree.value = buildTree(items)
    } catch (error) {
      console.error('获取部门树失败:', error)
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

  const handleAddChild = (parent: DeptNode) => {
    dialogType.value = 'add'
    editData.value = { parent_id: parent.id } as unknown as DeptNode
    dialogVisible.value = true
  }

  const handleEdit = (row: DeptNode) => {
    dialogType.value = 'edit'
    editData.value = row
    dialogVisible.value = true
  }

  const handleDelete = async (row: DeptNode) => {
    try {
      await ElMessageBox.confirm(`确定删除部门「${row.dept_name}」吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteDept(row.id)
      ElMessage.success('删除成功')
      getData()
    } catch (error) {
      console.warn('删除部门失败:', error)
    }
  }

  const toggleExpand = () => {
    isExpanded.value = !isExpanded.value
    nextTick(() => {
      if (tableRef.value?.elTableRef && tree.value) {
        const processRows = (rows: DeptNode[]) => {
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
