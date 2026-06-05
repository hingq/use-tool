<script lang="ts" setup>
/**
 * @file index.vue
 * @description Xray `/debug/vars` 流量监控快照页。点击"拉取数据"一次性抓取 expvar JSON，
 * 用 Chart.js 只渲染流量相关图表（inbound/outbound 总览 + 用户流量）。
 * 非轮询；重复拉取会销毁旧图后重建。
 */
import { onBeforeUnmount, ref } from "vue";
import Chart from "chart.js/auto";
import {
  DEFAULT_DEBUG_VARS_URL,
  DebugVarsError,
  fetchDebugVars,
  formatBytes,
  toTrafficRows,
  type DebugVars,
} from "./api";

const url = ref<string>(DEFAULT_DEBUG_VARS_URL);
const loading = ref<boolean>(false);
const error = ref<string>("");
const data = ref<DebugVars | null>(null);

// 画布引用
const trafficCanvas = ref<HTMLCanvasElement | null>(null);
const userCanvas = ref<HTMLCanvasElement | null>(null);
const ratioCanvas = ref<HTMLCanvasElement | null>(null);

// 已创建的 Chart 实例，重建前销毁
let charts: Chart[] = [];

const palette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

const destroyCharts = () => {
  charts.forEach((c) => c.destroy());
  charts = [];
};

/** 概览摘要（只显示流量相关数字）。 */
const summary = ref<{ label: string; value: string }[]>([]);

const buildSummary = (d: DebugVars) => {
  const rows = toTrafficRows(d.stats);
  const sumBy = (cat: "inbound" | "outbound" | "user", key: "uplink" | "downlink") =>
    rows.filter((r) => r.category === cat).reduce((s, r) => s + r[key], 0);
  const userRows = rows.filter((r) => r.category === "user");
  summary.value = [
    { label: "入站上行", value: formatBytes(sumBy("inbound", "uplink")) },
    { label: "入站下行", value: formatBytes(sumBy("inbound", "downlink")) },
    { label: "出站上行", value: formatBytes(sumBy("outbound", "uplink")) },
    { label: "出站下行", value: formatBytes(sumBy("outbound", "downlink")) },
    { label: "用户数", value: String(userRows.length) },
    { label: "用户上行合计", value: formatBytes(sumBy("user", "uplink")) },
    { label: "用户下行合计", value: formatBytes(sumBy("user", "downlink")) },
  ];
};

/** 通用：渲染一组流量行为分组柱状图（上行/下行）。 */
const renderTrafficBar = (
  canvas: HTMLCanvasElement,
  rows: ReturnType<typeof toTrafficRows>,
  labelFn: (r: (typeof rows)[number]) => string,
) => {
  charts.push(
    new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map(labelFn),
        datasets: [
          {
            label: "上行 uplink",
            data: rows.map((r) => r.uplink),
            backgroundColor: palette[0],
          },
          {
            label: "下行 downlink",
            data: rows.map((r) => r.downlink),
            backgroundColor: palette[1],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${formatBytes(Number(ctx.parsed.y))}`,
            },
          },
        },
        scales: {
          y: { ticks: { callback: (v) => formatBytes(Number(v)) } },
        },
      },
    }),
  );
};

const renderCharts = (d: DebugVars) => {
  destroyCharts();
  const rows = toTrafficRows(d.stats);

  // 1. 流量总览（inbound + outbound 各 tag）
  if (trafficCanvas.value) {
    const ioRows = rows.filter((r) => r.category !== "user");
    renderTrafficBar(
      trafficCanvas.value,
      ioRows,
      (r) => `${r.tag} (${r.category})`,
    );
  }

  // 2. 用户流量（只画 user，未连接为 0 的也保留）
  if (userCanvas.value) {
    const userRows = rows.filter((r) => r.category === "user");
    renderTrafficBar(userCanvas.value, userRows, (r) => r.tag);
  }

  // 3. 出/入站流量占比（环形图）
  if (ratioCanvas.value) {
    const sum = (g: Record<string, { uplink: number; downlink: number }>) =>
      Object.values(g).reduce((s, c) => s + c.uplink + c.downlink, 0);
    charts.push(
      new Chart(ratioCanvas.value, {
        type: "doughnut",
        data: {
          labels: ["inbound 总流量", "outbound 总流量"],
          datasets: [
            {
              data: [sum(d.stats.inbound), sum(d.stats.outbound)],
              backgroundColor: [palette[0], palette[2]],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  `${ctx.label}: ${formatBytes(Number(ctx.parsed))}`,
              },
            },
          },
        },
      }),
    );
  }
};

const load = async () => {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    const d = await fetchDebugVars(url.value.trim());
    data.value = d;
    buildSummary(d);
    // 等 DOM 渲染出 canvas 后再画
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    renderCharts(d);
  } catch (e) {
    if (e instanceof DebugVarsError) {
      error.value =
        e.statusCode === 0
          ? `网络/跨域请求失败：${e.message}（目标服务需开启 CORS）`
          : `请求失败 (HTTP ${e.statusCode})：${e.message}`;
    } else {
      error.value = e instanceof Error ? e.message : "未知错误";
    }
    data.value = null;
    destroyCharts();
  } finally {
    loading.value = false;
  }
};

onBeforeUnmount(destroyCharts);
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8">
    <h1 class="mb-1 text-2xl font-semibold text-slate-800">Xray 流量监控</h1>
    <p class="mb-6 text-sm text-slate-500">
      从 expvar 端点拉取一次快照，只分析入站/出站与用户的流量。
    </p>

    <!-- 控制栏 -->
    <div
      class="mb-6 flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/50 p-4 shadow-lg backdrop-blur-xl sm:flex-row sm:items-center"
    >
      <input
        v-model="url"
        type="text"
        placeholder="http://host:port/debug/vars"
        class="flex-1 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />
      <button
        :disabled="loading"
        class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        @click="load"
      >
        {{ loading ? "拉取中…" : "拉取数据" }}
      </button>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- 概览摘要 -->
    <div v-if="data" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        v-for="item in summary"
        :key="item.label"
        class="rounded-xl border border-white/20 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-xl"
      >
        <div class="text-xs text-slate-500">{{ item.label }}</div>
        <div class="mt-1 text-lg font-semibold text-slate-800">{{ item.value }}</div>
      </div>
    </div>

    <!-- 图表区 -->
    <div v-show="data" class="grid grid-cols-1 gap-6">
      <div class="rounded-2xl border border-white/20 bg-white/50 p-5 shadow-lg backdrop-blur-xl">
        <h2 class="mb-3 text-base font-medium text-slate-700">用户流量（各用户上/下行）</h2>
        <canvas ref="userCanvas"></canvas>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="rounded-2xl border border-white/20 bg-white/50 p-5 shadow-lg backdrop-blur-xl">
          <h2 class="mb-3 text-base font-medium text-slate-700">入站/出站流量</h2>
          <canvas ref="trafficCanvas"></canvas>
        </div>
        <div class="rounded-2xl border border-white/20 bg-white/50 p-5 shadow-lg backdrop-blur-xl">
          <h2 class="mb-3 text-base font-medium text-slate-700">出/入站流量占比</h2>
          <canvas ref="ratioCanvas"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>
