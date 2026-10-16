<!-- 标签管理（api_v1_masterdata.v_tags + rpc_merge_tag）
  数据准备相关：标签体系是景点/游记打标基础；合并是唯一写操作（收口管理员），其余只读 -->
<template>
  <div class="citywalk-tags-page art-full-height">
    <TagsSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <!-- 标签合并对话框（源标签预填，目标标签可搜索选择） -->
    <ElDialog v-model="mergeVisible" title="合并标签" width="460px">
      <el-alert
        type="warning"
        :closable="false"
        class="mb-3"
        :title="`将「${mergeSource?.display_name}」并入目标标签：源标签置为 merged 状态，其引用改指目标`"
      />
      <el-form label-width="90px">
        <el-form-item label="源标签">
          <el-tag>{{ mergeSource?.display_name }}（{{ mergeSource?.slug }}）</el-tag>
        </el-form-item>
        <el-form-item label="目标标签">
          <el-select
            v-model="mergeTargetId"
            filterable
            remote
            :remote-method="searchTargetTags"
            :loading="targetLoading"
            placeholder="输入名称搜索目标标签"
            class="w-full"
          >
            <el-option
              v-for="t in targetOptions"
              :key="t.id"
              :label="`${t.display_name}（${t.slug}）`"
              :value="t.id"
              :disabled="t.id === mergeSource?.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="mergeVisible = false">取消</ElButton>
        <ElButton type="primary" :disabled="!mergeTargetId" :loading="merging" @click="handleMerge">
          确认合并
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getTagsList, mergeTag } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import TagsSearch from './modules/tags-search.vue'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkTags' })

  type Tag = Api.Citywalk.Tag

  const defaultSearchForm = () => ({ keyword: '', status: '', tagType: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Tag[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getTagsList({
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined,
        tagType: searchForm.value.tagType || undefined,
        limit: pagination.size,
        offset: (pagination.current - 1) * pagination.size
      })
      permissionDenied.value = false
      data.value = result.items
      pagination.total = result.total
    } catch (error) {
      if (error instanceof PostgrestRequestError && error.code === '42501') {
        permissionDenied.value = true
      } else {
        console.error('获取标签列表失败:', error)
      }
      data.value = []
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

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

  // ------------------------------------------------------------------
  // 合并
  // ------------------------------------------------------------------
  const mergeVisible = ref(false)
  const mergeSource = ref<Tag | null>(null)
  const mergeTargetId = ref('')
  const merging = ref(false)
  const targetOptions = ref<Tag[]>([])
  const targetLoading = ref(false)

  const openMerge = (row: Tag) => {
    mergeSource.value = row
    mergeTargetId.value = ''
    mergeVisible.value = true
    searchTargetTags('')
  }

  const searchTargetTags = async (query: string) => {
    targetLoading.value = true
    try {
      const result = await getTagsList({ keyword: query || undefined, limit: 50, offset: 0 })
      targetOptions.value = result.items
    } catch (error) {
      console.warn('搜索目标标签失败:', error)
      targetOptions.value = []
    } finally {
      targetLoading.value = false
    }
  }

  const handleMerge = async () => {
    if (!mergeSource.value || !mergeTargetId.value) return
    try {
      await ElMessageBox.confirm(
        `确认将「${mergeSource.value.display_name}」合并到所选目标标签？该操作影响源标签的全部引用。`,
        '合并确认',
        { type: 'warning' }
      )
    } catch {
      return
    }
    merging.value = true
    try {
      await mergeTag(mergeSource.value.id, mergeTargetId.value)
      ElMessage.success('合并完成')
      mergeVisible.value = false
      getData()
    } catch (error) {
      console.error('合并失败:', error)
    } finally {
      merging.value = false
    }
  }

  /** 状态着色 */
  const statusTagType = (status: string | null) => {
    if (status === 'active' || status === 'Active') return 'success'
    if (status === 'merged' || status === 'Merged') return 'info'
    return 'warning'
  }

  const { columns, columnChecks } = useTableColumns<Tag>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'display_name',
      label: '标签名',
      minWidth: 150,
      formatter: (row) => row.display_name || row.slug
    },
    { prop: 'slug', label: 'Slug', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'tag_type',
      label: '类型',
      width: 110,
      formatter: (row) => row.tag_type || '-'
    },
    {
      prop: 'type_source',
      label: '来源',
      width: 110,
      formatter: (row) => row.type_source || '-'
    },
    {
      prop: 'language_code',
      label: '语言',
      width: 80,
      formatter: (row) => row.language_code || '-'
    },
    {
      prop: 'status',
      label: '状态',
      width: 90,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => row.status || '-')
    },
    {
      prop: 'merged_to_tag_id',
      label: '已并入',
      width: 100,
      formatter: (row) => (row.merged_to_tag_id ? '是' : '-')
    },
    {
      prop: 'display_description',
      label: '描述',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) => row.display_description || '-'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 90,
      fixed: 'right',
      formatter: (row) =>
        h(
          ElButton,
          { type: 'primary', link: true, size: 'small', onClick: () => openMerge(row) },
          () => '合并…'
        )
    }
  ])

  onMounted(getData)
</script>
