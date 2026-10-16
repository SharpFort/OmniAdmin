<!-- 匹配队列搜索栏（provider/状态/命中规则/源名模糊；R4 过滤开关） -->
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
      provider: string
      status: string
      rule: string
      keyword: string
      onlyNoCandidate: boolean
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

  const providerOptions = [
    { label: 'mca（国家地名信息库）', value: 'mca' },
    { label: 'osm', value: 'osm' }
  ]
  const statusOptions = [
    { label: '待审', value: 'pending' },
    { label: '自动绑定', value: 'auto_bound' },
    { label: '已确认', value: 'confirmed' },
    { label: '已驳回', value: 'rejected' },
    { label: '已新建', value: 'ingested_new' }
  ]
  const ruleOptions = [
    { label: 'R1 同区县+名称全等', value: 'R1' },
    { label: 'R2 别名/曾用名', value: 'R2' },
    { label: 'R3 距离+相似度', value: 'R3' }
  ]

  const formItems = computed(() => [
    {
      label: '数据源',
      key: 'provider',
      type: 'select',
      props: { placeholder: '全部', options: providerOptions, clearable: true }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { placeholder: '全部', options: statusOptions, clearable: true }
    },
    {
      label: '命中规则',
      key: 'rule',
      type: 'select',
      props: { placeholder: '全部', options: ruleOptions, clearable: true }
    },
    {
      label: '源名称',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配源记录名',
      clearable: true
    },
    {
      label: '仅看无候选',
      key: 'onlyNoCandidate',
      type: 'select',
      props: {
        placeholder: '不限',
        options: [
          { label: '是（R4 待新建）', value: 'true' },
          { label: '否', value: 'false' }
        ],
        clearable: true
      }
    }
  ])

  function handleReset() {
    emit('reset')
  }

  async function handleSearch(params: any) {
    await searchBarRef.value.validate()
    // select 存的是字符串 'true'/'false'，转布尔再上抛
    if (params.onlyNoCandidate !== undefined) {
      params.onlyNoCandidate = params.onlyNoCandidate === 'true'
    }
    emit('search', params)
  }
</script>
