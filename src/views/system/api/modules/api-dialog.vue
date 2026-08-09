<!-- API 权限点新增/编辑弹窗（rpc_create_api 8 参 / rpc_update_api 9 参；043 写 RPC）
  清空语义：update 文本传 '' 清空、p_menu_id 传零 uuid 哨兵取消归属（NULL=不改）
  分组默认：create 时 p_api_group 留空 + 选了归属菜单 → 后端自动取 menu_name -->
<template>
  <ElDialog
    :model-value="visible"
    :title="type === 'add' ? '新增 API 权限点' : '编辑 API 权限点'"
    width="600px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="路径" prop="path">
        <ElInput v-model="form.path" placeholder="如 /rpc/search_users" clearable />
      </ElFormItem>
      <ElFormItem label="方法" prop="method">
        <ElSelect v-model="form.method" class="w-full">
          <ElOption v-for="m in METHOD_OPTIONS" :key="m" :label="m" :value="m" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="名称" prop="name">
        <ElInput v-model="form.name" placeholder="如 用户搜索" clearable />
      </ElFormItem>
      <ElFormItem label="权限编码" prop="api_code">
        <ElInput
          v-model="form.api_code"
          placeholder="如 sys:user:search（单码制：与按钮 perms 同码）"
          clearable
        />
      </ElFormItem>
      <ElFormItem label="描述" prop="description">
        <ElInput v-model="form.description" type="textarea" :rows="2" placeholder="可选" />
      </ElFormItem>
      <ElFormItem label="归属菜单" prop="menu_id">
        <el-tree-select
          v-model="form.menu_id"
          :data="menuTree"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          check-strictly
          clearable
          placeholder="不选则不归属任何菜单"
          class="w-full"
          @change="handleMenuChange"
        />
      </ElFormItem>
      <ElFormItem label="分组" prop="api_group">
        <ElInput
          v-model="form.api_group"
          placeholder="留空则默认取归属菜单名（可修改）"
          clearable
        />
      </ElFormItem>
      <ElFormItem label="状态" prop="is_active">
        <ElSwitch v-model="form.is_active" active-text="启用" inactive-text="禁用" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { createApi, updateApi } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    editData: Api.SystemManage.ApiAdminNode | null
    menuTree: Array<{ id: string; label: string; children?: unknown[] }>
  }
  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

  /** 043 清空归属哨兵：update 时 p_menu_id 传零 uuid 取消归属（NULL=不改） */
  const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

  const formRef = ref<FormInstance>()
  const saving = ref(false)

  const form = reactive({
    path: '',
    method: 'GET',
    name: '',
    api_code: '',
    description: '',
    menu_id: '' as string,
    api_group: '',
    is_active: true
  })

  const rules = reactive<FormRules>({
    path: [{ required: true, message: '请输入路径', trigger: 'blur' }],
    method: [{ required: true, message: '请选择方法', trigger: 'change' }],
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
  })

  /** 分组联动：选归属菜单后 api_group 留空时自动取菜单名（可改） */
  const handleMenuChange = (menuId: string | undefined) => {
    if (!menuId || form.api_group.trim()) return
    const findName = (
      nodes: Array<{ id: string; label: string; children?: unknown[] }>
    ): string | null => {
      for (const node of nodes) {
        if (node.id === menuId) return node.label
        if (node.children?.length) {
          const found = findName(node.children as typeof nodes)
          if (found) return found
        }
      }
      return null
    }
    const name = findName(props.menuTree)
    if (name) form.api_group = name
  }

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      if (props.type === 'edit' && props.editData) {
        form.path = props.editData.path || ''
        form.method = props.editData.method || 'GET'
        form.name = props.editData.name || ''
        form.api_code = props.editData.api_code || ''
        form.description = props.editData.description || ''
        form.menu_id = props.editData.menu_id || ''
        form.api_group = props.editData.api_group || ''
        form.is_active = props.editData.is_active
      } else {
        form.path = ''
        form.method = 'GET'
        form.name = ''
        form.api_code = ''
        form.description = ''
        form.menu_id = ''
        form.api_group = ''
        form.is_active = true
      }
      formRef.value?.clearValidate()
    }
  )

  const handleSave = async () => {
    if (!formRef.value) return
    try {
      await formRef.value.validate()
    } catch {
      return
    }
    saving.value = true
    try {
      if (props.type === 'add') {
        await createApi({
          p_path: form.path.trim(),
          p_method: form.method.trim(),
          p_name: form.name.trim(),
          p_api_code: form.api_code.trim() || null,
          p_description: form.description.trim() || null,
          p_is_active: form.is_active,
          p_menu_id: form.menu_id || null,
          // 留空 → 后端自动取归属菜单名
          p_api_group: form.api_group.trim() || null
        })
        ElMessage.success('创建成功')
      } else if (props.editData) {
        await updateApi({
          p_id: props.editData.id,
          p_path: form.path.trim(),
          p_method: form.method.trim(),
          p_name: form.name.trim(),
          // 文本传 '' 清空（NULL=不改）；menu_id 无值传零 uuid 哨兵取消归属
          p_api_code: form.api_code.trim(),
          p_description: form.description.trim(),
          p_is_active: form.is_active,
          p_menu_id: form.menu_id || ZERO_UUID,
          p_api_group: form.api_group.trim()
        })
        ElMessage.success('更新成功')
      }
      emit('update:visible', false)
      emit('submit')
    } catch (error: any) {
      console.error('保存 API 失败:', error)
      ElMessage.error(
        `保存失败：${error?.message || '请检查输入（path+method 或 api_code 是否重复）'}`
      )
    } finally {
      saving.value = false
    }
  }
</script>
