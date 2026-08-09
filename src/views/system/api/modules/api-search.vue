<!-- API 权限点搜索栏（ArtSearchBar 声明式配置；039 api_group 分组筛选，选项从数据源拉取） -->
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
  import { getView } from '@/api/request'

  interface Props {
    modelValue: {
      query: string
      api_group: string
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

  /** 分组选项（从 iam_api 全量 distinct；后端 039 已回填 13 组） */
  const groupOptions = ref<Array<{ label: string; value: string }>>([])

  const formItems = computed(() => [
    {
      label: '关键词',
      key: 'query',
      type: 'input',
      placeholder: '按名称/路径/编码过滤',
      clearable: true
    },
    {
      label: '分组',
      key: 'api_group',
      type: 'select',
      placeholder: '全部',
      clearable: true,
      props: {
        options: groupOptions.value
      }
    }
  ])

  const loadGroups = async () => {
    try {
      const rows = await getView<{ api_group: string | null }>('iam_api', {
        select: 'api_group',
        limit: 1000
      })
      const seen = new Set<string>()
      const groups: Array<{ label: string; value: string }> = []
      rows.forEach((row) => {
        if (row.api_group && !seen.has(row.api_group)) {
          seen.add(row.api_group)
          groups.push({ label: row.api_group, value: row.api_group })
        }
      })
      groupOptions.value = groups
    } catch (error) {
      console.warn('拉取 API 分组列表失败:', error)
    }
  }

  function handleReset() {
    emit('reset')
  }

  async function handleSearch(params: any) {
    await searchBarRef.value.validate()
    emit('search', params)
  }

  onMounted(loadGroups)
</script>
