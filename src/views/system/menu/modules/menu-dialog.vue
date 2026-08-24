<!-- 菜单资源弹窗（055 单表化重写：端点信息直接内嵌按钮行编辑——api_url/api_method 成对，
  SharpFort 单表模型；按钮行导航字段禁用/清空对齐 D8；删除 046 绑定接口选择器与 040 软校验——
  权限点=按钮行自身（一码多端点合法，重复码不再提示）） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="dialogTitle"
    width="960px"
    align-center
    class="el-dialog-border"
    @update:model-value="emit('update:visible', $event)"
  >
    <!-- 角色授权提示条（sharpfort 同款：新按钮/菜单需去角色管理授权） -->
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
        新建/修改的菜单与按钮，请去
        <button type="button" class="hint-link" @click="goToRole">角色管理</button>
        页面勾选授权，否则用户看不到对应功能
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

        <!-- ↓↓↓ 按钮节点：端点信息直接编辑（055 单表化——端点内嵌按钮行，成对必填 D6） ↓↓↓ -->
        <ElCol :span="12" v-if="form.menu_type === 'button'">
          <ElFormItem label="接口路径" prop="api_url">
            <ElInput
              v-model.trim="form.api_url"
              placeholder="如 /rpc/rpc_create_department"
              clearable
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12" v-if="form.menu_type === 'button'">
          <ElFormItem label="接口方法" prop="api_method">
            <ElSelect v-model="form.api_method" class="w-full" clearable placeholder="选择方法">
              <ElOption label="GET" value="GET" />
              <ElOption label="POST" value="POST" />
              <ElOption label="PUT" value="PUT" />
              <ElOption label="PATCH" value="PATCH" />
              <ElOption label="DELETE" value="DELETE" />
              <ElOption label="HEAD" value="HEAD" />
              <ElOption label="OPTIONS" value="OPTIONS" />
              <ElOption label="*（全部）" value="*" />
            </ElSelect>
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
        <ElCol :span="12">
          <ElFormItem label="权限码" prop="api_code">
            <ElInput v-model.trim="form.api_code" placeholder="如 platform:user:list" clearable />
          </ElFormItem>
          <div v-if="form.menu_type === 'button'" class="text-xs opacity-60">
            按钮权限码必填（单码制；一码多端点 = 多个按钮行同码）
          </div>
        </ElCol>

        <ElCol :span="24" v-if="form.menu_type !== 'button'">
          <ElFormItem label="菜单配置">
            <div class="config-panel">
              <ElCheckbox v-model="form.is_visible" label="显示" />
              <!-- 低频配置收进折叠区（缓存/外链/iframe/固定标签） -->
              <ElCollapse class="more-config">
                <ElCollapseItem title="更多配置" name="more">
                  <ElSpace wrap>
                    <ElCheckbox v-model="form.is_cache" label="缓存" />
                    <ElCheckbox
                      v-model="form.is_link"
                      label="外链"
                      :disabled="form.menu_type === 'link'"
                    />
                    <ElCheckbox v-model="form.is_iframe" label="iframe" />
                    <ElCheckbox v-model="form.is_affix" label="固定标签" />
                  </ElSpace>
                </ElCollapseItem>
              </ElCollapse>
            </div>
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
  import { createMenu, updateMenu } from '@/api/system-manage'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  /** 菜单节点（iam_menu 全列；055 单表化后无接口叶子） */
  type ResourceNode = {
    id: string
    menu_type?: Api.Common.MenuType
    parent_id: string | null
    menu_name: string
    api_code: string | null
    router: string | null
    component: string | null
    icon: string | null
    order_num: number
    is_visible: boolean
    is_active: boolean
    remark: string | null
    route_name: string | null
    is_link: boolean
    is_iframe: boolean
    redirect: string | null
    is_cache: boolean
    api_url: string | null
    api_method: string | null
    is_affix: boolean
    disabled?: boolean
    children?: ResourceNode[]
  }

  const router = useRouter()
  const goToRole = () => router.push({ name: 'Role' })

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
    component: '',
    redirect: '',
    is_link: false,
    is_iframe: false,
    is_cache: true,
    is_affix: false,
    api_code: '',
    api_url: '',
    api_method: '',
    remark: '',
    is_visible: true,
    is_active: true
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
    ],
    api_url: [
      {
        validator: (_rule, value: string, callback) => {
          // 055 D6：接口路径/方法成对（表级 CHECK 兜底，前端友好报错）
          if (form.menu_type === 'button' && value?.trim() && !form.api_method) {
            return callback(new Error('填写接口路径后必须选择接口方法'))
          }
          callback()
        },
        trigger: 'blur'
      }
    ]
  })

  /** 上级选项（过滤自身及子树，避免环） */
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
      disabled: node.menu_type === 'button',
      children: node.children?.filter((child) => !excluded.has(child.id)).map(mapNode)
    })
    return props.tree.filter((node) => !excluded.has(node.id)).map(mapNode)
  })

  /** 类型联动（055 对齐 D8/D6）：
   *  button → 清空导航字段（router/component/redirect/route_name），端点成对校验；
   *  改离 button → 清空端点字段（权限字段归属按最终类型） */
  watch(
    () => form.menu_type,
    (val) => {
      if (val === 'link') {
        form.is_link = true
        form.component = ''
      } else if (val === 'button') {
        form.router = ''
        form.component = ''
        form.redirect = ''
        form.route_name = ''
      } else if (props.type === 'edit' && (props.node as ResourceNode)?.menu_type === 'link') {
        form.is_link = false
      }
      if (val !== 'button') {
        form.api_url = ''
        form.api_method = ''
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
        component: '',
        redirect: '',
        is_link: false,
        is_iframe: false,
        is_cache: true,
        is_affix: false,
        api_code: '',
        api_url: '',
        api_method: '',
        remark: '',
        is_visible: true,
        is_active: true
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
        form.component = node.component || ''
        form.redirect = node.redirect || ''
        form.is_link = node.is_link
        form.is_iframe = node.is_iframe
        form.is_cache = node.is_cache
        form.is_affix = node.is_affix
        form.api_code = node.api_code || ''
        form.api_url = node.api_url || ''
        form.api_method = node.api_method || ''
        form.remark = node.remark || ''
        form.is_visible = node.is_visible
        form.is_active = node.is_active
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
      const node = props.node as ResourceNode | null
      const menuParams = {
        p_menu_name: form.menu_name,
        p_parent_id: form.parent_id,
        p_menu_type: form.menu_type,
        p_api_code: form.menu_type === 'button' ? form.api_code.trim() || null : null,
        p_router: form.menu_type === 'button' ? null : form.router.trim() || null,
        p_component: form.menu_type === 'button' ? null : form.component.trim() || null,
        p_icon: form.icon.trim() || null,
        p_order_num: form.order_num,
        p_is_visible: form.is_visible,
        p_remark: form.remark.trim() || null,
        p_route_name: form.menu_type === 'button' ? null : form.route_name.trim() || null,
        p_is_link: form.is_link,
        p_is_iframe: form.is_iframe,
        p_redirect: form.menu_type === 'button' ? null : form.redirect.trim() || null,
        p_is_cache: form.is_cache,
        // 055：端点仅按钮行（成对 D6）
        p_api_url: form.menu_type === 'button' ? form.api_url.trim() || null : null,
        p_api_method: form.menu_type === 'button' ? form.api_method || null : null,
        p_is_affix: form.is_affix
      }

      if (props.type === 'add') {
        await createMenu(menuParams)
      } else if (node) {
        await updateMenu({ ...menuParams, p_id: node.id, p_is_active: form.is_active })
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

  /* 菜单配置：显示复选框 + 更多配置折叠区（低频配置收起） */
  .config-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .more-config {
    border: none;

    --el-collapse-header-height: 32px;
  }

  .more-config :deep(.el-collapse-item__header) {
    font-size: 13px;
    color: #64748b;
    border-bottom: none;
  }

  .more-config :deep(.el-collapse-item__wrap) {
    border-bottom: none;
  }

  .more-config :deep(.el-collapse-item__content) {
    padding-bottom: 4px;
  }
</style>
