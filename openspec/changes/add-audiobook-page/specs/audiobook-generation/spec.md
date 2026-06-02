## ADDED Requirements

### Requirement: 文本上传与参数配置
页面 SHALL 允许用户上传一个 `.txt` 文本文件并配置有声书参数（标题、作者、音色、语速、音高、码率、可选封面），且 MUST 在提交前执行与后端一致的客户端校验以避免无谓的 400 响应。

#### Scenario: 上传合法 txt 并自动填充标题
- **WHEN** 用户拖拽或选择一个 `.txt` 文件
- **THEN** 系统接受该文件，并用去掉扩展名的文件名预填「标题」字段

#### Scenario: 拒绝非 txt 文件
- **WHEN** 用户拖入非 `.txt`（或非 `text/plain`）文件
- **THEN** 系统拒绝该文件并提示「仅支持 .txt 纯文本文件」

#### Scenario: 封面体积/类型校验
- **WHEN** 用户选择的封面不是 jpg/png 或大于 2MB
- **THEN** 系统拒绝该封面并提示原因，不将其加入提交

#### Scenario: 缺少标题时禁止提交
- **WHEN** 标题为空
- **THEN** 提交按钮禁用或提交被拦截并提示「标题为必填项」

### Requirement: 任务创建
页面 SHALL 通过 `POST {VITE_TTS_BASE}/jobs` 以 multipart 形式提交文本、参数与可选封面来创建任务，并 MUST 基于配置的 base 自行拼接后续请求 URL，而非信任响应中的 `statusUrl`。

#### Scenario: 创建成功
- **WHEN** 用户提交合法表单
- **THEN** 系统收到 `201 { jobId, status }`，进入 processing 状态并开始订阅进度

#### Scenario: 并发已满
- **WHEN** 后端返回 `503`
- **THEN** 系统提示「已达最大并发任务数，请稍后重试」并允许用户重新提交

### Requirement: 实时进度跟踪
页面 SHALL 通过 SSE（`GET {base}/jobs/:id/events`）订阅任务进度，并 MUST 展示当前阶段以及 TTS 与转码两条流水线的 `done/total` 进度。

#### Scenario: 进度推进
- **WHEN** 收到 `progress` 事件
- **THEN** 系统更新阶段文案与两条进度条

#### Scenario: 终态结束
- **WHEN** 收到 `status` 事件且状态为 `done`/`failed`/`canceled`
- **THEN** 系统切换到对应终态视图并关闭 SSE 连接

#### Scenario: 离开页面清理连接
- **WHEN** 组件卸载
- **THEN** 系统关闭 EventSource，不留下悬挂连接

### Requirement: 成品下载
当任务进入 `done` 终态时，页面 SHALL 提供基于 `{base}/jobs/:id/file` 的下载入口。

#### Scenario: 完成后下载
- **WHEN** 任务状态变为 `done`
- **THEN** 系统触发或提供 m4b 文件下载链接

### Requirement: 任务取消与恢复
页面 SHALL 允许在处理中取消任务（`DELETE {base}/jobs/:id`），并允许对 `failed`/`canceled` 任务恢复（`POST {base}/jobs/:id/resume`）。

#### Scenario: 取消处理中任务
- **WHEN** 用户在 processing 状态点击「取消」
- **THEN** 系统调用取消接口并切换到 canceled 视图

#### Scenario: 恢复失败任务
- **WHEN** 用户对 failed/canceled 任务点击「恢复」
- **THEN** 系统调用 resume 接口并重新订阅进度

### Requirement: 无本地持久化
页面与 API 客户端 MUST NOT 使用 localStorage 持久化任何配置或状态；重要配置（如 TTS base URL）SHALL 仅来自 `.env`（`VITE_*`）。

#### Scenario: base URL 来源
- **WHEN** 应用需要 TTS base URL
- **THEN** 取值来自 `import.meta.env.VITE_TTS_BASE`，缺省回退到默认值，且不读写 localStorage
