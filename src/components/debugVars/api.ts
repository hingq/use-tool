/**
 * @file api.ts
 * @description Xray expvar (`/debug/vars`) 端点的类型定义、一次性拉取与流量数据加工。
 * 仅做 GET 快照请求，不轮询、不读写 localStorage。数据加工为纯函数，便于单测。
 * 本页只关注流量统计（stats），不处理 memstats。
 */

/** 单个流量计数（字节）。inbound/outbound/user 下每个 tag 都是这个结构。 */
export interface TrafficCounter {
  uplink: number;
  downlink: number;
}

/** Xray `stats` 块：三类计数器，key 为 tag 名。 */
export interface DebugStats {
  inbound: Record<string, TrafficCounter>;
  outbound: Record<string, TrafficCounter>;
  user: Record<string, TrafficCounter>;
}

/** `/debug/vars` 顶层响应（只声明流量相关字段，其余忽略）。 */
export interface DebugVars {
  stats: DebugStats;
}

/** 携带 HTTP 状态码的自定义错误，便于上层区分网络/服务端错误。 */
export class DebugVarsError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "DebugVarsError";
  }
}

/** 默认数据源：环境变量优先，回退到同源相对路径。 */
export const DEFAULT_DEBUG_VARS_URL: string =
  (import.meta.env.VITE_DEBUG_VARS_URL as string | undefined) ?? "/debug/vars";

/** 拉取一次 `/debug/vars` 快照。失败抛出 {@link DebugVarsError}。 */
export async function fetchDebugVars(url: string): Promise<DebugVars> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    // 网络层错误（CORS / DNS / 连接失败）没有 HTTP 状态码。
    throw new DebugVarsError(0, e instanceof Error ? e.message : "网络请求失败");
  }
  if (!res.ok) {
    throw new DebugVarsError(res.status, res.statusText || `HTTP ${res.status}`);
  }
  try {
    return (await res.json()) as DebugVars;
  } catch {
    throw new DebugVarsError(res.status, "响应不是合法 JSON");
  }
}

// ---------------------------------------------------------------------------
// 数据加工（纯函数）
// ---------------------------------------------------------------------------

/** 拍平后的流量行，用于柱状图。 */
export interface TrafficRow {
  category: "inbound" | "outbound" | "user";
  tag: string;
  uplink: number;
  downlink: number;
}

/** 把 stats 的三类计数器拍平为有序数组，保留流量为 0 的未连接项。 */
export function toTrafficRows(stats: DebugStats): TrafficRow[] {
  const rows: TrafficRow[] = [];
  (["inbound", "outbound", "user"] as const).forEach((category) => {
    const group = stats[category] ?? {};
    Object.keys(group).forEach((tag) => {
      const c = group[tag];
      rows.push({ category, tag, uplink: c.uplink, downlink: c.downlink });
    });
  });
  return rows;
}

/** 把字节数格式化为人类可读字符串（B/KB/MB/GB）。 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
