/**
 * @file audiobook-api.ts
 * @description TTS 有声书服务的类型化前端客户端。封装任务的创建 / 查询 / 取消 / 恢复、
 * SSE 进度订阅与成品下载地址。所有请求 URL 基于 `VITE_TTS_BASE` 自行拼接——
 * 不信任后端 `POST /jobs` 返回的 `statusUrl`（其前缀与实际注册不一致）。
 * 本模块不读写 localStorage。
 */

/** 任务整体状态。`pending`/`running` 为活跃态，`done`/`failed`/`canceled` 为终态。 */
export type JobStatus = "pending" | "running" | "done" | "failed" | "canceled";

/** 任务细分阶段，用于前端展示流水线进度。 */
export type JobPhase = "preprocess" | "tts" | "mux" | "validating" | "ready";

/** 任务进度：当前阶段 + TTS/转码两条流水线的分块完成度。 */
export interface JobProgress {
  phase: JobPhase;
  ttsChunks: { done: number; total: number };
  transcodeChunks: { done: number; total: number };
}

/** 任务对外快照，对应 `GET /jobs/:id` 与 SSE `progress` 事件的响应体。 */
export interface JobInfo {
  jobId: string;
  status: JobStatus;
  progress: JobProgress;
  downloadUrl: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  title: string;
  author?: string;
  voice: string;
  rate: string;
  pitch: string;
  bitrate: string;
}

/** 任务列表项，对应 `GET /jobs` 的 `{ jobs: JobSummary[] }`（区别于单任务 JobInfo）。 */
export interface JobSummary {
  jobId: string;
  status: JobStatus;
  phase: JobPhase;
  title: string;
  /** 成品是否已上传 COS。 */
  uploaded: boolean;
  /** 本地是否仍有 output.m4b。 */
  hasLocalFile: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `POST /jobs` 的创建响应（前端忽略其中的 statusUrl）。 */
export interface CreateJobResult {
  jobId: string;
  status: JobStatus;
}

/** SSE `status` 终态事件载荷。 */
export interface JobStatusEvent {
  status: JobStatus;
  downloadUrl: string | null;
  error: string | null;
}

/** 携带 HTTP 状态码的客户端错误，便于页面区分 503 等分支。 */
export class AudiobookApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AudiobookApiError";
  }
}

/** TTS 服务 base（含 `/api/v1`）。仅来自 .env，缺省回退本地默认。 */
export const TTS_BASE: string =
  (import.meta.env.VITE_TTS_BASE as string | undefined) ??
  "http://127.0.0.1:3000/api/v1";

/** 解析非 2xx 响应体 `{ error, message }` 并抛出。 */
async function throwFromResponse(res: Response): Promise<never> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    message = body.message || body.error || message;
  } catch {
    // 响应体非 JSON：保留 statusText
  }
  throw new AudiobookApiError(res.status, message);
}

/** 创建有声书任务。`form` 须包含 `text` 文件与各参数字段（可选 `cover`）。 */
export async function createJob(form: FormData): Promise<CreateJobResult> {
  const res = await fetch(`${TTS_BASE}/jobs`, { method: "POST", body: form });
  if (!res.ok) await throwFromResponse(res);
  const data = (await res.json()) as CreateJobResult;
  return { jobId: data.jobId, status: data.status };
}

/** 列出全部任务（后端已按 createdAt 倒序合并磁盘+内存，无分页）。 */
export async function listJobs(): Promise<JobSummary[]> {
  const res = await fetch(`${TTS_BASE}/jobs`);
  if (!res.ok) await throwFromResponse(res);
  const data = (await res.json()) as { jobs: JobSummary[] };
  return data.jobs;
}

/** 查询任务状态。 */
export async function getJob(jobId: string): Promise<JobInfo> {
  const res = await fetch(`${TTS_BASE}/jobs/${jobId}`);
  if (!res.ok) await throwFromResponse(res);
  return (await res.json()) as JobInfo;
}

/** 取消任务（对终态幂等，返回 204）。 */
export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${TTS_BASE}/jobs/${jobId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await throwFromResponse(res);
}

/** 恢复 failed/canceled 任务，返回最新 JobInfo。 */
export async function resumeJob(jobId: string): Promise<JobInfo> {
  const res = await fetch(`${TTS_BASE}/jobs/${jobId}/resume`, { method: "POST" });
  if (!res.ok) await throwFromResponse(res);
  return (await res.json()) as JobInfo;
}

/** 成品 m4b 下载地址。 */
export function fileUrl(jobId: string): string {
  return `${TTS_BASE}/jobs/${jobId}/file`;
}

/** SSE 事件处理回调。 */
export interface EventHandlers {
  /** 收到 `progress` 事件（完整 JobInfo 快照）。 */
  onProgress?: (info: JobInfo) => void;
  /** 收到 `status` 终态事件。 */
  onStatus?: (event: JobStatusEvent) => void;
  /** 连接层错误（网络中断等）。 */
  onError?: (err: Event) => void;
}

/**
 * 订阅任务进度 SSE。后端使用具名事件（handshake/progress/status），故逐一 addEventListener。
 * @returns 关闭连接的函数，组件卸载或终态时调用。
 */
export function openEvents(jobId: string, handlers: EventHandlers): () => void {
  const source = new EventSource(`${TTS_BASE}/jobs/${jobId}/events`);

  const onProgress = (e: MessageEvent): void => {
    try {
      handlers.onProgress?.(JSON.parse(e.data) as JobInfo);
    } catch {
      // 忽略半包/解析异常
    }
  };
  const onStatus = (e: MessageEvent): void => {
    try {
      handlers.onStatus?.(JSON.parse(e.data) as JobStatusEvent);
    } catch {
      // 忽略解析异常
    }
  };

  source.addEventListener("progress", onProgress as EventListener);
  source.addEventListener("status", onStatus as EventListener);
  if (handlers.onError) source.addEventListener("error", handlers.onError);

  return () => source.close();
}
