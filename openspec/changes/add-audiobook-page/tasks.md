## 1. 配置与 API 客户端

- [ ] 1.1 在项目根新增 `.env` 与 `.env.example`，写入 `VITE_TTS_BASE=http://127.0.0.1:3000/api/v1`
- [ ] 1.2 新增 `src/components/epub/audiobook-api.ts`：导出 `JobStatus`/`JobPhase`/`JobProgress`/`JobInfo` 类型
- [ ] 1.3 在客户端定义 `TTS_BASE = import.meta.env.VITE_TTS_BASE ?? 'http://127.0.0.1:3000/api/v1'`（不读写 localStorage）
- [ ] 1.4 实现 `createJob(form)`、`getJob(id)`、`cancelJob(id)`、`resumeJob(id)`，非 2xx 解析 `{error,message}` 抛出
- [ ] 1.5 实现 `openEvents(id, handlers)`（EventSource + `progress`/`status` 具名监听，返回 `close()`）与 `fileUrl(id)`

## 2. 页面实现

- [ ] 2.1 新增 `src/components/epub/audiobook.vue`，定义状态机 `form|creating|processing|done|failed|canceled`（全部 `ref` 内存态）
- [ ] 2.2 form 视图：txt 拖拽/选择上传、标题自动预填、作者、音色/码率下拉、rate/pitch 滑块、封面可选+预览
- [ ] 2.3 客户端预校验对齐后端：voice/bitrate 白名单、rate/pitch 正则、封面 jpg/png ≤2MB、title 必填 ≤200
- [ ] 2.4 提交：组装 FormData 调 `createJob`，成功后 `openEvents`；处理 503 友好提示
- [ ] 2.5 processing 视图：阶段文案 + TTS/转码两条进度条 + 取消按钮
- [ ] 2.6 done 视图：用 `fileUrl` 触发下载，提供「再次下载 / 新建任务」
- [ ] 2.7 failed/canceled 视图：展示 error，提供「恢复任务」(resume) 与「重新开始」
- [ ] 2.8 `onUnmounted` 关闭 EventSource

## 3. 路由与验证

- [ ] 3.1 在 `src/router.ts` 新增 `/audiobook` 路由懒加载 `audiobook.vue`
- [ ] 3.2 `npm run build`（含 `vue-tsc -b`）类型检查通过
- [ ] 3.3 端到端联调：启动 tts(:3000) 与前端，上传含「第X章」的 txt，观察进度→下载，并验证取消/恢复
