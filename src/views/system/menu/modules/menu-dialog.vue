<!-- 菜单资源弹窗（046 分工：API 数据在 API 管理页维护，菜单页按钮通过"选择"绑定已有接口——
  多选绑定选择器 + rpc_set_menu_apis 全量对齐；借鉴 sharpfort-net-vue menu-dialog 交互） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="dialogTitle"
    width="640px"
    align-center
    class="el-dialog-border"
    @update:model-value="emit('update:visible', $event)"
  >
    <!-- 角色授权提示条（sharpfort 同款：新按钮/接口需去角色管理授权） -->
    <div class="role-hint-banner">
      <div class="hint-icon-wrapper">
        <svg viewBox="0 0 24 24" fill="none" class="hint-icon">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M12 16v-4M12 8h.01"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <span class="hint-text">
        新建/修改的菜单、按钮与接口绑定，请去
        <button type="button" class="hint-link" @click="goToRole">角色管理</button>
        页面授权，否则用户看不到对应功能
      </span>
    </div>

    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="上级菜单" prop="parent_id">
        <ElTreeSelect
          v-model="form.parent_id"
          :data="parentOptions"
          :props="{ label: 'menu_name', children: 'children', disabled: 'disabled' }"
          node-key="id"
          check-strictly
          clearable
          :render-after-expand="false"
          placeholder="不选则为顶级菜单"
          class="w-full"
        />
      </ElFormItem>

      <ElRow :gutter="20">
        <ElCol :span="12">
          <ElFormItem label="菜单名称" prop="menu_name">
            <ElInput v-model.trim="form.menu_name" placeholder="请输入菜单名称" clearable />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="菜单类型" prop="menu_type">
            <ElSelect v-model="form.menu_type" class="w-full">
              <ElOption label="目录" value="directory" />
              <ElOption label="菜单" value="menu" />
              <ElOption label="按钮" value="button" />
              <ElOption label="外链" value="link" />
            </ElSelect>
          </ElFormItem>
        </ElCol>

        <ElCol :span="12" v-if="form.menu_type !== 'button'">
          <ElFormItem label="菜单图标" prop="icon">
            <ElPopover trigger="click" width="400">
              <template #reference>
                <ElInput v-model.trim="form.icon" placeholder="点击选择图标" clearable>
                  <template #prefix>
                    <ArtSvgIcon v-if="form.icon" :icon="form.icon" />
                  </template>
                </ElInput>
              </template>
              <div class="icon-grid">
                <div
                  v-for="icon in iconList"
                  :key="icon"
                  class="icon-item"
                  :class="{ active: form.icon === icon }"
                  @click="form.icon = icon"
                >
                  <ArtSvgIcon :icon="icon" :size="20" />
                </div>
              </div>
            </ElPopover>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="排序" prop="order_num">
            <ElInputNumber
              v-model="form.order_num"
              :min="0"
              class="w-full"
              controls-position="right"
            />
          </ElFormItem>
        </ElCol>

        <ElCol :span="12" v-if="form.menu_type !== 'button'">
          <ElFormItem label="路由地址" prop="router">
            <ElInput
              v-model.trim="form.router"
              :placeholder="
                form.menu_type === 'link'
                  ? 'http(s):// 开头的完整外链地址'
                  : '如 system/user（相对路径）'
              "
              clearable
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12" v-if="form.menu_type === 'menu'">
          <ElFormItem label="组件路径" prop="component">
            <ElInput v-model.trim="form.component" placeholder="如 system/user/index" clearable />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12" v-if="form.menu_type === 'menu'">
          <ElFormItem label="路由名称" prop="route_name">
            <ElInput
              v-model.trim="form.route_name"
              placeholder="Vue Router name（如 SystemUser）"
              clearable
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12" v-if="form.menu_type === 'directory'">
          <ElFormItem label="重定向" prop="redirect">
            <ElInput v-model.trim="form.redirect" placeholder="noRedirect 不自动跳转" clearable />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12" v-if="form.menu_type === 'menu'">
          <ElFormItem label="路由参数" prop="query">
            <ElInput v-model.trim="form.query" placeholder="如 tab=1" clearable />
          </ElFormItem>
        </ElCol>

        <ElCol :span="12">
          <ElFormItem label="权限码" prop="api_code">
            <ElInput
              v-model.trim="form.api_code"
              placeholder="如 sys:user:delete"
              clearable
              @blur="handleApiCodeBlur"
            />
          </ElFormItem>
          <div v-if="form.menu_type === 'button'" class="text-xs opacity-60">
            按钮权限码必填（单码制：建议与接口权限码同码）
          </div>
        </ElCol>

        <ElCol :span="24" v-if="form.menu_type !== 'button'">
          <ElFormItem label="菜单配置">
            <ElSpace wrap>
              <ElCheckbox v-model="form.is_visible" label="显示" />
              <ElCheckbox v-model="form.keep_alive" label="缓存" />
              <ElCheckbox
                v-model="form.is_link"
                label="外链"
                :disabled="form.menu_type === 'link'"
              />
              <ElCheckbox v-model="form.is_iframe" label="iframe" />
            </ElSpace>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="备注" prop="remark">
            <ElInput
              v-model.trim="form.remark"
              type="textarea"
              :rows="2"
              placeholder="备注说明（可选）"
            />
          </ElFormItem>
        </ElCol>

        <!-- ↓↓↓ 按钮节点：绑定接口（选择已有接口，不重复输入；046 分工） ↓↓↓ -->
        <ElCol v-if="form.menu_type === 'button'" :span="24">
          <ElDivider content-position="left">
            <span class="api-section-title">绑定接口（1:N，从 API 管理页已建接口中选择）</span>
          </ElDivider>
          <ElFormItem label="已绑定接口">
            <ElSelect
              v-model="form.bound_api_ids"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              :max-collapse-tags="3"
              placeholder="选择接口（可多选；未选中的将解除绑定）"
              class="w-full"
            >
              <ElOption
                v-for="api in bindableApis"
                :key="api.id"
                :label="`${api.method} ${api.path}${api.name ? ' — ' + api.name : ''}`"
                :value="api.id"
              />
            </ElSelect>
            <div class="text-xs opacity-60 mt-1">
              选项 = 未绑定接口 + 当前已绑定；接口数据在
              <button type="button" class="hint-link" @click="goToApiPage">API 管理</button>
              页面维护（新建/编辑/删除）
            </div>
          </ElFormItem>
        </ElCol>

        <ElCol v-if="type === 'edit'" :span="12">
          <ElFormItem label="启用状态" prop="is_active">
            <ElSwitch v-model="form.is_active" active-text="启用" inactive-text="禁用" />
          </ElFormItem>
        </ElCol>
      </ElRow>
    </ElForm>

    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { createMenu, updateMenu, setMenuApis, getApiList } from '@/api/system-manage'
  import { getView } from '@/api/request'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  /** 资源节点（与 index.vue 同构） */
  type ResourceNode = {
    id: string
    kind: 'menu' | 'api'
    menu_type?: Api.Common.MenuType
    parent_id: string | null
    menu_id: string | null
    menu_name: string
    api_code: string | null
    router: string | null
    path: string | null
    method: string | null
    component: string | null
    icon: string | null
    order_num: number
    is_visible: boolean
    is_active: boolean
    api_group: string | null
    description: string | null
    remark: string | null
    route_name: string | null
    query: string | null
    is_link: boolean
    is_iframe: boolean
    redirect: string | null
    keep_alive: boolean
    disabled?: boolean
    children?: ResourceNode[]
  }

  const router = useRouter()
  const goToRole = () => router.push({ name: 'Role' })
  const goToApiPage = () => router.push({ name: 'Api' })

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    node: ResourceNode | { parentId: string | null; defaultKind: 'menu' | 'button' } | null
    tree: ResourceNode[]
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }
  const props = withDefaults(defineProps<Props>(), {
    visible: false,
    type: 'add',
    node: null,
    tree: () => []
  })
  const emit = defineEmits<Emits>()

  const formRef = ref<FormInstance>()
  const saving = ref(false)

  const dialogTitle = computed(() => (props.type === 'edit' ? '编辑菜单' : '新增菜单'))

  const form = reactive({
    parent_id: null as string | null,
    menu_name: '',
    menu_type: 'menu' as 'directory' | 'menu' | 'button' | 'link',
    icon: '',
    order_num: 0,
    router: '',
    route_name: '',
    query: '',
    component: '',
    redirect: '',
    is_link: false,
    is_iframe: false,
    keep_alive: true,
    api_code: '',
    remark: '',
    is_visible: true,
    is_active: true,
    // 绑定接口（仅按钮）
    bound_api_ids: [] as string[]
  })

  const rules = reactive<FormRules>({
    menu_name: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
    menu_type: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
    router: [
      {
        validator: (_rule, value: string, callback) => {
          if (form.menu_type === 'button') return callback()
          if (!value || !value.trim()) {
            return callback(
              new Error(form.menu_type === 'link' ? '外链必须填写完整地址' : '请输入路由地址')
            )
          }
          if (form.menu_type === 'link' && !/^https?:\/\//.test(value.trim())) {
            return callback(new Error('外链地址必须以 http:// 或 https:// 开头'))
          }
          callback()
        },
        trigger: 'blur'
      }
    ],
    api_code: [
      {
        validator: (_rule, value: string, callback) => {
          // 040 单码制：button 必填
          if (form.menu_type === 'button' && (!value || !value.trim())) {
            return callback(new Error('按钮类型必须填写权限码'))
          }
          callback()
        },
        trigger: 'blur'
      }
    ]
  })

  /** 040 软提示：录入的权限码未在 iam_api.api_code 中找到时提示（仅提示不阻断） */
  const apiCodeSet = ref<Set<string>>(new Set())
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
  const handleApiCodeBlur = (): void => {
    const code = form.api_code?.trim()
    if (!code) return
    if (!apiCodeSet.value.has(code)) {
      ElMessage.warning(
        `权限码「${code}」未在权限点（iam_api.api_code）中找到，建议先建权限点再配按钮（单码制对齐）`
      )
    }
  }

  /** 上级选项（过滤自身及子树，避免环；接口节点 disabled 不可选） */
  const parentOptions = computed(() => {
    const editId = props.type === 'edit' ? (props.node as ResourceNode)?.id : null
    const excluded = new Set<string>()
    if (editId) {
      const collect = (nodes: ResourceNode[]) => {
        nodes.forEach((node) => {
          excluded.add(node.id)
          if (node.children?.length) collect(node.children)
        })
      }
      collect(props.tree.filter((node) => node.id === editId))
    }
    const mapNode = (node: ResourceNode): any => ({
      id: node.id,
      menu_name: node.menu_name,
      disabled: node.kind === 'api',
      children: node.children?.filter((child) => !excluded.has(child.id)).map(mapNode)
    })
    return props.tree.filter((node) => !excluded.has(node.id)).map(mapNode)
  })

  /** 绑定选择器选项池：未绑定接口 + 当前按钮已绑（弹窗打开时拉取全量 iam_api） */
  const apiPool = ref<Api.SystemManage.ApiAdminNode[]>([])
  const bindableApis = computed(() => {
    const boundIds = new Set(form.bound_api_ids)
    return apiPool.value.filter((a) => a.menu_id == null || boundIds.has(a.id))
  })
  const loadApiPool = async (): Promise<void> => {
    try {
      const result = await getApiList({ limit: 1000, offset: 0 })
      apiPool.value = result.items
    } catch (error) {
      console.warn('拉取接口池失败（绑定选择器不可用）:', error)
      apiPool.value = []
    }
  }

  /** 类型联动：link → 自动 is_link、清空 component；改离 link 放开 is_link */
  watch(
    () => form.menu_type,
    (val) => {
      if (val === 'link') {
        form.is_link = true
        form.component = ''
      } else if (props.type === 'edit' && (props.node as ResourceNode)?.menu_type === 'link') {
        form.is_link = false
      }
    }
  )

  watch(
    () => props.visible,
    (val) => {
      if (!val) return
      const node = props.node as ResourceNode | null
      const ctx = props.node as { parentId: string | null; defaultKind: 'menu' | 'button' } | null

      // 重置
      Object.assign(form, {
        parent_id: null,
        menu_name: '',
        menu_type: 'menu',
        icon: '',
        order_num: 0,
        router: '',
        route_name: '',
        query: '',
        component: '',
        redirect: '',
        is_link: false,
        is_iframe: false,
        keep_alive: true,
        api_code: '',
        remark: '',
        is_visible: true,
        is_active: true,
        bound_api_ids: []
      })

      if (props.type === 'add') {
        form.parent_id = ctx?.parentId ?? null
        if (ctx?.defaultKind) form.menu_type = ctx.defaultKind
      } else if (node) {
        form.parent_id = node.parent_id
        form.menu_name = node.menu_name
        form.menu_type = node.menu_type || 'menu'
        form.icon = node.icon || ''
        form.order_num = node.order_num
        form.router = node.router || ''
        form.route_name = node.route_name || ''
        form.query = node.query || ''
        form.component = node.component || ''
        form.redirect = node.redirect || ''
        form.is_link = node.is_link
        form.is_iframe = node.is_iframe
        form.keep_alive = node.keep_alive
        form.api_code = node.api_code || ''
        form.remark = node.remark || ''
        form.is_visible = node.is_visible
        form.is_active = node.is_active
        // 已绑定接口（按钮下挂载的接口叶子）
        form.bound_api_ids = (node.children || []).filter((c) => c.kind === 'api').map((c) => c.id)
      }
      formRef.value?.clearValidate()
      loadApiCodes()
      loadApiPool()
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
      const node = props.node as ResourceNode | null
      const menuParams = {
        p_menu_name: form.menu_name,
        p_parent_id: form.parent_id,
        p_menu_type: form.menu_type,
        p_api_code: form.api_code.trim() || null,
        p_router: form.router.trim() || null,
        p_component: form.component.trim() || null,
        p_icon: form.icon.trim() || null,
        p_order_num: form.order_num,
        p_is_visible: form.is_visible,
        p_remark: form.remark.trim() || null,
        p_route_name: form.route_name.trim() || null,
        p_query: form.query.trim() || null,
        p_is_link: form.is_link,
        p_is_iframe: form.is_iframe,
        p_redirect: form.redirect.trim() || null,
        p_keep_alive: form.keep_alive
      }

      if (props.type === 'add') {
        const res = await createMenu(menuParams)
        // 按钮：绑定选中接口（rpc_set_menu_apis 全量对齐）
        if (form.menu_type === 'button' && form.bound_api_ids.length && res.id) {
          await setMenuApis({ p_menu_id: res.id, p_api_ids: form.bound_api_ids })
        }
      } else if (node) {
        await updateMenu({ ...menuParams, p_id: node.id, p_is_active: form.is_active })
        // 按钮：绑定全量对齐（未选中的解绑回池）
        if (form.menu_type === 'button') {
          await setMenuApis({ p_menu_id: node.id, p_api_ids: form.bound_api_ids })
        }
      }
      ElMessage.success(props.type === 'add' ? '创建成功' : '更新成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error: any) {
      console.error('保存失败:', error)
      ElMessage.error(`保存失败：${error?.message || '请检查输入（权限码是否重复）'}`)
    } finally {
      saving.value = false
    }
  }

  // 图标列表（sharpfort 同款）
  const iconList = [
    'ri:home-line',
    'ri:user-line',
    'ri:settings-line',
    'ri:file-list-line',
    'ri:folder-line',
    'ri:dashboard-line',
    'ri:bar-chart-line',
    'ri:pie-chart-line',
    'ri:database-line',
    'ri:server-line',
    'ri:code-s-slash-line',
    'ri:terminal-box-line',
    'ri:shield-user-line',
    'ri:lock-line',
    'ri:key-line',
    'ri:menu-line',
    'ri:layout-line',
    'ri:pages-line',
    'ri:article-line',
    'ri:file-text-line',
    'ri:inbox-line',
    'ri:mail-line',
    'ri:notification-line',
    'ri:message-line',
    'ri:question-line',
    'ri:information-line',
    'ri:error-warning-line',
    'ri:checkbox-circle-line',
    'ri:close-circle-line',
    'ri:add-circle-line',
    'ri:indeterminate-circle-line',
    'ri:star-line'
  ]
</script>

<style scoped>
  .role-hint-banner {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 16px;
    margin-bottom: 20px;
    font-size: 13px;
    line-height: 1.7;
    color: #475569;
    background: linear-gradient(135deg, #f0f7ff 0%, #faf5ff 100%);
    border-left: 3px solid #7c3aed;
    border-radius: 0 8px 8px 0;
    box-shadow: 0 1px 3px rgb(124 58 237 / 8%);
  }

  .hint-icon-wrapper {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    color: #7c3aed;
  }

  .hint-icon {
    width: 20px;
    height: 20px;
  }

  .hint-text {
    flex: 1;
  }

  .hint-link {
    display: inline;
    padding: 0;
    margin: 0 2px;
    font-size: 13px;
    font-weight: 600;
    color: #7c3aed;
    text-decoration: underline;
    text-decoration-color: #c4b5fd;
    text-underline-offset: 2px;
    cursor: pointer;
    background: none;
    border: none;
  }

  .hint-link:hover {
    color: #6d28d9;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .icon-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    cursor: pointer;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
  }

  .icon-item.active {
    border-color: #409eff;
  }

  .api-section-title {
    font-size: 13px;
    color: #606266;
  }
</style>
