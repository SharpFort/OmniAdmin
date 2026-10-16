<!-- POI 纠错搜索栏 -->
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
    { label: '待复审', value: 'Pending' },
    { label: '已通过', value: 'Approved' },
    { label: '已驳回', value: 'Rejected' }
  ]

  const formItems = computed(() => [
    {
      label: '景点名',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配景点名',
      clearable: true
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { placeholder: '全部', options: statusOptions, clearable: true }
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
