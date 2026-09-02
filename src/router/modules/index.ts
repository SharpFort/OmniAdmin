import type { AppRouteRecord } from '@/types/router'

/**
 * 自动注册所有路由模块
 *
 * 通过 import.meta.glob 扫描本目录（含子目录）下除 index.ts 外的所有 .ts 模块，
 * 收集其导出的路由记录（单个 AppRouteRecord 或 AppRouteRecord 数组均可），
 * 按文件路径排序保证注册顺序稳定。
 *
 * 新增业务模块只需在 modules/ 下（可建子目录，如 citywalk/route.ts）添加模块文件，
 * 无需修改本文件——下游 fork 业务代码因此与框架公共文件完全隔离。
 */
const moduleFiles = import.meta.glob<Record<string, unknown>>(['./**/*.ts', '!./index.ts'], {
  eager: true
})

function isRouteRecord(value: unknown): value is AppRouteRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof (value as AppRouteRecord).path === 'string'
  )
}

const collected: { file: string; routes: AppRouteRecord[] }[] = []

for (const [file, exports] of Object.entries(moduleFiles)) {
  const routes: AppRouteRecord[] = []
  for (const value of Object.values(exports)) {
    if (isRouteRecord(value)) {
      routes.push(value)
    } else if (Array.isArray(value)) {
      routes.push(...value.filter(isRouteRecord))
    }
  }
  if (routes.length > 0) {
    collected.push({ file, routes })
  }
}

collected.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))

/**
 * 导出所有模块化路由
 */
export const routeModules: AppRouteRecord[] = collected.flatMap((item) => item.routes)
