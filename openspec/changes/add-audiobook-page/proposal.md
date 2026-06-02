## Why

`tts` 服务已提供一套完整的有声书生成 REST/SSE API（上传文本→TTS 合成→转码→打包 m4b），但前端 `use-tool` 没有任何页面消费它。`epub` 板块目前只有纯前端的「TXT→EPUB」转换器。用户需要一个能驱动该 API 全流程的页面：上传文本、配置音色参数、实时查看流水线进度、下载成品，并能取消与恢复任务。

## What Changes

- 在 `src/components/epub/` 新增有声书生成页面 `audiobook.vue`，覆盖 form → creating → processing → done → failed/canceled 状态机。
- 新增类型化 API 客户端 `audiobook-api.ts`，封装 `createJob`/`getJob`/`cancelJob`/`resumeJob`/`openEvents`(SSE)/`fileUrl`。
- 新增路由 `/audiobook` 指向新页面；保留现有 `/epub`（TXT→EPUB）不变。
- TTS base URL 通过 `.env`（`VITE_TTS_BASE`）配置；页面与客户端**不使用 localStorage** 持久化任何内容。
- 前端构造请求 URL 时**不信任**后端返回的 `statusUrl`（其前缀与实际注册不一致），统一基于配置的 base 自行拼接。

## Capabilities

### New Capabilities
- `audiobook-generation`: 前端有声书生成能力——文本上传与参数校验、任务创建、SSE 进度跟踪、成品下载、任务取消与恢复。

### Modified Capabilities
<!-- 无现有 spec 的需求变更 -->

## Impact

- 新增：`src/components/epub/audiobook.vue`、`src/components/epub/audiobook-api.ts`、`.env`（或 `.env.example`，含 `VITE_TTS_BASE`）。
- 修改：`src/router.ts`（新增 `/audiobook` 路由）。
- 依赖：复用现有 `vue`、`vue-router`、`lucide-vue-next`、Tailwind；无新增 npm 依赖。
- 外部契约：依赖 `tts` 服务 `/api/v1/jobs*` 路由与 `JobInfo` 响应结构；要求后端已开启 CORS。
