/**
 * CSV 导入 API（docs/1.前端对齐后端方案-修订版.md §2.2 import.ts）
 *
 * ⚠️ 待使用再决策：后端 import_csv（sys:import 仅超管；白名单 7 张业务表：
 * department/position/user_position/dict_type/dict_data/iam_menu/iam_api）已存在，
 * 但 OmniAdmin 尚未出现导入入口（如字典批量导入）——届时再封装，
 * 并确认前端是「CSV→JSON 数组」还是「直传 CSV 文本（需 omni_csv 扩展）」。
 *
 * 本文件仅为占位，不实现任何函数。
 */
export {}
