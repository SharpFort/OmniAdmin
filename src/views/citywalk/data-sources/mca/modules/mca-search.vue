<!-- MCA 镜像搜索栏（名称模糊 / 省份 / 是否含来历文本 / 仅看未绑定） -->
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
  import { getPlaceNamesByProvince } from '@/api/citywalk'

  interface Props {
    modelValue: {
      keyword: string
      province: string
      hasDetail: boolean
      onlyUnbound: boolean
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

  // 省份下拉（按省分布视图动态加载）
  const provinceOptions = ref<Array<{ label: string; value: string }>>([])

  onMounted(async () => {
    try {
      const rows = await getPlaceNamesByProvince()
      provinceOptions.value = rows
        .filter((r) => r.province_name)
        .map((r) => ({ label: r.province_name as string, value: r.province_name as string }))
    } catch (error) {
      console.warn('加载省份下拉失败:', error)
      provinceOptions.value = []
    }
  })

  const boolOptions = [
    { label: '是', value: 'true' },
    { label: '否', value: 'false' }
  ]

  const formItems = computed(() => [
    {
      label: '标准地名',
      key: 'keyword',
      type: 'input',
      placeholder: '模糊匹配，如 颐和园',
      clearable: true
    },
    {
      label: '省份',
      key: 'province',
      type: 'select',
      props: {
        placeholder: '全部',
        options: provinceOptions.value,
        clearable: true,
        filterable: true
      }
    },
    {
      label: '含来历文本',
      key: 'hasDetail',
      type: 'select',
      props: { placeholder: '不限', options: boolOptions, clearable: true }
    },
    {
      label: '仅看未绑定',
      key: 'onlyUnbound',
      type: 'select',
      props: { placeholder: '不限', options: boolOptions, clearable: true }
    }
  ])

  function handleReset() {
    emit('reset')
  }

  async function handleSearch(params: any) {
    await searchBarRef.value.validate()
    // select 存字符串 'true'/'false'，转布尔再上抛
    for (const key of ['hasDetail', 'onlyUnbound']) {
      if (params[key] !== undefined) {
        params[key] = params[key] === 'true'
      }
    }
    emit('search', params)
  }
</script>
