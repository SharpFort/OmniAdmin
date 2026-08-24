<!-- 字典数据（dict_data 视图 + rpc_create/update/delete_dict_data；独立页，与字典类型页互补） -->
<template>
  <div class="dict-data-page art-full-height">
    <DictDataSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton
            v-perm="'platform:dict:create'"
            type="primary"
            v-ripple
            @click="showDialog('add')"
          >
            新增数据项
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

      <DictDataDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :edit-data="editData"
        @submit="getData"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getDictDataList, deleteDictData } from '@/api/dict'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import DictDataSearch from './modules/dict-data-search.vue'
  import DictDataDialog from './modules/dict-data-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'DictData' })

  type DictData = Api.SystemManage.DictData

  // 搜索表单（单一数据源：搜索/重置/分页均基于此；ArtSearchBar 空值自动剔除）
  const defaultSearchForm = () => ({ dictName: '', query: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const data = ref<DictData[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const editData = ref<DictData | null>(null)

  const getData = async () => {
    loading.value = true
    try {
      const result = await getDictDataList({
        dictNameLike: searchForm.value.dictName || undefined,
        query: searchForm.value.query || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      console.error('获取字典数据失败:', error)
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

  const { columns, columnChecks } = useTableColumns<DictData>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'dict_name', label: '字典编码', minWidth: 140 },
    { prop: 'item_label', label: '显示名', minWidth: 120 },
    { prop: 'item_value', label: '值', minWidth: 120 },
    {
      prop: 'item_type',
      label: '类型',
      width: 90,
      align: 'center',
      formatter: (row) => (row.item_type ? String(row.item_type) : '-')
    },
    {
      prop: 'is_default',
      label: '默认',
      width: 70,
      align: 'center',
      formatter: (row) => (row.is_default ? h(ElTag, { type: 'success' }, () => '默认') : '-')
    },
    { prop: 'sort_no', label: '排序', width: 70, align: 'center' },
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
      minWidth: 120,
      formatter: (row) => row.remark || '-'
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
            onClick: () => showDialog('edit', row)
          }),
          h(ArtButtonTable, {
            type: 'delete',
            onClick: () => handleDelete(row)
          })
        ])
    }
  ])

  onMounted(getData)

  const showDialog = (type: 'add' | 'edit', row?: DictData) => {
    dialogType.value = type
    editData.value = row || null
    dialogVisible.value = true
  }

  const handleDelete = async (row: DictData) => {
    try {
      await ElMessageBox.confirm(
        `确定删除数据项「${row.item_label}」吗？（${row.dict_name}）`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
      await deleteDictData(row.id)
      ElMessage.success('删除成功')
      getData()
    } catch (error) {
      console.warn('删除数据项失败:', error)
    }
  }
</script>
