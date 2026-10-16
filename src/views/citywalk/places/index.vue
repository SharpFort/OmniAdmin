<!-- 景点管理（v_pois_admin：全状态列表 + 生命周期操作 + 子表内容抽屉）
  P2 轮升级：发布（状态+entity_id+slug 闭环）、归档、重审；详情抽屉含描述/票务/联系/开放时间 -->
<template>
  <div class="citywalk-places-page art-full-height">
    <PlacesSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData" />

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看景点管理（仅管理员可用），请联系管理员"
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

    <!-- 发布对话框（状态流转 + entity_id + slug 一步到位） -->
    <ElDialog v-model="publishVisible" title="发布景点" width="480px">
      <el-alert
        v-if="publishTarget"
        type="info"
        :closable="false"
        class="mb-3"
        :title="`${publishTarget.name}（当前状态：${statusLabel(publishTarget.status)}）`"
      />
      <el-form label-width="90px">
        <el-form-item label="Slug">
          <el-input
            v-model="publishSlug"
            placeholder="URL 标识，如 yi-he-yuan（唯一，换绑自动 301）"
          >
            <template #prepend>/place/</template>
          </el-input>
        </el-form-item>
        <el-form-item label="预览">
          <span class="text-secondary">
            {{ publishTarget?.entity_id ? `/place/${publishTarget.entity_id}-` : '/place/{auto}-'
            }}{{ publishSlug || '…' }}
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="publishVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!publishSlug"
          :loading="publishing"
          @click="handlePublish"
        >
          确认发布
        </ElButton>
      </template>
    </ElDialog>

    <!-- 内容抽屉（基本信息 + 描述/票务/联系/开放时间） -->
    <PlaceContentDrawer v-model="contentVisible" :place="contentTarget" @refresh="getData" />
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getPlacesAdminList, changePlaceStatus, publishPlace } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import PlacesSearch from './modules/places-search.vue'
  import PlaceContentDrawer from './modules/place-content-drawer.vue'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkPlaces' })

  type Place = Api.Citywalk.Place

  const defaultSearchForm = () => ({ keyword: '', status: '' })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Place[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  const getData = async () => {
    loading.value = true
    try {
      const result = await getPlacesAdminList({
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined,
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
        console.error('获取景点列表失败:', error)
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
  // 生命周期操作
  // ------------------------------------------------------------------
  const statusLabel = (status: string | null) => {
    if (status === 'Published') return '已发布'
    if (status === 'PendingReview') return '待审核'
    if (status === 'Archived') return '已归档'
    return status || '-'
  }
  const statusTagType = (status: string | null) => {
    if (status === 'Published') return 'success'
    if (status === 'PendingReview') return 'warning'
    return 'info'
  }

  // 发布
  const publishVisible = ref(false)
  const publishTarget = ref<Place | null>(null)
  const publishSlug = ref('')
  const publishing = ref(false)

  const openPublish = (row: Place) => {
    publishTarget.value = row
    publishSlug.value = row.slug || ''
    publishVisible.value = true
  }

  const handlePublish = async () => {
    if (!publishTarget.value || !publishSlug.value.trim()) return
    publishing.value = true
    try {
      const result = await publishPlace(publishTarget.value.id, publishSlug.value.trim())
      ElMessage.success(`发布成功：${result.url || result.slug}`)
      publishVisible.value = false
      getData()
    } catch (error) {
      console.error('发布失败:', error)
    } finally {
      publishing.value = false
    }
  }

  // 状态转换（归档 / 重审）
  const runStatusChange = async (row: Place, newStatus: string, tip: string) => {
    try {
      await ElMessageBox.confirm(tip, '状态变更', { type: 'warning' })
    } catch {
      return
    }
    try {
      await changePlaceStatus(row.id, newStatus)
      ElMessage.success('状态已更新')
      getData()
    } catch (error) {
      console.error('状态变更失败:', error)
    }
  }

  const handleArchive = (row: Place) =>
    runStatusChange(
      row,
      'Archived',
      row.status === 'Published'
        ? '归档后 C 端不可见；恢复需先转「待审核」重审。确认归档？'
        : '审核不通过归档？确认后可随时转回待审核。'
    )
  const handleReview = (row: Place) =>
    runStatusChange(row, 'PendingReview', '转入待审核（重新进入审核流程）？')

  // 内容抽屉
  const contentVisible = ref(false)
  const contentTarget = ref<Place | null>(null)
  const openContent = (row: Place) => {
    contentTarget.value = row
    contentVisible.value = true
  }

  const { columns, columnChecks } = useTableColumns<Place>(() => [
    { type: 'index', width: 60, label: '序号' },
    {
      prop: 'name',
      label: '景点名称',
      minWidth: 170,
      formatter: (row) => row.name || '-'
    },
    {
      prop: 'status',
      label: '状态',
      width: 90,
      formatter: (row) =>
        h(ElTag, { type: statusTagType(row.status), size: 'small' }, () => statusLabel(row.status))
    },
    {
      prop: 'slug',
      label: 'Slug / 实体 ID',
      minWidth: 170,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.slug ? `${row.slug}（${row.entity_id || '无ID'}）` : row.entity_id || '（未发布）'
    },
    {
      prop: 'latitude',
      label: '坐标',
      width: 150,
      formatter: (row) => (row.latitude != null ? `${row.latitude}, ${row.longitude}` : '-')
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
      width: 230,
      fixed: 'right',
      formatter: (row) => {
        const buttons = [] as ReturnType<typeof h>[]
        if (row.status !== 'Archived') {
          buttons.push(
            h(
              ElButton,
              { type: 'primary', link: true, size: 'small', onClick: () => openPublish(row) },
              () => (row.status === 'Published' ? '换绑' : '发布')
            )
          )
        }
        if (row.status === 'Published') {
          buttons.push(
            h(
              ElButton,
              { type: 'warning', link: true, size: 'small', onClick: () => handleReview(row) },
              () => '重审'
            )
          )
        }
        if (row.status !== 'Archived') {
          buttons.push(
            h(
              ElButton,
              { type: 'danger', link: true, size: 'small', onClick: () => handleArchive(row) },
              () => '归档'
            )
          )
        } else {
          buttons.push(
            h(
              ElButton,
              { type: 'warning', link: true, size: 'small', onClick: () => handleReview(row) },
              () => '恢复重审'
            )
          )
        }
        buttons.push(
          h(ElButton, { link: true, size: 'small', onClick: () => openContent(row) }, () => '内容')
        )
        return h('div', null, buttons)
      }
    }
  ])

  onMounted(getData)
</script>

<style lang="scss" scoped>
  .text-secondary {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
