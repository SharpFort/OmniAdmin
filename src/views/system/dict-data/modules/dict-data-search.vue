<!-- 字典数据项搜索栏（ArtSearchBar 声明式配置，与 dict-search.vue 同构） -->
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
      dictName: string
      query: string
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
      label: '字典编码',
      key: 'dictName',
      type: 'input',
      placeholder: '按字典编码模糊过滤',
      clearable: true
    },
    {
      label: '显示名',
      key: 'query',
      type: 'input',
      placeholder: '按数据项显示名过滤',
      clearable: true
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
