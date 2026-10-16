<!-- 工单搜索栏 -->
<template>
  <ArtSearchBar
    ref="searchBarRef"
    v-model="formData"
    :items="formItems"
    :rules="rules"
    :span="8"
    :is-expand="true"
    @reset="handleReset"
    @search="handleSearch"
  >
  </ArtSearchBar>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: {
      keyword: string
      status: string
      ticketType: string
      priority: string
    }
  }
  interface Emits {
    (e: 'update:modelValue', value: any): void
    (e: 'search', params: any): void
    (e: 'reset'): void
  }
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const rules = {}

  const statusOptions = [
    { label: '待处理', value: 'Open' },
    { label: '处理中', value: 'Processing' },
    { label: '待用户', value: 'PendingUser' },
    { label: '已解决', value: 'Resolved' },
    { label: '已关闭', value: 'Closed' },
    { label: '无效', value: 'Invalid' }
  ]
  const typeOptions = [
    { label: '内容纠错', value: 'ContentError' },
    { label: '内容举报', value: 'ContentReport' },
    { label: '数据缺失', value: 'DataMissing' },
    { label: '缺陷报告', value: 'BugReport' },
    { label: '功能建议', value: 'FeatureRequest' },
    { label: '账号问题', value: 'AccountIssue' },
    { label: '其他', value: 'Other' }
  ]
  const priorityOptions = [
    { label: '低', value: 'Low' },
    { label: '中', value: 'Medium' },
    { label: '高', value: 'High' },
    { label: '紧急', value: 'Urgent' }
  ]

  const formItems = computed(() => [
    {
      label: '标题',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配工单标题',
      clearable: true
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { placeholder: '全部', options: statusOptions, clearable: true }
    },
    {
      label: '类型',
      key: 'ticketType',
      type: 'select',
      props: { placeholder: '全部', options: typeOptions, clearable: true }
    },
    {
      label: '优先级',
      key: 'priority',
      type: 'select',
      props: { placeholder: '全部', options: priorityOptions, clearable: true }
    }
  ])

  function handleReset() {
    emit('reset')
  }

  async function handleSearch(params: any) {
    await searchBarRef.value.validate()
    emit('search', params)
  }
</script>
