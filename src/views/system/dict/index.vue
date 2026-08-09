<!-- 字典管理（dict_type 视图类型表 + dict_data 视图数据项子表 + 6 个 CRUD RPC）
  数据源说明：管理操作用 dict_type/dict_data 视图（含 id/status/remark 全字段）；
  v_dict_list 仅作聚合展示（无 id 不可删改） -->
<template>
  <div class="dict-page art-full-height">
    <DictSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton
            v-perm="'sys:dict:create'"
            type="primary"
            v-ripple
            @click="showTypeDialog('add')"
          >
            新增字典类型
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

      <!-- 数据项弹窗（当前字典） -->
      <DictDataDialog
        v-model:visible="dataDialogVisible"
        :dict-name="currentDictName"
        @submit="getData"
      />

      <!-- 字典类型新增/编辑弹窗 -->
      <TypeDialog
        v-model:visible="typeDialogVisible"
        :type="typeDialogType"
        :edit-data="editTypeData"
        @submit="getData"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getDictTypes, deleteDictType } from '@/api/dict'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import DictSearch from './modules/dict-search.vue'
  import DictDataDialog from './modules/dict-data-dialog.vue'
  import TypeDialog from './modules/type-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Dict' })

  type DictType = Api.SystemManage.DictType

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ query: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<DictType[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const dataDialogVisible = ref(false)
  const currentDictName = ref('')

  const typeDialogVisible = ref(false)
  const typeDialogType = ref<'add' | 'edit'>('add')
  const editTypeData = ref<DictType | null>(null)

  const getData = async () => {
    loading.value = true
    try {
      const result = await getDictTypes({
        query: searchForm.value.query || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取字典列表失败:', error)
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

  const { columns, columnChecks } = useTableColumns<DictType>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'dict_name', label: '字典编码', minWidth: 150 },
    { prop: 'dict_label', label: '字典名称', minWidth: 140 },
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
        const active = String(row.status) === 'active' || String(row.status) === 'true'
        return h(ElTag, { type: active ? 'success' : 'warning' }, () => (active ? '启用' : '禁用'))
      }
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 140,
      formatter: (row) => row.remark || '-'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 200,
      align: 'right',
      fixed: 'right',
      formatter: (row) =>
        h('div', { style: 'text-align: right' }, [
          h(ArtButtonTable, {
            type: 'add',
            title: '管理数据项',
            onClick: () => showDataDialog(row)
          }),
          h(ArtButtonTable, {
            type: 'edit',
            onClick: () => showTypeDialog('edit', row)
          }),
          h(ArtButtonTable, {
            type: 'delete',
            onClick: () => handleDelete(row)
          })
        ])
    }
  ])

  onMounted(getData)

  const showDataDialog = (row: DictType) => {
    currentDictName.value = row.dict_name
    nextTick(() => {
      dataDialogVisible.value = true
    })
  }

  const showTypeDialog = (type: 'add' | 'edit', row?: DictType) => {
    typeDialogType.value = type
    editTypeData.value = row || null
    typeDialogVisible.value = true
  }

  const handleDelete = async (row: DictType) => {
    try {
      await ElMessageBox.confirm(
        `确定删除字典类型「${row.dict_label}」吗？其数据项将一并删除`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
      await deleteDictType(row.id)
      ElMessage.success('删除成功')
      getData()
    } catch (error) {
      console.warn('删除字典类型失败:', error)
    }
  }
</script>
