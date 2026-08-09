<!-- 应用配置搜索栏（ArtSearchBar 声明式配置；config_key 模糊 + 公开性筛选） -->
<template>
  <ArtSearchBar
    ref="searchBarRef"
    v-model="formData"
    :items="formItems"
    :rules="rules"
    @reset="handleReset"
    @search="handleSearch"
  >
  </ArtSearchBar>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: {
      query: string
      isPublic: '' | 'true' | 'false'
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

  const formItems = computed(() => [
    {
      label: '配置键',
      key: 'query',
      type: 'input',
      placeholder: '按配置键过滤，如 site.title',
      clearable: true
    },
    {
      label: '可见性',
      key: 'isPublic',
      type: 'select',
      placeholder: '全部',
      clearable: true,
      options: [
        { label: '公开', value: 'true' },
        { label: '内部', value: 'false' }
      ]
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
