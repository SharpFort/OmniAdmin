<template>
  <ElDialog
    :title="dialogTitle"
    :model-value="visible"
    @update:model-value="handleCancel"
    width="600px"
    align-center
    class="menu-dialog"
    @closed="handleClosed"
  >
    <ElForm ref="formRef" v-model="form" :rules="rules" label-width="120px">
      <ElFormItem label="菜单类型" prop="type">
        <ElRadioGroup v-model="form.type" :disabled="isEdit">
          <ElRadioButton value="directory">目录</ElRadioButton>
          <ElRadioButton value="menu">菜单</ElRadioButton>
          <ElRadioButton value="button">按钮</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>

      <ElFormItem label="父级菜单" prop="parent_id" v-if="form.type !== 'directory' || isEdit">
        <ElSelect v-model="form.parent_id" placeholder="请选择父级菜单" clearable>
          <ElOption
            v-for="item in availableParents"
            :key="item.id"
            :value="item.id"
            :label="item.title || item.name"
          />
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="名称" prop="title">
        <ElInput v-model="form.title" placeholder="请输入菜单名称" />
      </ElFormItem>

      <ElFormItem label="标识" prop="name">
        <ElInput v-model="form.name" placeholder="请输入唯一标识" />
      </ElFormItem>

      <template v-if="form.type !== 'button'">
        <ElFormItem label="路径" prop="path">
          <ElInput v-model="form.path" placeholder="如：/system/user" />
        </ElFormItem>
        <ElFormItem label="组件" prop="component">
          <ElInput v-model="form.component" placeholder="如：system/user/index" />
        </ElFormItem>
        <ElFormItem label="图标" prop="icon">
          <ElInput v-model="form.icon" placeholder="如：ri:user-line" />
        </ElFormItem>
      </template>

      <ElFormItem label="权限标识" prop="permission_code">
        <ElInput v-model="form.permission_code" placeholder="如：system:user:list" />
      </ElFormItem>

      <ElFormItem label="排序" prop="sort_order">
        <ElInputNumber v-model="form.sort_order" :min="1" style="width: 100%" />
      </ElFormItem>

      <ElFormItem label="启用" prop="is_active">
        <ElSwitch v-model="form.is_active" />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <span class="dialog-footer">
        <ElButton @click="handleCancel">取 消</ElButton>
        <ElButton type="primary" @click="handleSubmit">确 定</ElButton>
      </span>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormRules, FormInstance } from 'element-plus'

  interface MenuFormData {
    id: string
    parent_id: string
    type: 'directory' | 'menu' | 'button'
    name: string
    path: string
    component: string
    title: string
    icon: string
    permission_code: string
    sort_order: number
    is_active: boolean
  }

  interface Props {
    visible: boolean
    editData?: Api.SystemManage.MenuTreeItem | any
    type?: 'add' | 'edit'
    menuTree?: Api.SystemManage.MenuTreeItem[]
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    visible: false,
    type: 'add',
    menuTree: () => []
  })

  const emit = defineEmits<Emits>()

  const formRef = ref<FormInstance>()
  const isEdit = computed(() => props.type === 'edit')

  const form = reactive<MenuFormData>({
    id: '',
    parent_id: '',
    type: 'menu',
    name: '',
    path: '',
    component: '',
    title: '',
    icon: '',
    permission_code: '',
    sort_order: 1,
    is_active: true
  })

  const rules = reactive<FormRules>({
    title: [
      { required: true, message: '请输入菜单名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
    ],
    name: [
      { required: true, message: '请输入唯一标识', trigger: 'blur' }
    ]
  })

  // 可用的父级菜单（排除当前菜单及其子菜单）
  const availableParents = computed(() => {
    const tree = props.menuTree || []
    const result: Api.SystemManage.MenuTreeItem[] = []
    
    const flatten = (nodes: Api.SystemManage.MenuTreeItem[]) => {
      nodes.forEach(node => {
        // 排除当前编辑的菜单
        if (node.id !== props.editData?.id) {
          result.push(node)
          if (node.children?.length) {
            flatten(node.children)
          }
        }
      })
    }
    
    flatten(tree)
    return result
  })

  const dialogTitle = computed(() => {
    const typeMap = { directory: '目录', menu: '菜单', button: '按钮' }
    return `${isEdit.value ? '编辑' : '新增'}${typeMap[form.type]}`
  })

  const resetForm = () => {
    formRef.value?.resetFields()
    form.type = 'menu'
    form.id = ''
    form.parent_id = ''
    form.name = ''
    form.path = ''
    form.component = ''
    form.title = ''
    form.icon = ''
    form.permission_code = ''
    form.sort_order = 1
    form.is_active = true
  }

  const loadFormData = () => {
    if (!props.editData) return
    const row = props.editData

    Object.assign(form, {
      id: row.id || '',
      parent_id: row.parent_id || '',
      type: row.type || 'menu',
      name: row.name || '',
      path: row.path || '',
      component: row.component || '',
      title: row.title || row.name || '',
      icon: row.icon || '',
      permission_code: row.permission_code || '',
      sort_order: row.sort_order || 1,
      is_active: row.is_active !== false
    })
  }

  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()
      // TODO: 调用接口保存数据
      ElMessage.success(`${isEdit.value ? '编辑' : '新增'}成功`)
      handleCancel()
      emit('submit')
    } catch {
      ElMessage.error('表单校验失败，请检查输入')
    }
  }

  const handleCancel = () => {
    emit('update:visible', false)
  }

  const handleClosed = () => {
    resetForm()
  }

  watch(
    () => props.visible,
    (newVal) => {
      if (newVal) {
        nextTick(() => {
          if (props.editData) {
            loadFormData()
          } else if (props.editData?.parent_id) {
            form.parent_id = props.editData.parent_id
          }
        })
      }
    }
  )
</script>
