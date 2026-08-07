import type { App } from 'vue'
import { setupAuthDirective, type AuthDirective } from './core/auth'
import { setupPermDirective, type PermDirective } from './core/perm'
import { setupHighlightDirective, type HighlightDirective } from './business/highlight'
import { setupRippleDirective, type RippleDirective } from './business/ripple'
import { setupRolesDirective, type RolesDirective } from './core/roles'

export function setupGlobDirectives(app: App) {
  setupAuthDirective(app) // 权限指令（页面级 authList）
  setupPermDirective(app) // 权限指令（按钮级后端权限码）
  setupRolesDirective(app) // 角色权限指令
  setupHighlightDirective(app) // 高亮指令
  setupRippleDirective(app) // 水波纹指令
}

export type { AuthDirective, HighlightDirective, PermDirective, RippleDirective, RolesDirective }
