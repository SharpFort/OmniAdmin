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
  import { getDeptTree } from '@/api/system-manage'

  interface Props {
    modelValue: {
      query: string
      dept_id: string
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
    { label: '启用', value: 'active' },
    { label: '禁用', value: 'inactive' }
  ]

  // 部门选项（get_dept_tree 扁平列表，path 展示层级）
  const deptOptions = ref<Array<{ label: string; value: string }>>([])

  onMounted(async () => {
    try {
      const tree = await getDeptTree()
      deptOptions.value = tree.map((item) => ({
        label: item.path || item.dept_name,
        value: item.id
      }))
    } catch (error) {
      console.warn('加载部门选项失败:', error)
      deptOptions.value = []
    }
  })

  const formItems = computed(() => [
    {
      label: '关键词',
      key: 'query',
      type: 'input',
      placeholder: '用户名 / 邮箱 / 姓名',
      clearable: true
    },
    {
      label: '部门',
      key: 'dept_id',
      type: 'select',
      props: {
        placeholder: '请选择部门',
        options: deptOptions.value,
        filterable: true,
        clearable: true
      }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        placeholder: '请选择状态',
        options: statusOptions,
        clearable: true
      }
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
