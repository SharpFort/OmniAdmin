# OmniAdmin

基于 art-design-pro 3.0.2 的零后端管理系统前端，对接 [OmniPG](https://github.com/SharpFort/OmniPG)（PostgreSQL + PostgREST + APISIX + Logto）。

- 技术栈：Vue 3.5 + TypeScript + Element Plus 2.11 + Pinia + vue-router 4 + @logto/vue 3.0.13
- 后端 API：PostgREST `api_v1_platform` schema（视图 GET / RPC POST，JWT Bearer 认证）

## 快速开始

```bash
pnpm install
pnpm dev        # 开发（固定 3006；备用 3007 也需在 Logto 登记）
pnpm run lint   # eslint
pnpm run build  # vue-tsc + vite build
```

## 环境变量（.env.development 模板见 .env.example）

| 变量 | 说明 | 示例 |
| :-- | :-- | :-- |
| `VITE_API_URL` | PostgREST 地址 | `http://localhost:3100` |
| `VITE_LOGTO_ENDPOINT` | Logto 服务地址 | `http://localhost:3001` |
| `VITE_LOGTO_APP_ID` | Logto SPA 应用 ID | `0d4o8wb6qk9bar0egelb4` |
| `VITE_LOGTO_REDIRECT_URI` | 登录回调地址（需在 Logto Console 登记） | `http://localhost:3006/auth/callback` |
| `VITE_LOGTO_POST_LOGOUT_REDIRECT_URI` | 登出回跳地址 | `http://localhost:3006/auth/login` |
| `VITE_LOGTO_ORGANIZATION_ID` | 业务组织（Logto Organization）ID，组织级 RLS 依赖组织 token | `q8xan57gksx5`（本地默认组织） |
| `VITE_ACCESS_MODE` | 权限模式：`frontend`（本地路由全量，默认）/ `backend`（后端菜单驱动，下一轮） | `frontend` |

> 敏感值不入库；Logto Console 需将开发机地址加入 SPA 应用 redirect URI / post sign-out URI / CORS 允许来源。

## 认证（Logto 全托管）

登录/注册/忘记密码/登出全部由 Logto 托管页处理（见 `docs/1.前端对齐后端方案-修订版.md` §2.1）：

- 登录页右侧为 Logto 托管登录页（iframe 嵌入）——OmniPG `gateway/docker-compose.yml` 的 `LOGTO_EXTRA_FRAME_ANCESTOR` 固定放行 `http://localhost:3006 http://localhost:3007`，改端口后需 `docker compose up -d --force-recreate logto`
- ⚠️ 前端动态取 `window.location.origin` + `/auth/callback` 作为 redirect_uri，因此**每个实际访问地址**（localhost / 127.0.0.1 / 局域网 IP / WSL 网关 IP × 3006/3007）都必须在 Logto Console 登记 redirect/post-logout URI，并在 `LOGTO_EXTRA_FRAME_ANCESTOR` 放行；否则登录会报 `oidc.invalid_redirect_uri` 或被 CSP 拒绝嵌入。当前开发机已登记包含 `172.17.112.1`、`192.168.0.128` 的 10 组 URI
- 登录页仅两个按钮：统一身份认证登录 / 注册账号（`signIn(redirectUri, 'signUp')`）
- 回调页：error 检测 → `ensure_user()`（JIT 建档，失败重试 1 次）→ `get_current_user()` 填 userStore → 跳转
- token 由 Logto SDK 管理（PKCE + 静默刷新），请求层自动注入 Bearer

## 权限体系（§2.6）

| 机制 | 层级 | 数据源 | 用法 |
| :-- | :-- | :-- | :-- |
| `v-auth` / `useAuth` | 页面级 | 路由 `meta.authList` | `<el-button v-auth="'add'">` |
| `v-perm` / `usePermission` | 按钮级 | 后端权限码（`v_role_menu_detail.permission_code`） | `<el-button v-perm="'platform:dept:create'">` |

- 超管短路：仅 `role_super_admin`（与后端 035 `is_super_admin` 定义一致）
- 权限码集合：首次 `hasPerm` 拉取后模块级内存缓存（按用户 id 隔离，切换账号自动重拉）
- 按钮显隐矩阵（tenant_admin）：dept/position/dict CRUD ✅、menu CRUD/role 分配/login-log ❌、menu/api/role 页只读

## API 层结构（§2.2）

```
src/api/
  request.ts        # 统一封装：postRpc / getView / getViewPage + 错误拦截（42501/P0001）
  auth.ts           # ensureUser / getCurrentUser / getAllPublicConfigs / getConfig
  system-manage.ts  # 用户/角色/部门/岗位/菜单/配置/登录日志
  audit.ts          # searchAuditLog / getAuditLogTimeline / 视图查询
  monitor.ts        # v_system_stats / cron（数组返回）
  dict.ts           # 字典类型+数据项 6 CRUD
  tenant.ts         # rpc_list_tenants / rpc_list_tenant_members / user_tenants
  import.ts         # import_csv 占位（待使用再决策）
```

类型定义 `src/types/api/api.d.ts`：snake_case 透传（零转换层），字段与后端返回一一对应。

## Logto Console 配置指引

详见 OmniPG 仓库文档（feature/logto-authn 分支）。要点：

1. SPA 应用 + redirect URI（`/auth/callback`）+ post sign-out URI（`/`）+ CORS 允许来源
2. Sign-up and sign-in：启用 Password 登录方式 + 注册标识 + Forgot password 验证方式
3. Email/SMTP connector（注册/忘记密码验证）
4. Password policy 按 NIST（最小长度 8、HIBP、重复/用户信息检查、不强制定期改密）
5. Custom JWT 已注入 `roles/global_roles/org_roles/pg_role/tenant_id/organization_id`（后端 `current_organization_id()` / `current_logto_tenant_id()` 依赖，需重跑 init-logto.py 生效）

## 写操作边界

用户/角色/租户的新增、删除、禁用、重置密码均在 **Logto Console** 侧操作；前端仅提供列表/查询/资料编辑（user_profile）与权限绑定（iam_role_menu / iam_role_api）。

## 遗留项（下一轮）

- `VITE_ACCESS_MODE=backend`：后端菜单驱动（get_user_menu + 动态路由注册，§2.4 下一轮）
- usePermission 迁移 Pinia userStore 持久缓存（§2.6 下一轮）
- 视图 `security_invoker=true` 化（P1 安全：消除个人信息跨租户暴露面，§9.1）
- `user_profile` 建表定义补入后端迁移链（§9.5）
