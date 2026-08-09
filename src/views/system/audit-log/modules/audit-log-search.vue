<!-- 审计日志搜索栏（ArtSearchBar 声明式配置，与 user/role/login-log 页 *-search.vue 同构）
  两行布局：span=8（每行 3 项）+ is-expand（全部显示，无收起按钮）
  ⚠️ 9.4 已实测：operation 值域 = INSERT/UPDATE/DELETE（大写，audit_trigger_func）；
  log_operate 写入的行 operation 为 NULL → 仅「全部」可见 -->
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
      query: string
      table_name: string
      operation: string
      date_range: [string, string] | []
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

  const operationOptions = [
    { label: 'INSERT', value: 'INSERT' },
    { label: 'UPDATE', value: 'UPDATE' },
    { label: 'DELETE', value: 'DELETE' }
  ]

  const formItems = computed(() => [
    {
      label: '关键词',
      key: 'query',
      type: 'input',
      placeholder: '操作人 / 变更内容',
      clearable: true
    },
    {
      label: '表名',
      key: 'table_name',
      type: 'input',
      placeholder: '模糊匹配，如 sys_user',
      clearable: true
    },
    {
      label: '操作',
      key: 'operation',
      type: 'select',
      props: {
        placeholder: '请选择操作',
        options: operationOptions,
        clearable: true
      }
    },
    {
      label: '时间范围',
      key: 'date_range',
      type: 'datetime',
      props: {
        type: 'daterange',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        rangeSeparator: '至',
        valueFormat: 'YYYY-MM-DD'
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
