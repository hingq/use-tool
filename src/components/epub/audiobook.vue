<template>
  <div class="w-full max-w-xl mx-auto px-4 py-8">
    <div
      class="relative overflow-hidden rounded-3xl border border-white/20 bg-white/40 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-black/30">
      <!-- Background glowing orbs -->
      <div class="absolute -top-12 -right-12 -z-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl"></div>
      <div class="absolute -bottom-12 -left-12 -z-10 h-32 w-32 rounded-full bg-purple-500/20 blur-2xl"></div>

      <!-- 历史任务切换 -->
      <button type="button" @click="toggleList" :title="showList ? '返回' : '历史任务'"
        class="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-xl border border-muted-foreground/20 bg-white/50 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-indigo-500/50 dark:bg-black/20"
        :class="showList ? 'border-indigo-500/50 text-indigo-500' : ''">
        <History class="h-3.5 w-3.5" /> 历史任务
      </button>

      <div class="mb-8 text-center">
        <h1
          class="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent dark:from-indigo-400 dark:to-purple-400">
          TXT ➔ 有声书 (M4B)
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          上传文本，选择音色，自动合成并打包为带章节的有声书
        </p>
      </div>

      <!-- ===== 状态机视图（非历史任务面板时显示） ===== -->
      <template v-if="!showList">
        <!-- ========================= State: form ========================= -->
        <form v-if="status === 'form'" @submit.prevent="submit" class="space-y-5">
          <!-- TXT upload / dropzone -->
          <div @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop"
            class="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 cursor-pointer"
            :class="isDragging
              ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
              : 'border-muted-foreground/20 hover:border-indigo-500/50 hover:bg-white/10 dark:hover:bg-white/5'
              ">
            <input id="ab-text" type="file" accept=".txt" class="hidden" @change="handleTextChange" />
            <label for="ab-text" class="absolute inset-0 h-full w-full cursor-pointer"></label>
            <div
              class="mb-3 rounded-full bg-indigo-50 p-3 text-indigo-600 transition-transform duration-300 group-hover:scale-110 dark:bg-indigo-950/40 dark:text-indigo-400">
              <FileText class="h-6 w-6" />
            </div>
            <h3 class="text-sm font-semibold text-foreground">
              <template v-if="textFile">{{ textFile.name }}</template>
              <template v-else>拖拽 TXT 文件，或 <span class="text-indigo-500">点击上传</span></template>
            </h3>
            <p class="mt-1 text-xs text-muted-foreground">仅支持 .txt 纯文本（≤ 5MB）</p>
          </div>

          <!-- Title & author -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted-foreground">书名 *</label>
              <input v-model="title" type="text" maxlength="200" placeholder="必填，最长 200 字"
                class="w-full rounded-xl border border-muted-foreground/20 bg-white/50 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 dark:bg-black/20" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted-foreground">作者</label>
              <input v-model="author" type="text" maxlength="200" placeholder="可选"
                class="w-full rounded-xl border border-muted-foreground/20 bg-white/50 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 dark:bg-black/20" />
            </div>
          </div>

          <!-- Voice & bitrate -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted-foreground">发音人</label>
              <select v-model="voice"
                class="w-full rounded-xl border border-muted-foreground/20 bg-white/50 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 dark:bg-black/20">
                <option v-for="v in VOICES" :key="v.value" :value="v.value">{{ v.label }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted-foreground">码率</label>
              <select v-model="bitrate"
                class="w-full rounded-xl border border-muted-foreground/20 bg-white/50 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 dark:bg-black/20">
                <option v-for="b in BITRATES" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>
          </div>

          <!-- Rate & pitch sliders -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>语速</span><span class="font-mono text-indigo-500">{{ rate }}</span>
              </label>
              <input v-model.number="ratePct" type="range" min="-50" max="50" step="5"
                class="w-full accent-indigo-600" />
            </div>
            <div>
              <label class="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>音高</span><span class="font-mono text-indigo-500">{{ pitch }}</span>
              </label>
              <input v-model.number="pitchHz" type="range" min="-50" max="50" step="5"
                class="w-full accent-indigo-600" />
            </div>
          </div>

          <!-- Cover (optional) -->
          <div>
            <label class="mb-1 block text-xs font-semibold text-muted-foreground">封面（可选，jpg/png ≤ 2MB）</label>
            <div class="flex items-center gap-3">
              <input id="ab-cover" type="file" accept="image/jpeg,image/png" class="hidden"
                @change="handleCoverChange" />
              <label for="ab-cover"
                class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-muted-foreground/20 bg-white/50 px-3 py-2 text-sm text-foreground transition-colors hover:border-indigo-500/50 dark:bg-black/20">
                <ImageIcon class="h-4 w-4" /> 选择图片
              </label>
              <div v-if="coverPreview" class="flex items-center gap-2">
                <img :src="coverPreview" alt="cover" class="h-10 w-10 rounded-lg object-cover" />
                <button type="button" @click="clearCover" class="text-muted-foreground hover:text-red-500">
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Validation error -->
          <p v-if="formError" class="text-sm text-red-500 dark:text-red-400">{{ formError }}</p>

          <!-- ===== 分片内容校对 ===== -->
          <div v-if="chunks.length > 0" class="mt-6 space-y-4 rounded-2xl border border-white/20 bg-white/25 p-4 dark:border-white/10 dark:bg-black/15">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FileText class="h-4 w-4 text-indigo-500" />
                <h3 class="text-xs font-bold text-foreground">分片内容校对</h3>
                <span class="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  共 {{ chunks.length }} 个分片
                </span>
              </div>
            </div>

            <!-- 搜索过滤 -->
            <div class="relative">
              <Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input v-model="searchQuery" type="text" placeholder="搜索章节标题或分片内容..."
                class="w-full rounded-xl border border-muted-foreground/20 bg-white/50 py-1.5 pl-9 pr-4 text-xs outline-none transition-colors focus:border-indigo-500 dark:bg-black/20" />
            </div>

            <!-- 分片卡片列表 -->
            <div class="space-y-3">
              <div v-if="filteredChunks.length === 0" class="py-6 text-center text-xs text-muted-foreground">
                没有找到匹配的分片
              </div>
              <div v-for="chunk in paginatedChunks" :key="chunk.index"
                @click="openEditModal(chunk)"
                class="group relative overflow-hidden rounded-xl border border-white/15 bg-white/30 p-3.5 shadow-sm transition-all duration-300 hover:border-indigo-500/50 hover:bg-white/50 cursor-pointer dark:border-white/5 dark:bg-black/15 dark:hover:bg-black/25">
                <div class="mb-2 flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="font-mono font-bold text-indigo-500">#{{ chunk.index + 1 }}</span>
                    <span class="truncate rounded-md bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" :title="chunk.chapterTitle">
                      {{ chunk.chapterTitle }}
                    </span>
                  </div>
                  <span class="shrink-0 font-mono text-muted-foreground">
                    {{ chunk.text.length }} 字
                  </span>
                </div>
                <!-- 文本预览片段 -->
                <p class="text-xs leading-relaxed text-muted-foreground line-clamp-3 group-hover:text-foreground transition-colors text-left">
                  {{ truncateText(chunk.text, 120) }}
                </p>
                <div class="mt-2.5 flex items-center justify-end text-[10px] font-bold text-indigo-500 group-hover:text-indigo-600 dark:text-indigo-400">
                  <span class="flex items-center gap-1">
                    <Eye class="h-3.5 w-3.5" /> 查看详情与编辑
                  </span>
                </div>
              </div>
            </div>

            <!-- 分页器 -->
            <div v-if="totalPages > 1" class="flex items-center justify-between pt-2">
              <span class="text-xs text-muted-foreground">
                第 {{ currentPage }} / {{ totalPages }} 页
              </span>
              <div class="flex items-center gap-1">
                <button type="button" :disabled="currentPage === 1" @click="currentPage--"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-muted-foreground/20 bg-white/50 text-muted-foreground hover:text-indigo-500 disabled:opacity-30 dark:bg-black/20">
                  <ChevronLeft class="h-4 w-4" />
                </button>
                <button type="button" :disabled="currentPage === totalPages" @click="currentPage++"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-muted-foreground/20 bg-white/50 text-muted-foreground hover:text-indigo-500 disabled:opacity-30 dark:bg-black/20">
                  <ChevronRight class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <button type="submit" :disabled="!canSubmit"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Headphones class="h-4 w-4" /> 生成有声书
          </button>
        </form>

        <!-- ========================= State: creating ========================= -->
        <div v-else-if="status === 'creating'" class="flex flex-col items-center justify-center py-12 text-center">
          <div class="h-14 w-14 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-600"></div>
          <h3 class="mt-6 text-base font-semibold text-foreground">正在提交任务...</h3>
        </div>

        <!-- ========================= State: processing ========================= -->
        <div v-else-if="status === 'processing'" class="py-4">
          <div class="mb-6 flex items-center justify-center gap-3">
            <Loader2 class="h-5 w-5 animate-spin text-indigo-600" />
            <h3 class="text-base font-semibold text-foreground">{{ phaseLabel }}</h3>
          </div>

          <div class="space-y-5">
            <div>
              <div class="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>语音合成 (TTS)</span>
                <span class="font-mono">{{ progress.ttsChunks.done }} / {{ progress.ttsChunks.total || '—' }}</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  :style="{ width: ttsPct + '%' }">
                </div>
              </div>
            </div>
            <div>
              <div class="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>音频转码</span>
                <span class="font-mono">{{ progress.transcodeChunks.done }} / {{ progress.transcodeChunks.total || '—'
                }}</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-purple-500 transition-all duration-300"
                  :style="{ width: transcodePct + '%' }"></div>
              </div>
            </div>
          </div>

          <button @click="cancel"
            class="mx-auto mt-8 flex items-center gap-2 rounded-xl bg-muted px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/80">
            <X class="h-4 w-4" /> 取消任务
          </button>
        </div>

        <!-- ========================= State: done ========================= -->
        <div v-else-if="status === 'done'" class="flex flex-col items-center justify-center py-6 text-center">
          <div class="mb-4 rounded-full bg-green-50 p-4 text-green-600 dark:bg-green-950/40 dark:text-green-400">
            <CheckCircle class="h-10 w-10" />
          </div>
          <h3 class="text-lg font-semibold text-foreground">有声书生成完成！</h3>
          <p class="mt-2 text-sm text-muted-foreground">点击下方按钮下载 M4B 文件</p>
          <div class="mt-6 flex gap-3">
            <button @click="download(jobId, title)"
              class="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700">
              <Download class="h-4 w-4" /> 下载 M4B
            </button>
            <button @click="reset"
              class="rounded-xl bg-muted px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/80">
              新建任务
            </button>
          </div>
        </div>

        <!-- ========================= State: failed / canceled ========================= -->
        <div v-else class="flex flex-col items-center justify-center py-6 text-center">
          <div class="mb-4 rounded-full p-4"
            :class="status === 'failed' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'">
            <AlertCircle class="h-10 w-10" />
          </div>
          <h3 class="text-lg font-semibold text-foreground">{{ status === 'failed' ? '生成失败' : '任务已取消' }}</h3>
          <p v-if="errorMsg" class="mt-2 max-w-md text-sm text-red-500 dark:text-red-400">{{ errorMsg }}</p>
          <div class="mt-6 flex gap-3">
            <button v-if="jobId" @click="resume"
              class="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700">
              <RotateCcw class="h-4 w-4" /> 恢复任务
            </button>
            <button @click="reset"
              class="rounded-xl bg-muted px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/80">
              重新开始
            </button>
          </div>
        </div>
      </template>

      <!-- ========================= 历史任务面板 ========================= -->
      <div v-else>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-foreground">历史任务</h3>
          <div class="flex items-center gap-2">
            <button type="button" @click="loadList" :disabled="listLoading" title="刷新"
              class="inline-flex items-center justify-center rounded-lg border border-muted-foreground/20 bg-white/50 p-1.5 text-muted-foreground transition-colors hover:text-indigo-500 disabled:opacity-50 dark:bg-black/20">
              <RefreshCw class="h-4 w-4" :class="listLoading ? 'animate-spin' : ''" />
            </button>
            <button type="button" @click="closeList" title="关闭"
              class="inline-flex items-center justify-center rounded-lg border border-muted-foreground/20 bg-white/50 p-1.5 text-muted-foreground transition-colors hover:text-red-500 dark:bg-black/20">
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- loading -->
        <div v-if="listLoading" class="flex flex-col items-center justify-center py-12">
          <div class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-600"></div>
        </div>

        <!-- error -->
        <p v-else-if="listError" class="py-8 text-center text-sm text-red-500 dark:text-red-400">{{ listError }}</p>

        <!-- empty -->
        <p v-else-if="jobs.length === 0" class="py-12 text-center text-sm text-muted-foreground">暂无任务</p>

        <!-- list -->
        <ul v-else class="space-y-3">
          <li v-for="job in jobs" :key="job.jobId" @click="openJob(job)"
            class="cursor-pointer rounded-2xl border border-muted-foreground/20 bg-white/50 p-4 transition-colors hover:border-indigo-500/50 dark:bg-black/20">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-foreground">{{ job.title || "（无标题）" }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ fmtTime(job.createdAt) }}</p>
              </div>
              <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="STATUS_BADGE[job.status]">
                {{ STATUS_LABELS[job.status] }}
              </span>
            </div>

            <!-- 行操作 -->
            <div class="mt-3 flex flex-wrap gap-2" @click.stop>
              <button v-if="job.status === 'done'" @click="download(job.jobId, job.title)"
                class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700">
                <Download class="h-3.5 w-3.5" /> 下载
              </button>
              <button v-if="isActive(job.status)" @click="cancelFromList(job)"
                class="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80">
                <X class="h-3.5 w-3.5" /> 取消
              </button>
              <button v-if="job.status === 'failed' || job.status === 'canceled'" @click="resumeFromList(job)"
                class="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80">
                <RotateCcw class="h-3.5 w-3.5" /> 恢复
              </button>
              <button @click="openJob(job)"
                class="inline-flex items-center gap-1.5 rounded-lg border border-muted-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-indigo-500/50">
                详情
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <!-- ===== 分片编辑对话框 (Dialog Modal) ===== -->
  <div v-if="activeEditChunk" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Overlay backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="closeEditModal"></div>
    
    <!-- Modal content -->
    <div class="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-black/90 transition-all duration-300">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <FileText class="h-5 w-5 text-indigo-500" />
          <h3 class="text-base font-bold text-foreground truncate">
            编辑分片 #{{ activeEditChunk.index + 1 }}
          </h3>
        </div>
        <button type="button" @click="closeEditModal" class="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="space-y-4 text-left">
        <!-- 章节标题编辑 -->
        <div>
          <label class="mb-1 block text-xs font-semibold text-muted-foreground">章节标题 (修改后同步至本章所有分片)</label>
          <input v-model="activeEditTitle" type="text"
            class="w-full rounded-xl border border-muted-foreground/20 bg-white/50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white dark:bg-black/30 dark:focus:bg-black/50"
            placeholder="请输入章节标题..." />
        </div>

        <!-- 分片正文编辑 -->
        <div>
          <label class="mb-1 block text-xs font-semibold text-muted-foreground">分片正文</label>
          <textarea v-model="activeEditText" rows="10"
            class="w-full rounded-2xl border border-muted-foreground/20 bg-white/50 p-4 text-sm leading-relaxed outline-none transition-all focus:border-indigo-500 focus:bg-white dark:bg-black/30 dark:focus:bg-black/50"
            placeholder="分片内容不能为空..."></textarea>
        </div>
        
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>实时字数: <strong class="font-mono text-indigo-500">{{ activeEditText.length }}</strong> 字</span>
          <span>分片索引: #{{ activeEditChunk.index }} (章节 ID: #{{ activeEditChunk.chapterIndex }})</span>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="closeEditModal"
            class="rounded-xl border border-muted-foreground/20 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            取消
          </button>
          <button type="button" @click="saveEditModal" :disabled="!activeEditText.trim() || !activeEditTitle.trim()"
            class="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
            保存修改
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from "vue";
import {
  FileText, ImageIcon, Headphones, Loader2, CheckCircle,
  AlertCircle, Download, RotateCcw, X, History, RefreshCw,
  Search, ChevronLeft, ChevronRight, Eye,
} from "lucide-vue-next";
import {
  createJob, cancelJob, resumeJob, openEvents, fileUrl, listJobs, getJob,
  AudiobookApiError,
  type JobInfo, type JobProgress, type JobPhase, type JobStatus, type JobSummary,
} from "./audiobook-api";
import { processText, decodeText } from "../../lib/text";

// --- 后端枚举（与 routes/jobs.ts 校验对齐） ---
const VOICES = [
  { value: "zh-CN-YunxiNeural", label: "云希（男声）" },
  { value: "zh-CN-XiaoxiaoNeural", label: "晓晓（女声）" },
  { value: "zh-CN-YunjianNeural", label: "云健（男声）" },
];
const BITRATES = ["32k", "64k", "128k"];
const COVER_MAX_BYTES = 2 * 1024 * 1024;
const TITLE_MAX = 200;

type Status = "form" | "creating" | "processing" | "done" | "failed" | "canceled";

// --- 表单状态（全部内存态，不使用 localStorage） ---
const status = ref<Status>("form");
const isDragging = ref(false);
const textFile = ref<File | null>(null);
const title = ref("");
const author = ref("");
const voice = ref(VOICES[0].value);
const bitrate = ref("64k");
const ratePct = ref(0);
const pitchHz = ref(0);
const coverFile = ref<File | null>(null);
const coverPreview = ref("");
const formError = ref("");

// --- 文本分片校对状态 ---
const chunks = ref<TTSChunk[]>([]);
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = 5;

// --- 对话框详细编辑状态 ---
const activeEditChunk = ref<TTSChunk | null>(null);
const activeEditText = ref("");
const activeEditTitle = ref("");

const openEditModal = (chunk: TTSChunk) => {
  activeEditChunk.value = chunk;
  activeEditText.value = chunk.text;
  activeEditTitle.value = chunk.chapterTitle;
};

const closeEditModal = () => {
  activeEditChunk.value = null;
  activeEditText.value = "";
  activeEditTitle.value = "";
};

const saveEditModal = () => {
  if (activeEditChunk.value) {
    const oldTitle = activeEditChunk.value.chapterTitle;
    const newTitle = activeEditTitle.value.trim();
    if (newTitle && newTitle !== oldTitle) {
      const targetIdx = activeEditChunk.value.chapterIndex;
      for (const c of chunks.value) {
        if (c.chapterIndex === targetIdx) {
          c.chapterTitle = newTitle;
        }
      }
    }

    activeEditChunk.value.text = activeEditText.value;
    activeEditChunk.value.charCount = activeEditText.value.replace(/\s/g, "").length;
  }
  closeEditModal();
};

const truncateText = (text: string, len = 120): string => {
  if (text.length <= len) return text;
  return text.substring(0, len) + "...";
};

const filteredChunks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return chunks.value;
  return chunks.value.filter(
    (c) =>
      c.text.toLowerCase().includes(q) ||
      c.chapterTitle.toLowerCase().includes(q),
  );
});

const totalPages = computed(() => {
  return Math.ceil(filteredChunks.value.length / itemsPerPage) || 1;
});

const paginatedChunks = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredChunks.value.slice(start, start + itemsPerPage);
});

watch(searchQuery, () => {
  currentPage.value = 1;
});

// --- 任务状态 ---
const jobId = ref("");
const errorMsg = ref("");
const progress = ref<JobProgress>({
  phase: "preprocess",
  ttsChunks: { done: 0, total: 0 },
  transcodeChunks: { done: 0, total: 0 },
});
let closeEvents: (() => void) | null = null;

// --- 历史任务列表 ---
const showList = ref(false);
const jobs = ref<JobSummary[]>([]);
const listLoading = ref(false);
const listError = ref("");

// --- 派生值 ---
const rate = computed(() => `${ratePct.value >= 0 ? "+" : ""}${ratePct.value}%`);
const pitch = computed(() => `${pitchHz.value >= 0 ? "+" : ""}${pitchHz.value}Hz`);
const canSubmit = computed(() => !!textFile.value && !!title.value.trim());

const PHASE_LABELS: Record<JobPhase, string> = {
  preprocess: "正在预处理文本...",
  tts: "正在合成语音...",
  mux: "正在合并打包...",
  validating: "正在校验输出...",
  ready: "即将完成...",
};
const phaseLabel = computed(() => PHASE_LABELS[progress.value.phase] ?? "处理中...");

const pct = (done: number, total: number): number =>
  total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
const ttsPct = computed(() => pct(progress.value.ttsChunks.done, progress.value.ttsChunks.total));
const transcodePct = computed(() =>
  pct(progress.value.transcodeChunks.done, progress.value.transcodeChunks.total),
);

// --- 文件处理 ---
const acceptTextFile = (file: File): boolean => {
  if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
    formError.value = "仅支持 .txt 纯文本文件";
    return false;
  }
  formError.value = "";
  textFile.value = file;
  if (!title.value.trim()) title.value = file.name.replace(/\.[^/.]+$/, "");
  const reader = new FileReader();
  reader.onload = (ctx) => {
    const result = ctx.target?.result;
    if (!(result instanceof ArrayBuffer)) return;
    try {
      // 按编码解码（兼容 GBK/GB18030），再做客户端预校验，提前暴露章节检测失败
      const decoded = decodeText(result);
      const parsedChunks = processText(decoded);
      chunks.value = parsedChunks;
      currentPage.value = 1;
      searchQuery.value = "";
    } catch (err) {
      formError.value = err instanceof Error ? err.message : "文本预处理失败";
      textFile.value = null; // 阻止提交无效文件
      chunks.value = [];
    }
  };
  reader.onerror = () => {
    formError.value = "文件读取失败，请重试";
    textFile.value = null;
    chunks.value = [];
  };
  reader.readAsArrayBuffer(file);
  return true;
};

const handleTextChange = (e: Event): void => {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) acceptTextFile(input.files[0]);

};

const handleDrop = (e: DragEvent): void => {
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) acceptTextFile(file);
};

const handleCoverChange = (e: Event): void => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    formError.value = "封面必须是 jpg/png 图片";
    return;
  }
  if (file.size > COVER_MAX_BYTES) {
    formError.value = "封面大小不能超过 2MB";
    return;
  }
  formError.value = "";
  coverFile.value = file;
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value);
  coverPreview.value = URL.createObjectURL(file);
};

const clearCover = (): void => {
  coverFile.value = null;
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value);
  coverPreview.value = "";
};

// --- 客户端预校验（对齐后端枚举/正则） ---
const validate = (): boolean => {
  if (!textFile.value) {
    formError.value = "请先上传 TXT 文件";
    return false;
  }
  const t = title.value.trim();
  if (!t) {
    formError.value = "书名为必填项";
    return false;
  }
  if (t.length > TITLE_MAX) {
    formError.value = `书名长度不能超过 ${TITLE_MAX}`;
    return false;
  }
  if (!/^[+-]\d+%$/.test(rate.value) || !/^[+-]\d+Hz$/.test(pitch.value)) {
    formError.value = "语速 / 音高格式非法";
    return false;
  }
  formError.value = "";
  return true;
};

// --- SSE 订阅 ---
const subscribe = (id: string): void => {
  closeEvents?.();
  closeEvents = openEvents(id, {
    onProgress: (info: JobInfo) => {
      progress.value = info.progress;
    },
    onStatus: (ev) => {
      if (ev.status === "done") {
        status.value = "done";
      } else if (ev.status === "failed") {
        errorMsg.value = ev.error ?? "未知错误";
        status.value = "failed";
      } else if (ev.status === "canceled") {
        status.value = "canceled";
      }
      closeEvents?.();
      closeEvents = null;
    },
  });
};

// --- 动作 ---
const submit = async (): Promise<void> => {
  if (!validate() || !textFile.value) return;
  status.value = "creating";
  errorMsg.value = "";
  try {
    const form = new FormData();

    // 如果有解析编辑的分片，使用分片内容重构文本文件进行上传
    let fileToUpload = textFile.value;
    if (chunks.value.length > 0) {
      let reconstructedText = "";
      let currentChapterIdx = -1;
      for (const chunk of chunks.value) {
        if (chunk.chapterIndex !== currentChapterIdx) {
          currentChapterIdx = chunk.chapterIndex;
          reconstructedText += `\n\n${chunk.chapterTitle}\n\n`;
        } else {
          reconstructedText += "\n";
        }
        reconstructedText += chunk.text;
      }
      const blob = new Blob([reconstructedText], { type: "text/plain" });
      fileToUpload = new File([blob], textFile.value.name, { type: "text/plain" });
    }

    form.append("text", fileToUpload, fileToUpload.name);
    form.append("title", title.value.trim());
    if (author.value.trim()) form.append("author", author.value.trim());
    form.append("ttsEngine", "edge-tts");
    form.append("voice", voice.value);
    form.append("rate", rate.value);
    form.append("pitch", pitch.value);
    form.append("bitrate", bitrate.value);
    if (coverFile.value) form.append("cover", coverFile.value, coverFile.value.name);

    const result = await createJob(form);
    jobId.value = result.jobId;
    progress.value = { phase: "preprocess", ttsChunks: { done: 0, total: 0 }, transcodeChunks: { done: 0, total: 0 } };
    status.value = "processing";
    subscribe(result.jobId);
  } catch (err) {
    const e = err as AudiobookApiError;
    errorMsg.value =
      e.statusCode === 503
        ? "已达最大并发任务数，请稍后重试"
        : e.message || "提交失败，请检查网络与服务";
    status.value = "failed";
  }
};

const cancel = async (): Promise<void> => {
  if (!jobId.value) return;
  try {
    await cancelJob(jobId.value);
  } catch {
    // 取消失败也走 canceled 视图，用户可重新开始
  }
  closeEvents?.();
  closeEvents = null;
  status.value = "canceled";
};

const resume = async (): Promise<void> => {
  if (!jobId.value) return;
  status.value = "creating";
  errorMsg.value = "";
  try {
    const info = await resumeJob(jobId.value);
    progress.value = info.progress;
    status.value = "processing";
    subscribe(jobId.value);
  } catch (err) {
    const e = err as AudiobookApiError;
    errorMsg.value = e.message || "恢复失败";
    status.value = "failed";
  }
};

const download = (id: string, name: string): void => {
  if (!id) return;
  const link = document.createElement("a");
  link.href = fileUrl(id);
  link.download = `${name.trim() || "audiobook"}.m4b`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const reset = (): void => {
  closeEvents?.();
  closeEvents = null;
  status.value = "form";
  jobId.value = "";
  errorMsg.value = "";
  formError.value = "";
  textFile.value = null;
  title.value = "";
  author.value = "";
  ratePct.value = 0;
  pitchHz.value = 0;
  clearCover();
  chunks.value = [];
  searchQuery.value = "";
  currentPage.value = 1;
};

// --- 历史任务面板 ---
const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "排队中",
  running: "进行中",
  done: "已完成",
  failed: "失败",
  canceled: "已取消",
};
const STATUS_BADGE: Record<JobStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  done: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
  failed: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  canceled: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
};
const isActive = (s: JobStatus): boolean => s === "pending" || s === "running";
const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const loadList = async (): Promise<void> => {
  listLoading.value = true;
  listError.value = "";
  try {
    jobs.value = await listJobs();
  } catch (err) {
    listError.value = (err as AudiobookApiError).message || "加载任务列表失败";
  } finally {
    listLoading.value = false;
  }
};

const toggleList = (): void => {
  showList.value = !showList.value;
  if (showList.value) void loadList();
};

const closeList = (): void => {
  showList.value = false;
};

/** 从列表打开某任务：拉详情并切到对应状态机视图，活跃任务订阅 SSE。 */
const openJob = async (job: JobSummary): Promise<void> => {
  closeEvents?.();
  closeEvents = null;
  try {
    const info = await getJob(job.jobId);
    jobId.value = info.jobId;
    title.value = info.title;
    progress.value = info.progress;
    errorMsg.value = info.error ?? "";
    showList.value = false;
    if (info.status === "pending" || info.status === "running") {
      status.value = "processing";
      subscribe(info.jobId);
    } else {
      status.value = info.status; // done / failed / canceled
    }
  } catch (err) {
    listError.value = (err as AudiobookApiError).message || "打开任务失败";
  }
};

/** 列表行内取消活跃任务，成功后刷新列表。 */
const cancelFromList = async (job: JobSummary): Promise<void> => {
  try {
    await cancelJob(job.jobId);
  } catch {
    // 取消失败忽略，刷新后以服务端状态为准
  }
  await loadList();
};

/** 列表行内恢复 failed/canceled 任务，成功后刷新列表。 */
const resumeFromList = async (job: JobSummary): Promise<void> => {
  try {
    await resumeJob(job.jobId);
  } catch (err) {
    listError.value = (err as AudiobookApiError).message || "恢复失败";
  }
  await loadList();
};

onUnmounted(() => {
  closeEvents?.();
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value);
});
</script>
