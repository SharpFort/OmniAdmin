/**
 * v-perm 按钮级权限指令（docs/1.前端对齐后端方案-修订版.md §2.6）
 *
 * 职责边界：v-perm = 按钮/操作级权限（后端权限码 api_code 体系）；
 * v-auth = 页面级（route.meta.authList），两者并存不互替。
 *
 * 用法：
 * ```vue
 * <el-button v-perm="'public:dept:create'">新增部门</el-button>
 * ```
 *
 * 无权限时从 DOM 移除元素（与 v-auth 行为一致）。
 * 判断为异步（首次拉取权限码缓存），挂载后完成判断。
 */
import type { App, Directive, DirectiveBinding } from 'vue'
import { usePermission } from '@/hooks/core/usePermission'

export type PermDirective = Directive<HTMLElement, string>

async function checkPerm(el: HTMLElement, binding: DirectiveBinding<string>): Promise<void> {
  const { hasPerm } = usePermission()
  const allowed = await hasPerm(binding.value)
  if (!allowed && el.parentNode) {
    el.parentNode.removeChild(el)
  }
}

const permDirective: PermDirective = {
  mounted: checkPerm,
  updated: checkPerm
}

export function setupPermDirective(app: App): void {
  app.directive('perm', permDirective)
}
