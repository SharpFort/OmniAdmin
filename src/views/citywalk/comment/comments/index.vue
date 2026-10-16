<!-- 评论管理（api_v1_content_comment.v_comments_admin + rpc_moderate_comment 单条/批量）
  动作集：hide 隐藏 / restore 恢复 / violation 违规 / delete 删除 / top 置顶 / untop 取消置顶 -->
<template>
  <div class="citywalk-comments-page art-full-height">
    <CommentSearch v-model="searchForm" @search="handleSearch" @reset="resetSearch" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="getData">
        <template #left>
          <ElButton
            v-if="selectedRows.length"
            size="small"
            :loading="bulkLoading"
            @click="handleBatch('hide')"
          >
            批量隐藏（{{ selectedRows.length }}）
          </ElButton>
          <ElButton
            v-if="selectedRows.length"
            size="small"
            type="success"
            :loading="bulkLoading"
            @click="handleBatch('restore')"
          >
            批量恢复
          </ElButton>
        </template>
      </ArtTableHeader>

      <el-alert
        v-if="permissionDenied"
        type="warning"
        show-icon
        :closable="false"
        class="mx-4 mb-3"
        title="无权限查看评论管理（仅管理员可用），请联系管理员"
      />

      <ArtTable
        v-else
        ref="artTableRef"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { getCommentsAdminList, moderateComment, batchModerateComments } from '@/api/citywalk'
  import { PostgrestRequestError } from '@/api/request'
  import CommentSearch from './modules/comment-search.vue'
  import { ElTag, ElButton, ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'CitywalkComments' })

  type Comment = Api.Citywalk.Comment

  const defaultSearchForm = () => ({ keyword: '', status: '', onlyReported: false })
  const searchForm = ref(defaultSearchForm())

  const loading = ref(false)
  const permissionDenied = ref(false)
  const data = ref<Comment[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })
  const artTableRef = ref()

  const getData = async () => {
    loading.value = true
    try {
      const result = await getCommentsAdminList({
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined,
        onlyReported: searchForm.value.onlyReported || undefined,
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
        console.error('获取评论列表失败:', error)
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
  // 审核动作
  // ------------------------------------------------------------------
  const actionMap: Record<string, { label: string; confirm: string; btnType?: any }> = {
    hide: { label: '隐藏', confirm: '隐藏后 C 端不可见，可随时恢复', btnType: 'warning' },
    restore: { label: '恢复', confirm: '恢复为正常状态，C 端可见', btnType: 'success' },
    violation: { label: '标违规', confirm: '标记为违规内容', btnType: 'danger' },
    delete: { label: '删除', confirm: '删除该评论（软删除，不可在管理端恢复）', btnType: 'danger' },
    top: { label: '置顶', confirm: '将该评论置顶展示' },
    untop: { label: '取消置顶', confirm: '取消置顶展示' }
  }

  const runAction = async (id: string, action: string) => {
    const meta = actionMap[action]
    try {
      await ElMessageBox.confirm(meta.confirm, `确认${meta.label}`, { type: 'warning' })
    } catch {
      return
    }
    try {
      await moderateComment(id, action)
      ElMessage.success(`已${meta.label}`)
      getData()
    } catch (error) {
      console.error(`${meta.label}失败:`, error)
    }
  }

  const selectedRows = ref<Comment[]>([])
  const bulkLoading = ref(false)
  const handleSelectionChange = (rows: Comment[]) => {
    selectedRows.value = rows
  }
  const handleBatch = async (action: string) => {
    const meta = actionMap[action]
    try {
      await ElMessageBox.confirm(
        `确认对 ${selectedRows.value.length} 条评论执行「${meta.label}」？`,
        '批量操作',
        { type: 'warning' }
      )
    } catch {
      return
    }
    bulkLoading.value = true
    try {
      await batchModerateComments(
        selectedRows.value.map((r) => r.id),
        action
      )
      ElMessage.success(`批量${meta.label}完成`)
      artTableRef.value?.elTableRef?.clearSelection()
      selectedRows.value = []
      getData()
    } catch (error) {
      console.error('批量操作失败:', error)
    } finally {
      bulkLoading.value = false
    }
  }

  const statusTagType = (status: string | null) => {
    if (status === 'normal') return 'success'
    if (status === 'hidden') return 'warning'
    if (status === 'violation') return 'danger'
    return 'info'
  }
  const statusLabel = (status: string | null) => {
    const map: Record<string, string> = {
      normal: '正常',
      hidden: '已隐藏',
      violation: '违规',
      deleted: '已删除'
    }
    return map[status || ''] || status || '-'
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'

  const { columns, columnChecks } = useTableColumns<Comment>(() => [
    { type: 'selection', width: 42 },
    { prop: 'content', label: '评论内容', minWidth: 260, showOverflowTooltip: true },
    {
      prop: 'entity_type',
      label: '实体类型',
      width: 95,
      formatter: (row) => row.entity_type || '-'
    },
    {
      prop: 'entity_id',
      label: '实体 ID',
      width: 130,
      showOverflowTooltip: true,
      formatter: (row) => row.entity_id || '-'
    },
    {
      prop: 'user_id',
      label: '用户',
      width: 120,
      showOverflowTooltip: true,
      formatter: (row) => row.user_id || '-'
    },
    {
      prop: 'status',
      label: '状态',
      width: 85,
      formatter: (row) =>
        h(ElTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
    },
    {
      prop: 'is_reported',
      label: '被举报',
      width: 75,
      formatter: (row) =>
        row.is_reported ? h(ElTag, { size: 'small', type: 'danger' }, () => '是') : '否'
    },
    {
      prop: 'like_count',
      label: '赞',
      width: 65,
      formatter: (row) => row.like_count ?? 0
    },
    {
      prop: 'reply_count',
      label: '回复',
      width: 65,
      formatter: (row) => row.reply_count ?? 0
    },
    {
      prop: 'created_at',
      label: '发布时间',
      width: 160,
      formatter: (row) => formatTime(row.created_at)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 190,
      fixed: 'right',
      formatter: (row) => {
        const buttons = [] as ReturnType<typeof h>[]
        if (row.status === 'normal') {
          buttons.push(
            h(
              ElButton,
              {
                type: 'warning',
                link: true,
                size: 'small',
                onClick: () => runAction(row.id, 'hide')
              },
              () => '隐藏'
            ),
            h(
              ElButton,
              {
                link: true,
                size: 'small',
                onClick: () => runAction(row.id, row.is_top ? 'untop' : 'top')
              },
              () => (row.is_top ? '取消置顶' : '置顶')
            )
          )
        } else if (row.status === 'hidden' || row.status === 'violation') {
          buttons.push(
            h(
              ElButton,
              {
                type: 'success',
                link: true,
                size: 'small',
                onClick: () => runAction(row.id, 'restore')
              },
              () => '恢复'
            )
          )
        }
        buttons.push(
          h(
            ElButton,
            {
              type: 'danger',
              link: true,
              size: 'small',
              onClick: () => runAction(row.id, 'violation')
            },
            () => '标违规'
          )
        )
        return h('div', null, buttons)
      }
    }
  ])

  onMounted(getData)
</script>
