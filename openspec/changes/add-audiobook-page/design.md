## Context

`tts` 服务（Fastify，默认 `http://127.0.0.1:3000`）以前缀 `/api/v1` 注册有声书路由（`server.ts` `registerRoutes`），提供 `POST /jobs`、`GET /jobs/:id`、`GET /jobs/:id/events`(SSE)、`GET /jobs/:id/file`、`DELETE /jobs/:id`、`POST /jobs/:id/resume`。前端 `use-tool` 为 Vue 3 + Vite + TS + Tailwind v4 + vue-router 项目，`epub` 板块现有纯前端 TXT→EPUB 转换器。需新增页面消费上述 API。

约束：后端已开启 CORS，前端直连绝对地址；不使用 localStorage；不照搬 chat 板块的 localStorage 设置弹窗。

## Goals / Non-Goals

**Goals:**
- 新增 `/audiobook` 页面，覆盖创建→进度→下载→取消/恢复全流程。
- 类型化、可测试的 API 客户端，URL 基于 `.env` 配置自行拼接。
- 复用现有玻璃拟态/暗色样式与 lucide 图标，视觉与 epub 板块一致。

**Non-Goals:**
- 不修改 `tts` 后端（含其 `statusUrl` 前缀不一致问题）。
- 不改动现有 TXT→EPUB 功能。
- 不做任务列表/历史持久化（无 localStorage）。

## Decisions

- **URL 基于 `VITE_TTS_BASE` 自行拼接，不信任 `statusUrl`**：后端 `POST /jobs` 返回 `statusUrl: /api/v1/audiobook/...`，与实际注册前缀 `/api/v1` 不一致。前端用 `import.meta.env.VITE_TTS_BASE ?? 'http://127.0.0.1:3000/api/v1'` 拼 `/jobs/:id...`，规避后端不一致并便于环境切换。备选（信任 statusUrl）被否决，因其会请求到不存在的路径。
- **SSE 用原生 `EventSource` + 具名事件监听**：后端发送具名事件（`handshake`/`progress`/`status`），故用 `addEventListener('progress'|'status')` 而非 `onmessage`。相比 chat 用的 POST+fetch 流式解析，这里是 GET SSE，`EventSource` 更简洁且自动重连。
- **单文件页面 + 独立 api 模块**：`audiobook.vue` 负责 UI 与状态机，`audiobook-api.ts` 负责网络与类型，便于复用与类型检查。
- **客户端预校验对齐后端枚举/正则**：voice/bitrate 白名单、rate `^[+-]\d+%$`、pitch `^[+-]\d+Hz$`、封面 jpg/png ≤2MB、title ≤200，减少往返 400。
- **无 localStorage**：所有状态用 `ref` 内存保存，配置仅来自 `.env`。

## Risks / Trade-offs

- [后端未真正开启 CORS / SSE 跨域被拦] → 用户已确认后端已配 CORS；若失败，回退方案是加 Vite dev proxy（不在本次范围）。
- [`EventSource` 不能自定义请求头] → 当前 API 无鉴权头需求，无影响；若后续需要鉴权，需改用 fetch + ReadableStream（参考 chat 板块）。
- [后端 `statusUrl` 前缀不一致] → 通过自行拼接 URL 规避，已在 Decisions 固化。
- [base 写死在 `.env` 默认值] → 提供 `.env`/`.env.example` 占位，部署时覆盖。

## Migration Plan

纯新增，无数据迁移。回滚：删除新增文件并撤销 `router.ts` 中新增路由即可，现有 `/epub` 不受影响。
