<!-- 用户租户搜索栏（ArtSearchBar 声明式配置，与 user/tenant/role 页 *-search.vue 同构） -->
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
  import { listTenants } from '@/api/tenant'

  interface Props {
    modelValue: {
      query: string
      tenant_id: string
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

  // 租户选项（rpc_list_tenants；value=租户 id，过滤 v_user_role_detail.tenant_id）
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])

  onMounted(async () => {
    try {
      const result = await listTenants({ limit: 1000 })
      tenantOptions.value = result.items.map((item) => ({ label: item.name, value: item.id }))
    } catch (error) {
      console.warn('加载租户选项失败:', error)
      tenantOptions.value = []
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
      label: '租户',
      key: 'tenant_id',
      type: 'select',
      props: {
        placeholder: '请选择租户',
        options: tenantOptions.value,
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
