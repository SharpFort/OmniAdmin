<!-- 登录日志搜索栏（ArtSearchBar 声明式配置，与 user/role/audit-log 页 *-search.vue 同构）
  两行布局：span=8（每行 3 项）+ is-expand（全部显示，无收起按钮） -->
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
  import { getUserList } from '@/api/system-manage'

  interface Props {
    modelValue: {
      user_id: string
      result: string
      login_type: string
      region: string
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

  // 用户下拉（v_user_list，仅取前 100）
  const userOptions = ref<Array<{ label: string; value: string }>>([])

  onMounted(async () => {
    try {
      const result = await getUserList({ limit: 100, offset: 0 })
      userOptions.value = result.items.map((user) => ({
        label: user.username || user.id,
        value: user.id
      }))
    } catch (error) {
      console.warn('加载用户下拉失败:', error)
      userOptions.value = []
    }
  })

  const resultOptions = [
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failure' }
  ]

  const formItems = computed(() => [
    {
      label: '用户',
      key: 'user_id',
      type: 'select',
      props: {
        placeholder: '请选择用户',
        options: userOptions.value,
        filterable: true,
        clearable: true
      }
    },
    {
      label: '结果',
      key: 'result',
      type: 'select',
      props: {
        placeholder: '请选择结果',
        options: resultOptions,
        clearable: true
      }
    },
    {
      label: '登录方式',
      key: 'login_type',
      type: 'input',
      placeholder: '模糊匹配，如 password / unknown',
      clearable: true
    },
    {
      label: '地区',
      key: 'region',
      type: 'input',
      placeholder: '模糊匹配，如 广东 / 中国',
      clearable: true
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
