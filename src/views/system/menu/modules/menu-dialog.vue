<!-- 菜单新增/编辑弹窗（rpc_create_menu 16 参 / rpc_update_menu 18 参；038 导航元字段 + 040 单码制） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="type === 'add' ? '新增菜单' : '编辑菜单'"
    width="640px"
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
          <ElOption label="外链" value="link" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="form.menu_type !== 'button'" label="路由路径" prop="path">
        <ElInput
          v-model="form.path"
          :placeholder="
            form.menu_type === 'link'
              ? 'http(s):// 开头的完整外链地址'
              : '如 system/user（相对路径）'
          "
          clearable
        />
      </ElFormItem>
      <ElFormItem v-if="form.menu_type === 'menu'" label="组件路径" prop="component">
        <ElInput v-model="form.component" placeholder="如 system/user/index" clearable />
      </ElFormItem>
      <ElFormItem v-if="form.menu_type !== 'directory'" label="权限标识" prop="perms">
        <ElInput
          v-model="form.perms"
          placeholder="如 sys:user:create"
          clearable
          @blur="handlePermsBlur"
        />
        <div v-if="form.menu_type === 'button'" class="text-xs opacity-60">
          按钮权限标识必填（单码制：与 iam_api.api_code 同码）
        </div>
      </ElFormItem>
      <ElFormItem label="图标" prop="icon">
        <ElInput v-model="form.icon" placeholder="如 ri:user-3-line" clearable />
      </ElFormItem>
      <ElFormItem label="排序" prop="order_num">
        <ElInputNumber v-model="form.order_num" :min="0" class="w-full" />
      </ElFormItem>
      <!-- ↓↓↓ 038 导航元字段 ↓↓↓ -->
      <ElFormItem label="路由名称" prop="route_name">
        <ElInput
          v-model="form.route_name"
          placeholder="Vue Router name（如 SystemUser）"
          clearable
        />
      </ElFormItem>
      <ElFormItem label="路由参数" prop="query">
        <ElInput v-model="form.query" placeholder="如 tab=1（拼进路由 path 的 query）" clearable />
      </ElFormItem>
      <ElFormItem v-if="form.menu_type === 'directory'" label="重定向路径" prop="redirect">
        <ElInput
          v-model="form.redirect"
          placeholder="目录默认跳转子路径；填 noRedirect 不自动跳转"
          clearable
        />
      </ElFormItem>
      <ElFormItem label="是否外链" prop="is_link">
        <ElSwitch
          v-model="form.is_link"
          :disabled="form.menu_type === 'link'"
          active-text="是"
          inactive-text="否"
        />
        <span v-if="form.menu_type === 'link'" class="text-xs opacity-60">外链类型自动勾选</span>
      </ElFormItem>
      <ElFormItem label="是否 iframe" prop="is_iframe">
        <ElSwitch v-model="form.is_iframe" active-text="是" inactive-text="否" />
      </ElFormItem>
      <ElFormItem label="页面缓存" prop="keep_alive">
        <ElSwitch v-model="form.keep_alive" active-text="缓存" inactive-text="不缓存" />
      </ElFormItem>
      <ElFormItem label="备注" prop="remark">
        <ElInput v-model="form.remark" type="textarea" :rows="2" placeholder="备注说明（可选）" />
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
  import { getView } from '@/api/request'
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

  /** 040 单码制软提示数据源：iam_api.api_code 全量集合（进入弹窗时拉取一次） */
  const apiCodeSet = ref<Set<string>>(new Set())

  const form = reactive({
    parent_id: null as string | null,
    menu_name: '',
    menu_type: 'menu' as 'directory' | 'menu' | 'button' | 'link',
    path: '',
    component: '',
    perms: '',
    icon: '',
    order_num: 0,
    // ↓↓↓ 038 新增 ↓↓↓
    remark: '',
    route_name: '',
    query: '',
    is_link: false,
    is_iframe: false,
    redirect: '',
    keep_alive: true,
    is_visible: true,
    is_active: true
  })

  const rules = reactive<FormRules>({
    menu_name: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
    menu_type: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
    path: [
      {
        validator: (_rule, value: string, callback) => {
          if (form.menu_type === 'button') return callback()
          if (!value || !value.trim()) {
            return callback(
              new Error(form.menu_type === 'link' ? '外链必须填写完整地址' : '请输入路由路径')
            )
          }
          // 038 link 类型：后端 CHECK 约束要求 http(s):// 开头（违反报 23514）
          if (form.menu_type === 'link' && !/^https?:\/\//.test(value.trim())) {
            return callback(new Error('外链地址必须以 http:// 或 https:// 开头'))
          }
          callback()
        },
        trigger: 'blur'
      }
    ],
    perms: [
      {
        validator: (_rule, value: string, callback) => {
          // 040 button 类型 perms 必填（后端违反报 22023 button menu requires perms）
          if (form.menu_type === 'button' && (!value || !value.trim())) {
            return callback(new Error('按钮类型必须填写权限标识'))
          }
          callback()
        },
        trigger: 'blur'
      }
    ]
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

  /** 038 link 类型联动：选中外链 → 自动勾选 is_link、清空 component；改离 link 放开 is_link */
  watch(
    () => form.menu_type,
    (val) => {
      if (val === 'link') {
        form.is_link = true
        form.component = ''
        // else-if 分支中 val 已被收窄为非 link，仅需判断编辑前类型
      } else if (props.type === 'edit' && props.editData?.menu_type === 'link') {
        // 改离 link：显式放开外链开关（后端需 p_is_link=false）
        form.is_link = false
      }
    }
  )

  /** 拉取 iam_api.api_code 集合（040 单码制软提示） */
  const loadApiCodes = async (): Promise<void> => {
    try {
      const rows = await getView<{ api_code: string | null }>('iam_api', {
        select: 'api_code',
        limit: 1000
      })
      apiCodeSet.value = new Set(rows.map((r) => r.api_code).filter((c): c is string => !!c))
    } catch (error) {
      console.warn('拉取权限点列表失败（软提示不可用）:', error)
    }
  }

  /** 040 perms 软提示：录入的 perms 与 iam_api.api_code 无对应时提示（仅提示不阻断） */
  const handlePermsBlur = (): void => {
    const perms = form.perms?.trim()
    if (!perms) return
    if (!apiCodeSet.value.has(perms)) {
      ElMessage.warning(
        `权限标识「${perms}」未在权限点（iam_api.api_code）中找到，建议先建权限点再配按钮（单码制对齐）`
      )
    }
  }

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      // 回显：编辑时全字段；新增子菜单时带 parent_id
      if (props.type === 'edit' && props.editData) {
        form.parent_id = props.editData.parent_id
        form.menu_name = props.editData.menu_name
        form.menu_type = props.editData.menu_type
        form.path = props.editData.path || ''
        form.component = props.editData.component || ''
        form.perms = props.editData.perms || ''
        form.icon = props.editData.icon || ''
        form.order_num = props.editData.order_num
        // ↓↓↓ 038 回显 ↓↓↓
        form.remark = props.editData.remark || ''
        form.route_name = props.editData.route_name || ''
        form.query = props.editData.query || ''
        form.is_link = props.editData.is_link
        form.is_iframe = props.editData.is_iframe
        form.redirect = props.editData.redirect || ''
        form.keep_alive = props.editData.keep_alive
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
        form.remark = ''
        form.route_name = ''
        form.query = ''
        form.is_link = false
        form.is_iframe = false
        form.redirect = ''
        form.keep_alive = true
        form.is_visible = true
        form.is_active = true
      }
      formRef.value?.clearValidate()
      loadApiCodes()
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
          p_is_visible: form.is_visible,
          // ↓↓↓ 038 透传 ↓↓↓
          p_remark: form.remark || null,
          p_route_name: form.route_name || null,
          p_query: form.query || null,
          p_is_link: form.is_link,
          p_is_iframe: form.is_iframe,
          p_redirect: form.redirect || null,
          p_keep_alive: form.keep_alive
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
          p_is_active: form.is_active,
          // ↓↓↓ 038 透传（改离 link 时 p_is_link 显式 false）↓↓↓
          p_remark: form.remark || null,
          p_route_name: form.route_name || null,
          p_query: form.query || null,
          p_is_link: form.is_link,
          p_is_iframe: form.is_iframe,
          p_redirect: form.redirect || null,
          p_keep_alive: form.keep_alive
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
