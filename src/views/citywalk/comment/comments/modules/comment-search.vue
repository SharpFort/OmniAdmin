<!-- 评论搜索栏 -->
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
      onlyReported: boolean
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
    { label: '正常', value: 'normal' },
    { label: '已隐藏', value: 'hidden' },
    { label: '违规', value: 'violation' }
  ]
  const boolOptions = [
    { label: '是', value: 'true' },
    { label: '否', value: 'false' }
  ]

  const formItems = computed(() => [
    {
      label: '评论内容',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配评论内容',
      clearable: true
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { placeholder: '全部', options: statusOptions, clearable: true }
    },
    {
      label: '仅看被举报',
      key: 'onlyReported',
      type: 'select',
      props: { placeholder: '不限', options: boolOptions, clearable: true }
    }
  ])

  function handleReset() {
    emit('reset')
  }

  async function handleSearch(params: any) {
    await searchBarRef.value.validate()
    if (params.onlyReported !== undefined) {
      params.onlyReported = params.onlyReported === 'true'
    }
    emit('search', params)
  }
</script>
