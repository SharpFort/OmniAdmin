<!-- 菜单新增/编辑弹窗（rpc_create_menu 含 p_is_visible / rpc_update_menu） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="type === 'add' ? '新增菜单' : '编辑菜单'"
    width="600px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="上级菜单" prop="parent_id">
        <el-tree-select
          v-model="form.parent_id"
          :data="parentOptions"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          check-strictly
          clearable
          placeholder="不选则为顶级菜单"
          class="w-full"
        />
      </ElFormItem>
      <ElFormItem label="菜单名称" prop="menu_name">
        <ElInput v-model="form.menu_name" placeholder="请输入菜单名称" clearable />
      </ElFormItem>
      <ElFormItem label="菜单类型" prop="menu_type">
        <ElSelect v-model="form.menu_type" class="w-full">
          <ElOption label="目录" value="directory" />
          <ElOption label="菜单" value="menu" />
          <ElOption label="按钮" value="button" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="form.menu_type !== 'button'" label="路由路径" prop="path">
        <ElInput v-model="form.path" placeholder="如 system/user（相对路径）" clearable />
      </ElFormItem>
      <ElFormItem v-if="form.menu_type === 'menu'" label="组件路径" prop="component">
        <ElInput v-model="form.component" placeholder="如 system/user/index" clearable />
      </ElFormItem>
      <ElFormItem v-if="form.menu_type !== 'directory'" label="权限标识" prop="perms">
        <ElInput v-model="form.perms" placeholder="如 sys:user:create" clearable />
      </ElFormItem>
      <ElFormItem label="图标" prop="icon">
        <ElInput v-model="form.icon" placeholder="如 ri:user-3-line" clearable />
      </ElFormItem>
      <ElFormItem label="排序" prop="order_num">
        <ElInputNumber v-model="form.order_num" :min="0" class="w-full" />
      </ElFormItem>
      <ElFormItem label="显示状态" prop="is_visible">
        <ElSwitch v-model="form.is_visible" active-text="显示" inactive-text="隐藏" />
      </ElFormItem>
      <ElFormItem v-if="type === 'edit'" label="启用状态" prop="is_active">
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
  import { createMenu, updateMenu } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    editData: (Api.Menu.MenuAdminNode & { children?: unknown[] }) | null
    menuTree: Array<Api.Menu.MenuAdminNode & { children?: unknown[] }>
  }
  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  const formRef = ref<FormInstance>()
  const saving = ref(false)

  const form = reactive({
    parent_id: null as string | null,
    menu_name: '',
    menu_type: 'menu' as 'directory' | 'menu' | 'button',
    path: '',
    component: '',
    perms: '',
    icon: '',
    order_num: 0,
    is_visible: true,
    is_active: true
  })

  const rules = reactive<FormRules>({
    menu_name: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
    menu_type: [{ required: true, message: '请选择菜单类型', trigger: 'change' }]
  })

  /** 上级菜单选项（过滤自身及子树，避免环） */
  const parentOptions = computed(() => {
    const editId = props.editData?.id
    const excluded = new Set<string>()
    if (editId) {
      const collect = (nodes: Array<Api.Menu.MenuAdminNode & { children?: unknown[] }>) => {
        nodes.forEach((node) => {
          excluded.add(node.id)
          if (node.children?.length) collect(node.children as typeof nodes)
        })
      }
      collect(props.menuTree.filter((node) => node.id === editId))
    }
    const mapNode = (node: Api.Menu.MenuAdminNode & { children?: unknown[] }): any => ({
      id: node.id,
      label: node.menu_name,
      children: node.children?.length
        ? (node.children as typeof props.menuTree)
            .filter((child) => !excluded.has(child.id))
            .map(mapNode)
        : undefined
    })
    return props.menuTree.filter((node) => !excluded.has(node.id)).map(mapNode)
  })

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      // 回显：编辑时全字段；新增子菜单时带 parent_id
      if (props.type === 'edit' && props.editData) {
        form.parent_id = props.editData.parent_id
        form.menu_name = props.editData.menu_name
        form.menu_type = props.editData.menu_type === 'link' ? 'menu' : props.editData.menu_type
        form.path = props.editData.path || ''
        form.component = props.editData.component || ''
        form.perms = props.editData.perms || ''
        form.icon = props.editData.icon || ''
        form.order_num = props.editData.order_num
        form.is_visible = props.editData.is_visible
        form.is_active = props.editData.is_active
      } else {
        form.parent_id = (props.editData?.parent_id as string | null) ?? null
        form.menu_name = ''
        form.menu_type = 'menu'
        form.path = ''
        form.component = ''
        form.perms = ''
        form.icon = ''
        form.order_num = 0
        form.is_visible = true
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
        await createMenu({
          p_menu_name: form.menu_name,
          p_parent_id: form.parent_id,
          p_menu_type: form.menu_type,
          p_perms: form.perms || null,
          p_path: form.path || null,
          p_component: form.component || null,
          p_icon: form.icon || null,
          p_order_num: form.order_num,
          p_is_visible: form.is_visible
        })
        ElMessage.success('创建成功')
      } else if (props.editData) {
        await updateMenu({
          p_id: props.editData.id,
          p_parent_id: form.parent_id,
          p_menu_name: form.menu_name,
          p_menu_type: form.menu_type,
          p_perms: form.perms || null,
          p_path: form.path || null,
          p_component: form.component || null,
          p_icon: form.icon || null,
          p_order_num: form.order_num,
          p_is_visible: form.is_visible,
          p_is_active: form.is_active
        })
        ElMessage.success('更新成功')
      }
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('保存菜单失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
