import { AppRouteRecord } from '@/types/router'

/**
 * 系统管理路由（frontend 模式本地路由全量）
 *
 * roles 对齐后端 PG 角色（init/02-schemas.sql）：role_super_admin / tenant_admin
 * 可见性矩阵（docs/1.前端对齐后端方案-修订版.md §2.5 tenant_admin 按钮矩阵）：
 * - login-log 仅超管（public:login-log:list 仅超管绑定）
 * - menu/api/role：tenant_admin 只读（页面可见、按钮经 v-perm 全隐藏）
 * - 其余页面两角色可见；按钮级权限由 Phase 6 v-perm（后端权限码）控制
 */
export const systemRoutes: AppRouteRecord = {
  path: '/system',
  name: 'System',
  component: '/index/index',
  meta: {
    title: 'menus.system.title',
    icon: 'ri:user-3-line',
    roles: ['role_super_admin', 'tenant_admin']
  },
  children: [
    {
      path: 'user',
      name: 'User',
      component: '/system/user',
      meta: {
        title: 'menus.system.user',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'role',
      name: 'Role',
      component: '/system/role',
      meta: {
        title: 'menus.system.role',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'user-center',
      name: 'UserCenter',
      component: '/system/user-center',
      meta: {
        title: 'menus.system.userCenter',
        isHide: true,
        keepAlive: true,
        isHideTab: true
      }
    },
    {
      path: 'menu',
      name: 'Menus',
      component: '/system/menu',
      meta: {
        title: 'menus.system.menu',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'dept',
      name: 'Dept',
      component: '/system/dept',
      meta: {
        title: 'menus.system.dept',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'position',
      name: 'Position',
      component: '/system/position',
      meta: {
        title: 'menus.system.position',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'user-position',
      name: 'UserPosition',
      component: '/system/user-position',
      meta: {
        title: 'menus.system.userPosition',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'dict',
      name: 'Dict',
      component: '/system/dict',
      meta: {
        title: 'menus.system.dict',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'dict-data',
      name: 'DictData',
      component: '/system/dict-data',
      meta: {
        title: 'menus.system.dictData',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'tenant',
      name: 'Tenant',
      component: '/system/tenant',
      meta: {
        title: 'menus.system.tenant',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'user-tenant',
      name: 'UserTenant',
      component: '/system/user-tenant',
      meta: {
        title: 'menus.system.userTenant',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'user-role',
      name: 'UserRole',
      component: '/system/user-role',
      meta: {
        title: 'menus.system.userRole',
        keepAlive: true,
        // v_user_roles 仅超管完整（034 有意不授 authenticated）——租户管理员不显示该菜单
        roles: ['role_super_admin']
      }
    },
    {
      path: 'login-log',
      name: 'LoginLog',
      component: '/system/login-log',
      meta: {
        title: 'menus.system.loginLog',
        keepAlive: true,
        roles: ['role_super_admin']
      }
    },
    {
      path: 'audit-log',
      name: 'AuditLog',
      component: '/system/audit-log',
      meta: {
        title: 'menus.system.auditLog',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'monitor',
      name: 'Monitor',
      component: '/system/monitor',
      meta: {
        title: 'menus.system.monitor',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      // config_admin 视图含 password.* 等敏感配置 → 页面仅超管可见（public:config:write 仅超管绑定）
      path: 'app-config',
      name: 'AppConfig',
      component: '/system/app-config',
      meta: {
        title: 'menus.system.appConfig',
        keepAlive: true,
        roles: ['role_super_admin']
      }
    },
    {
      path: 'cron-job-log',
      name: 'CronJobLog',
      component: '/system/cron-job-log',
      meta: {
        title: 'menus.system.cronJobLog',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    }
  ]
}
