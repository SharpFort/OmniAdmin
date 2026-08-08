/**
 * 菜单处理器
 *
 * 负责菜单数据的获取、过滤和处理
 *
 * @module router/core/MenuProcessor
 * @author Art Design Pro Team
 */

import type { AppRouteRecord } from '@/types/router'
import { useUserStore } from '@/store/modules/user'
import { useAppMode } from '@/hooks/core/useAppMode'
import { getUserMenu } from '@/api/system-manage'
import { asyncRoutes } from '../routes/asyncRoutes'
import { RoutesAlias } from '../routesAlias'
import { formatMenuTitle } from '@/utils'

/** §2.4 component 兜底映射表（get_user_menu.component 为空时按 path 最后一段映射） */
const COMPONENT_FALLBACK_MAP: Record<string, string> = {
  user: '/system/user',
  role: '/system/role',
  menu: '/system/menu',
  api: '/system/api',
  dept: '/system/dept',
  position: '/system/position',
  dict: '/system/dict',
  tenant: '/system/tenant',
  'user-tenant': '/system/user-tenant',
  'user-role': '/system/user-role',
  'login-log': '/system/login-log',
  'audit-log': '/system/audit-log',
  monitor: '/system/monitor'
}

export class MenuProcessor {
  /**
   * 获取菜单数据
   */
  async getMenuList(): Promise<AppRouteRecord[]> {
    const { isFrontendMode } = useAppMode()

    let menuList: AppRouteRecord[]
    if (isFrontendMode.value) {
      menuList = await this.processFrontendMenu()
    } else {
      menuList = await this.processBackendMenu()
    }

    // 在规范化路径之前，验证原始路径配置
    this.validateMenuPaths(menuList)

    // 规范化路径（将相对路径转换为完整路径）
    return this.normalizeMenuPaths(menuList)
  }

  /**
   * 处理前端控制模式的菜单
   */
  private async processFrontendMenu(): Promise<AppRouteRecord[]> {
    const userStore = useUserStore()
    const roles = userStore.info?.roles

    let menuList = [...asyncRoutes]

    // 根据角色过滤菜单
    if (roles && roles.length > 0) {
      menuList = this.filterMenuByRoles(menuList, roles)
    }

    return this.filterEmptyMenus(menuList)
  }

  /**
   * 处理后端控制模式的菜单（§2.4；VITE_ACCESS_MODE=backend 时启用）
   *
   * 数据源：get_user_menu（035 起含 menu_type/perms/is_visible/component）
   * - 扁平列表 → 树：两遍构建（先建全量节点 Map 再统一挂载，不假设「父先于子」；
   *   后端已按 order_num 全局排序，数组顺序即层级内顺序）
   * - component 直用后端值（规范化前导斜杠/去掉尾部 /index）+ 映射表兜底
   * - menu_type=button 过滤（按钮项是权限标记，不注册路由）
   * - menu_type=link / path 为 URL → meta.link 外链处理（不 addRoute）
   * - is_visible=false → meta.isHide（注册但不显示在菜单栏，URL 可直达）
   * - 空树/调用失败 → fallback 本地 asyncRoutes
   */
  private async processBackendMenu(): Promise<AppRouteRecord[]> {
    let items: Api.Menu.MenuRouteItem[]
    try {
      items = await getUserMenu()
    } catch (error) {
      console.warn('[MenuProcessor] get_user_menu 获取失败，回退本地 asyncRoutes:', error)
      items = []
    }

    if (!Array.isArray(items) || items.length === 0) {
      return this.fallbackToLocalRoutes()
    }

    // 1. 过滤 button 类型（权限标记不入路由）
    const routeItems = items.filter((item) => item.menu_type !== 'button')

    // 2. 两遍构建：先全量节点 Map，再统一挂载（子节点可能先于父节点出现）
    const nodeMap = new Map<
      string,
      Api.Menu.MenuRouteItem & { children?: Api.Menu.MenuRouteItem[] }
    >()
    routeItems.forEach((item) => {
      nodeMap.set(item.id, { ...item })
    })

    const roots: Array<Api.Menu.MenuRouteItem & { children?: Api.Menu.MenuRouteItem[] }> = []
    routeItems.forEach((item) => {
      if (item.parent_id && nodeMap.has(item.parent_id)) {
        const parent = nodeMap.get(item.parent_id)!
        parent.children = parent.children || []
        parent.children.push(item)
      } else {
        roots.push(item)
      }
    })

    return this.filterEmptyMenus(this.convertMenuTreeToRoutes(roots))
  }

  /** 空树/失败回退：本地 asyncRoutes（按角色过滤） */
  private fallbackToLocalRoutes(): AppRouteRecord[] {
    const userStore = useUserStore()
    const roles = userStore.info?.roles
    let menuList = [...asyncRoutes]
    if (roles && roles.length > 0) {
      menuList = this.filterMenuByRoles(menuList, roles)
    }
    return this.filterEmptyMenus(menuList)
  }

  /** 规范化后端 component 值（'system/user/index' → '/system/user'）；空值走兜底映射表 */
  private normalizeComponent(component: string | null, path: string | null): string | undefined {
    if (component && component.trim()) {
      const trimmed = component.trim()
      const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
      return normalized.replace(/\/index$/, '')
    }
    if (!path) return undefined
    const lastSegment = path.split('/').filter(Boolean).pop() || ''
    return COMPONENT_FALLBACK_MAP[lastSegment]
  }

  private convertMenuTreeToRoutes(
    items: Array<Api.Menu.MenuRouteItem & { children?: Api.Menu.MenuRouteItem[] }>
  ): AppRouteRecord[] {
    return items.map((item) => {
      const isExternalLink = item.menu_type === 'link' || /^https?:\/\//.test(item.path || '')

      return {
        path: item.path || item.name,
        name: item.name,
        component: isExternalLink ? undefined : this.normalizeComponent(item.component, item.path),
        meta: {
          title: item.meta?.title || item.name,
          icon: item.meta?.icon || undefined,
          link: isExternalLink ? item.path || undefined : undefined,
          isHide: item.is_visible === false,
          isHideTab: false,
          keepAlive: false
        },
        children: item.children?.length ? this.convertMenuTreeToRoutes(item.children) : undefined
      }
    })
  }

  /**
   * 根据角色过滤菜单
   */
  private filterMenuByRoles(menu: AppRouteRecord[], roles: string[]): AppRouteRecord[] {
    return menu.reduce((acc: AppRouteRecord[], item) => {
      const itemRoles = item.meta?.roles
      const hasPermission = !itemRoles || itemRoles.some((role) => roles?.includes(role))

      if (hasPermission) {
        const filteredItem = { ...item }
        if (filteredItem.children?.length) {
          filteredItem.children = this.filterMenuByRoles(filteredItem.children, roles)
        }
        acc.push(filteredItem)
      }

      return acc
    }, [])
  }

  /**
   * 递归过滤空菜单项
   */
  private filterEmptyMenus(menuList: AppRouteRecord[]): AppRouteRecord[] {
    return menuList
      .map((item) => {
        // 如果有子菜单，先递归过滤子菜单
        if (item.children && item.children.length > 0) {
          const filteredChildren = this.filterEmptyMenus(item.children)
          return {
            ...item,
            children: filteredChildren
          }
        }
        return item
      })
      .filter((item) => {
        // 如果定义了 children 属性（即使是空数组），说明这是一个目录菜单，应该保留
        if ('children' in item) {
          return true
        }

        // 如果有外链或 iframe，保留
        if (item.meta?.isIframe === true || item.meta?.link) {
          return true
        }

        // 如果有有效的 component，保留
        if (item.component && item.component !== '' && item.component !== RoutesAlias.Layout) {
          return true
        }

        // 其他情况过滤掉
        return false
      })
  }

  /**
   * 验证菜单列表是否有效
   */
  validateMenuList(menuList: AppRouteRecord[]): boolean {
    return Array.isArray(menuList) && menuList.length > 0
  }

  /**
   * 规范化菜单路径
   * 将相对路径转换为完整路径，确保菜单跳转正确
   */
  private normalizeMenuPaths(menuList: AppRouteRecord[], parentPath = ''): AppRouteRecord[] {
    return menuList.map((item) => {
      // 构建完整路径
      const fullPath = this.buildFullPath(item.path || '', parentPath)

      // 递归处理子菜单
      const children = item.children?.length
        ? this.normalizeMenuPaths(item.children, fullPath)
        : item.children

      const redirect = item.redirect || this.resolveDefaultRedirect(children)

      return {
        ...item,
        path: fullPath,
        redirect,
        children
      }
    })
  }

  /**
   * 为目录型菜单推导默认跳转地址
   */
  private resolveDefaultRedirect(children?: AppRouteRecord[]): string | undefined {
    if (!children?.length) {
      return undefined
    }

    for (const child of children) {
      if (this.isNavigableRoute(child)) {
        return child.path
      }

      const nestedRedirect = this.resolveDefaultRedirect(child.children)
      if (nestedRedirect) {
        return nestedRedirect
      }
    }

    return undefined
  }

  /**
   * 判断子路由是否可以作为默认落点
   */
  private isNavigableRoute(route: AppRouteRecord): boolean {
    return Boolean(
      route.path &&
      route.path !== '/' &&
      !route.meta?.link &&
      route.meta?.isIframe !== true &&
      route.component &&
      route.component !== ''
    )
  }

  /**
   * 验证菜单路径配置
   * 检测非一级菜单是否错误使用了 / 开头的路径
   */
  /**
   * 验证菜单路径配置
   * 检测非一级菜单是否错误使用了 / 开头的路径
   */
  private validateMenuPaths(menuList: AppRouteRecord[], level = 1): void {
    menuList.forEach((route) => {
      if (!route.children?.length) return

      const parentName = String(route.name || route.path || '未知路由')

      route.children.forEach((child) => {
        const childPath = child.path || ''

        // 跳过合法的绝对路径：外部链接和 iframe 路由
        if (this.isValidAbsolutePath(childPath)) return

        // 检测非法的绝对路径
        if (childPath.startsWith('/')) {
          this.logPathError(child, childPath, parentName, level)
        }
      })

      // 递归检查更深层级的子路由
      this.validateMenuPaths(route.children, level + 1)
    })
  }

  /**
   * 判断是否为合法的绝对路径
   */
  private isValidAbsolutePath(path: string): boolean {
    return (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('/outside/iframe/')
    )
  }

  /**
   * 输出路径配置错误日志
   */
  private logPathError(
    route: AppRouteRecord,
    path: string,
    parentName: string,
    level: number
  ): void {
    const routeName = String(route.name || path || '未知路由')
    const menuTitle = route.meta?.title || routeName
    const suggestedPath = path.split('/').pop() || path.slice(1)

    console.error(
      `[路由配置错误] 菜单 "${formatMenuTitle(menuTitle)}" (name: ${routeName}, path: ${path}) 配置错误\n` +
        `  位置: ${parentName} > ${routeName}\n` +
        `  问题: ${level + 1}级菜单的 path 不能以 / 开头\n` +
        `  当前配置: path: '${path}'\n` +
        `  应该改为: path: '${suggestedPath}'`
    )
  }

  /**
   * 构建完整路径
   */
  private buildFullPath(path: string, parentPath: string): string {
    if (!path) return ''

    // 外部链接直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // 如果已经是绝对路径，直接返回
    if (path.startsWith('/')) {
      return path
    }

    // 拼接父路径和当前路径
    if (parentPath) {
      // 移除父路径末尾的斜杠，移除子路径开头的斜杠，然后拼接
      const cleanParent = parentPath.replace(/\/$/, '')
      const cleanChild = path.replace(/^\//, '')
      return `${cleanParent}/${cleanChild}`
    }

    // 没有父路径，添加前导斜杠
    return `/${path}`
  }
}
