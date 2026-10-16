/**
 * citywalk 业务域 API 类型定义（schema: api_v1_content_places）
 *
 * 规范（对齐 api.d.ts / docs/1.前端对齐后端方案-修订版.md §2.3）：
 * - snake_case 透传（零转换层）：字段与后端 PostgREST 返回一一对应
 * - 时间字段约定 string（ISO 8601，展示时格式化）
 * - 后端源：citywalk 仓库 db/src/content_places + api_v1/content_places（2026-10-16）
 */
declare namespace Api {
  namespace Citywalk {
    // ------------------------------------------------------------------
    // 景点管理（v_pois_admin，admin 端全状态）
    // ------------------------------------------------------------------
    interface Place {
      id: string
      slug: string | null
      name: string | null
      category_id: string | null
      district_id: number | null
      parent_place_id: string | null
      latitude: number | null
      longitude: number | null
      entity_id: string | null
      slug_published: string | null
      status: 'Published' | 'PendingReview' | 'Archived' | null
      source_language_code: string | null
      cover_image_url: string | null
      created_at: string
      updated_at: string
    }

    // ------------------------------------------------------------------
    // 匹配复审队列（v_match_queue_admin）
    // ------------------------------------------------------------------
    /** 规则命中证据（detail JSONB；R2/R3 为可空维度） */
    interface MatchDetail {
      source_name?: string
      place_name?: string
      district_code?: string
      r2_matched_on?: string
      r3_distance_m?: number
      r3_similarity?: number
      [key: string]: unknown
    }

    type MatchStatus = 'pending' | 'auto_bound' | 'confirmed' | 'rejected' | 'ingested_new'
    type MatchProvider = 'osm' | 'mca'

    interface MatchQueueRow {
      queue_id: string
      provider: MatchProvider
      external_key: string
      status: MatchStatus
      rules_hit: string[]
      detail: MatchDetail | null
      remark: string | null
      candidate_place_id: string | null
      candidate_place_name: string | null
      candidate_place_status: string | null
      candidate_place_district_id: number | null
      source_name: string | null
      osm_class: string | null
      osm_value: string | null
      /** mca 源证据（osm 源为 null） */
      source_old_name: string | null
      source_place_type: string | null
      source_district_name: string | null
      created_at: string
      updated_at: string
    }

    /** run_source_matching 返回统计 */
    interface RunMatchingResult {
      provider: MatchProvider
      total: number
      skipped: number
      auto_bound: number
      pending: number
      no_match: number
    }

    /** 复审批量动作返回 */
    interface BulkActionResult {
      requested: number
      confirmed?: number
      rejected?: number
      ingested?: number
      failed: Array<{ queue_id: string; error: string }>
    }

    /** 单条复审动作返回 */
    interface MatchActionResult {
      queue_id: string
      status: string
      place_id?: string
      place_status?: string
      binding_removed?: boolean
      provider?: string
      external_key?: string
    }

    // ------------------------------------------------------------------
    // MCA 地名镜像（v_place_names_admin / v_place_names_stats / v_place_names_by_province）
    // ------------------------------------------------------------------
    interface PlaceName {
      id: string
      place_code: string
      standard_name: string
      old_name: string | null
      roman_alphabet_spelling: string | null
      province_name: string | null
      province_code: string | null
      city_name: string | null
      city_code: string | null
      district_name: string | null
      district_code: string | null
      place_type: string | null
      place_type_code: string | null
      longitude: number | null
      latitude: number | null
      place_origin: string | null
      place_meaning: string | null
      place_history: string | null
      match_keyword: string | null
      collected_at: string | null
      detail_collected_at: string | null
      source_file: string | null
      imported_at: string
      already_bound: boolean
      has_open_match: boolean
    }

    interface PlaceNamesStats {
      total: number
      with_origin: number
      with_meaning: number
      with_history: number
      with_coords: number
      with_old_name: number
      province_count: number
      district_count: number
      place_type_count: number
      last_imported_at: string | null
      first_imported_at: string | null
      last_source_file: string | null
    }

    interface PlaceNamesByProvince {
      province_name: string | null
      province_code: string | null
      total: number
      with_origin: number
      with_coords: number
      district_count: number
    }

    // ------------------------------------------------------------------
    // 主数据（masterdata：标签 / 分类）
    // ------------------------------------------------------------------
    interface Tag {
      id: string
      slug: string
      language_code: string | null
      type_source: string | null
      tag_type: string | null
      status: string | null
      parent_id: string | null
      merged_to_tag_id: string | null
      entity_version: number | null
      display_name: string
      display_description: string
      created_at: string
      updated_at: string
    }

    interface Category {
      id: string
      standard_id: string
      standard_name: string
      parent_id: string | null
      level: number
      full_code: string
      name: string
      content: string | null
      remark: string | null
      slug: string | null
      created_at: string
      updated_at: string
      /** 前端构建树用（非后端字段） */
      children?: Category[]
    }

    // ------------------------------------------------------------------
    // 反馈工单（content_feedback）
    // ------------------------------------------------------------------
    interface Ticket {
      id: string
      ticket_no: string | null
      title: string | null
      ticket_type: string | null
      status: string | null
      priority: string | null
      submitter_user_id: string | null
      assignee_id: string | null
      target_id: string | null
      target_type: string | null
      created_at: string
      updated_at: string
    }

    interface PoiUpdateRequest {
      id: string
      content_feedback_ticket_id: string
      poi_id: string
      poi_name: string | null
      poi_status: string | null
      field_name: string
      old_value: string | null
      new_value: string
      status: 'Pending' | 'Approved' | 'Rejected'
      auditor_id: string | null
      reviewed_at: string | null
      created_at: string
      ticket_no: string | null
      ticket_title: string | null
      ticket_type: string | null
      ticket_status: string | null
      ticket_priority: string | null
    }

    // ------------------------------------------------------------------
    // 评论与举报（content_comment）
    // ------------------------------------------------------------------
    interface Comment {
      id: string
      entity_type: string | null
      entity_id: string | null
      user_id: string | null
      content: string | null
      parent_id: string | null
      root_id: string | null
      depth: number | null
      like_count: number | null
      reply_count: number | null
      status: string | null
      is_top: boolean | null
      is_reported: boolean | null
      created_at: string
      updated_at: string
    }

    interface ReviewReport {
      id: string
      target_type: string | null
      target_id: string | null
      reporter_id: string | null
      reason_type: string | null
      description: string | null
      status: string | null
      handler_id: string | null
      handled_at: string | null
      handler_remark: string | null
      created_at: string
    }

    // ------------------------------------------------------------------
    // 评价（content_reaction）
    // ------------------------------------------------------------------
    interface Review {
      id: string
      entity_type: string | null
      entity_id: string | null
      user_id: string | null
      overall_score: number | null
      title: string | null
      content: string | null
      is_recommended: boolean | null
      helpful_count: number | null
      unhelpful_count: number | null
      reply_count: number | null
      like_count: number | null
      dislike_count: number | null
      share_count: number | null
      status: string | null
      is_anonymous: boolean | null
      is_top: boolean | null
      trust_score: number | null
      created_at: string
      updated_at: string
    }

    // ------------------------------------------------------------------
    // 内容审核（moderation）
    // ------------------------------------------------------------------
    interface ModerationQueueItem {
      content_id: string
      target_id: string | null
      target_type: string | null
      submitter_user_id: string | null
      initial_audit_type: string | null
      risk_level: string | null
      submitted_at: string
      assignment_id: string | null
      assignee_id: string | null
      priority: string | null
      due_time: string | null
      assignment_status: string | null
      waiting_hours: number | null
      is_overdue: boolean | null
    }

    interface RiskDashboardRow {
      review_date: string
      target_type: string | null
      risk_level: string | null
      total_count: number
      approved_count: number
      rejected_count: number
      pending_count: number
      avg_review_hours: number | null
      ai_auto_approve_rate: number | null
      avg_risk_score: number | null
    }

    interface Appeal {
      id: string
      related_audit_id: string | null
      related_penalty_id: string | null
      submitter_user_id: string | null
      appeal_reason: string
      status: string
      handler_id: string | null
      created_at: string
      updated_at: string
      target_id: string | null
      target_type: string | null
      audit_status: string | null
      audit_risk_level: string | null
      penalty_type: string | null
      penalty_reason: string | null
      penalty_status: string | null
    }
  }
}
