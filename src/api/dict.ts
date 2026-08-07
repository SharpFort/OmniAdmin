/**
 * 字典管理 API（docs/1.前端对齐后端方案-修订版.md §2.2 dict.ts）
 *
 * - v_dict_list：类型+数据项聚合（items 为 json 数组）
 * - dict_type / dict_data：视图查询（分页）
 * - 6 个 CRUD RPC（sys:dict:create/update/delete；全局字典仅超管）
 */
import { postRpc, getViewPage } from './request'

/** 字典类型+数据项聚合（v_dict_list，分页） */
export function getDictList(params: { query?: string; limit?: number; offset?: number } = {}) {
  const filters: Record<string, string> = {}
  if (params.query) filters['dict_name'] = `ilike.*${params.query}*`
  return getViewPage<Api.SystemManage.DictListItem>('v_dict_list', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    filters
  })
}

/** 字典类型列表（dict_type 视图，分页） */
export function getDictTypes(params: { query?: string; limit?: number; offset?: number } = {}) {
  const filters: Record<string, string> = {}
  if (params.query) filters['dict_name'] = `ilike.*${params.query}*`
  return getViewPage<Api.SystemManage.DictType>('dict_type', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'sort_no.asc',
    filters
  })
}

/** 字典数据项列表（dict_data 视图，分页；按 dict_name 过滤） */
export function getDictDataList(
  params: {
    dictName?: string
    limit?: number
    offset?: number
  } = {}
) {
  const filters: Record<string, string> = {}
  if (params.dictName) filters['dict_name'] = `eq.${params.dictName}`
  return getViewPage<Api.SystemManage.DictData>('dict_data', {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    order: 'sort_no.asc',
    filters
  })
}

/** 创建字典类型（rpc_create_dict_type；sys:dict:create） */
export function createDictType(params: {
  p_dict_name: string
  p_dict_label: string
  p_tenant_scoped?: boolean
  p_sort_no?: number
}) {
  return postRpc<Api.Common.ApiOk>('rpc_create_dict_type', {
    p_dict_name: params.p_dict_name,
    p_dict_label: params.p_dict_label,
    p_tenant_scoped: params.p_tenant_scoped ?? false,
    p_sort_no: params.p_sort_no ?? 0
  })
}

/** 更新字典类型（rpc_update_dict_type；sys:dict:update） */
export function updateDictType(params: {
  p_id: string
  p_dict_label?: string | null
  p_sort_no?: number | null
  p_status?: boolean | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_update_dict_type', {
    p_id: params.p_id,
    p_dict_label: params.p_dict_label ?? null,
    p_sort_no: params.p_sort_no ?? null,
    p_status: params.p_status ?? null
  })
}

/** 删除字典类型（rpc_delete_dict_type；sys:dict:delete；级联清理数据项） */
export function deleteDictType(dictTypeId: string) {
  return postRpc<Api.Common.ApiOk>('rpc_delete_dict_type', { p_id: dictTypeId })
}

/** 创建字典数据项（rpc_create_dict_data；sys:dict:create） */
export function createDictData(params: {
  p_dict_name: string
  p_item_label: string
  p_item_value: string
  p_item_type?: string
  p_is_default?: boolean
  p_sort_no?: number
}) {
  return postRpc<Api.Common.ApiOk>('rpc_create_dict_data', {
    p_dict_name: params.p_dict_name,
    p_item_label: params.p_item_label,
    p_item_value: params.p_item_value,
    p_item_type: params.p_item_type ?? 'string',
    p_is_default: params.p_is_default ?? false,
    p_sort_no: params.p_sort_no ?? 0
  })
}

/** 更新字典数据项（rpc_update_dict_data；sys:dict:update） */
export function updateDictData(params: {
  p_id: string
  p_item_label?: string | null
  p_item_value?: string | null
  p_item_type?: string | null
  p_is_default?: boolean | null
  p_sort_no?: number | null
  p_status?: boolean | null
}) {
  return postRpc<Api.Common.ApiOk>('rpc_update_dict_data', {
    p_id: params.p_id,
    p_item_label: params.p_item_label ?? null,
    p_item_value: params.p_item_value ?? null,
    p_item_type: params.p_item_type ?? null,
    p_is_default: params.p_is_default ?? null,
    p_sort_no: params.p_sort_no ?? null,
    p_status: params.p_status ?? null
  })
}

/** 删除字典数据项（rpc_delete_dict_data；sys:dict:delete） */
export function deleteDictData(dictDataId: string) {
  return postRpc<Api.Common.ApiOk>('rpc_delete_dict_data', { p_id: dictDataId })
}
