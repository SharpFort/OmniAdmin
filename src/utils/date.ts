/**
 * 日期工具（搜索组件规范：时间范围约定）
 *
 * 约定（docs/搜索组件与分页跳转规范.md）：
 * - ArtSearchBar 的 daterange 使用 valueFormat 'YYYY-MM-DD'（date-only）
 * - API 层统一用 toIsoLocal 转换：date-only 的结束日期自动补 23:59:59
 *   （实现当天闭区间，左闭右闭），再转 ISO 8601（PostgREST timestamptz
 *   无歧义解析，避免浏览器/服务器时区偏差）
 */

/** 本地时间字符串 → ISO 8601（UTC）；date-only 时补时间（isEnd 补 23:59:59，否则补 00:00:00）
 *  ⚠️ 必须补时间后再 new Date：ISO date-only（"YYYY-MM-DD"）按 UTC 解析，
 *  与本地时区解析的结束时间混用会造成 8 小时偏移（UTC+8 环境漏掉凌晨段） */
export function toIsoLocal(value: string | null | undefined, isEnd = false): string | null {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value} ${isEnd ? '23:59:59' : '00:00:00'}`
    : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
