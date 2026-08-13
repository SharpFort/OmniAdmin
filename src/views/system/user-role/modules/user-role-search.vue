<!-- 用户角色搜索栏（ArtSearchBar 声明式配置，与 user/tenant/role 页 *-search.vue 同构） -->
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
  import { getRoleList } from '@/api/system-manage'

  interface Props {
    modelValue: {
      query: string
      role_code: string
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

  // 角色选项（v_role_list；label=角色名（编码），value=角色编码）
  const roleOptions = ref<Array<{ label: string; value: string }>>([])

  onMounted(async () => {
    try {
      const result = await getRoleList({ limit: 1000 })
      roleOptions.value = result.items.map((item) => ({
        label: `${item.role_name}（${item.role_code}）`,
        value: item.role_code
      }))
    } catch (error) {
      console.warn('加载角色选项失败:', error)
      roleOptions.value = []
    }
  })

  const formItems = computed(() => [
    {
      label: '用户名',
      key: 'query',
      type: 'input',
      placeholder: '按用户名过滤',
      clearable: true
    },
    {
      label: '角色',
      key: 'role_code',
      type: 'select',
      props: {
        placeholder: '请选择角色',
        options: roleOptions.value,
        filterable: true,
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
