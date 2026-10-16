import { AppRouteRecord } from '@/types/router'

/**
 * citywalk 业务路由（2026-10-16 首批：景点数据准备三页面）
 *
 * 后端 schema：api_v1_content_places（PostgREST Accept-Profile 跨域访问）；
 * 权限对齐后端 api_v1/content_places/privileges/05_match_admin_grants.sql
 * （super_admin/role_admin/tenant_admin）→ 前端 roles 取对应 Logto 角色名。
 * - places：places 基础集管理（v_pois_admin 全状态列表）
 * - match-queue：匹配复审工作台（run_source_matching + 复审三动作单条/批量）
 * - data-sources/mca：MCA 镜像导入概览（stats/by_province/admin 浏览）
 */
export const citywalkRoutes: AppRouteRecord = {
  path: '/citywalk',
  name: 'Citywalk',
  component: '/index/index',
  meta: {
    title: 'menus.citywalk.title',
    icon: 'ri:map-pin-line',
    roles: ['role_super_admin', 'tenant_admin']
  },
  children: [
    {
      path: 'places',
      name: 'CitywalkPlaces',
      component: '/citywalk/places',
      meta: {
        title: 'menus.citywalk.places',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'match-queue',
      name: 'CitywalkMatchQueue',
      component: '/citywalk/match-queue',
      meta: {
        title: 'menus.citywalk.matchQueue',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'data-sources/mca',
      name: 'CitywalkMcaData',
      component: '/citywalk/data-sources/mca',
      meta: {
        title: 'menus.citywalk.mcaData',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'masterdata/tags',
      name: 'CitywalkTags',
      component: '/citywalk/masterdata/tags',
      meta: {
        title: 'menus.citywalk.tags',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'masterdata/categories',
      name: 'CitywalkCategories',
      component: '/citywalk/masterdata/categories',
      meta: {
        title: 'menus.citywalk.categories',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'feedback/tickets',
      name: 'CitywalkTickets',
      component: '/citywalk/feedback/tickets',
      meta: {
        title: 'menus.citywalk.tickets',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'feedback/poi-updates',
      name: 'CitywalkPoiUpdates',
      component: '/citywalk/feedback/poi-updates',
      meta: {
        title: 'menus.citywalk.poiUpdates',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'comment/comments',
      name: 'CitywalkComments',
      component: '/citywalk/comment/comments',
      meta: {
        title: 'menus.citywalk.comments',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'comment/reports',
      name: 'CitywalkReports',
      component: '/citywalk/comment/reports',
      meta: {
        title: 'menus.citywalk.reports',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'reaction/reviews',
      name: 'CitywalkReviews',
      component: '/citywalk/reaction/reviews',
      meta: {
        title: 'menus.citywalk.reviews',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'moderation/queue',
      name: 'CitywalkModerationQueue',
      component: '/citywalk/moderation/queue',
      meta: {
        title: 'menus.citywalk.moderationQueue',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    },
    {
      path: 'moderation/appeals',
      name: 'CitywalkAppeals',
      component: '/citywalk/moderation/appeals',
      meta: {
        title: 'menus.citywalk.appeals',
        keepAlive: true,
        roles: ['role_super_admin', 'tenant_admin']
      }
    }
  ]
}
