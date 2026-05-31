<template>
  <div class="w-full max-w-xl mx-auto px-4 py-8">
    <div
      class="relative overflow-hidden rounded-3xl border border-white/20 bg-white/40 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-black/30"
    >
      <!-- Background glowing orb -->
      <div
        class="absolute -top-12 -right-12 -z-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl"
      ></div>
      <div
        class="absolute -bottom-12 -left-12 -z-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl"
      ></div>

      <div class="mb-8 text-center">
        <h1
          class="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent dark:from-blue-400 dark:to-indigo-400"
        >
          TXT ➔ EPUB 转换器
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          智能章节解析，一键导出标准的 EPUB 3.0 格式电子书
        </p>
      </div>

      <!-- State: Idle -->
      <div
        v-if="status === 'idle'"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        class="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 cursor-pointer"
        :class="
          isDragging
            ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10'
            : 'border-muted-foreground/20 hover:border-blue-500/50 hover:bg-white/10 dark:hover:bg-white/5'
        "
      >
        <input
          id="file-upload"
          type="file"
          accept=".txt"
          class="hidden"
          @change="handleFileChange"
        />
        <label
          for="file-upload"
          class="absolute inset-0 w-full h-full cursor-pointer"
        ></label>

        <div
          class="mb-4 rounded-full bg-blue-50 p-4 text-blue-600 transition-transform duration-300 group-hover:scale-110 dark:bg-blue-950/40 dark:text-blue-400"
        >
          <Upload class="h-8 w-8" />
        </div>
        <h3 class="text-base font-semibold text-foreground">
          拖拽 TXT 文件到这里，或 <span class="text-blue-500">点击上传</span>
        </h3>
        <p class="mt-2 text-xs text-muted-foreground">
          仅支持 .txt 纯文本文件（将自动根据“第x章/第x回”等正则规则切分章节）
        </p>
      </div>

      <!-- State: Parsing / Generating -->
      <div
        v-else-if="status === 'parsing' || status === 'generating'"
        class="flex flex-col items-center justify-center py-10 text-center"
      >
        <div class="relative flex items-center justify-center mb-6">
          <!-- Spinning Loader outer -->
          <div
            class="h-16 w-16 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600"
          ></div>
          <!-- Centered book icon -->
          <BookOpen
            class="absolute h-6 w-6 text-blue-600 animate-pulse"
          />
        </div>

        <h3 class="text-lg font-semibold text-foreground">
          {{ status === 'parsing' ? '正在智能解析章节...' : '正在打包生成 EPUB...' }}
        </h3>
        <p class="mt-2 text-sm text-muted-foreground truncate max-w-xs">
          {{ fileName }}
        </p>
        <div class="mt-4 w-48 h-1.5 bg-muted rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 rounded-full animate-progress-bar"></div>
        </div>
      </div>

      <!-- State: Success -->
      <div
        v-else-if="status === 'success'"
        class="flex flex-col items-center justify-center py-6 text-center"
      >
        <div class="mb-4 rounded-full bg-green-50 p-4 text-green-600 dark:bg-green-950/40 dark:text-green-400">
          <CheckCircle class="h-10 w-10" />
        </div>
        <h3 class="text-lg font-semibold text-foreground">转换并导出成功！</h3>
        <p class="mt-2 text-sm text-muted-foreground">
          已成功提取出 <span class="font-semibold text-foreground">{{ chapterCount }}</span> 个章节，EPUB 文件已自动开始下载。
        </p>
        
        <div class="mt-4 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground truncate max-w-sm">
          <BookOpen class="h-3.5 w-3.5 flex-shrink-0" />
          <span class="truncate">{{ fileName.replace(/\.[^/.]+$/, "") }}.epub</span>
        </div>

        <button
          @click="reset"
          class="mt-8 flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/30"
        >
          转换新文件
        </button>
      </div>

      <!-- State: Error -->
      <div
        v-else-if="status === 'error'"
        class="flex flex-col items-center justify-center py-6 text-center"
      >
        <div class="mb-4 rounded-full bg-red-50 p-4 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle class="h-10 w-10" />
        </div>
        <h3 class="text-lg font-semibold text-foreground">导出失败</h3>
        <p class="mt-2 text-sm text-red-500 dark:text-red-400 max-w-md">
          {{ errorMsg }}
        </p>
        <button
          @click="reset"
          class="mt-8 flex items-center gap-2 rounded-xl bg-muted px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/80"
        >
          重新尝试
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { StreamTextSplitter, EpubBuilder } from "./epub";
import { Upload, BookOpen, CheckCircle, AlertCircle } from "lucide-vue-next";

// State variables
const status = ref<'idle' | 'parsing' | 'generating' | 'success' | 'error'>('idle');
const isDragging = ref(false);
const fileName = ref('');
const errorMsg = ref('');
const chapterCount = ref(0);

const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    await processFile(input.files[0]);
  }
};

const handleDrop = async (event: DragEvent) => {
  isDragging.value = false;
  if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0];
    if (file.name.endsWith('.txt') || file.type === 'text/plain') {
      await processFile(file);
    } else {
      status.value = 'error';
      errorMsg.value = '文件格式不正确，仅支持导入 TXT 文本文件';
    }
  }
};

const processFile = async (file: File) => {
  fileName.value = file.name;
  status.value = 'parsing';
  errorMsg.value = '';
  chapterCount.value = 0;

  try {
    // 1. Parse using StreamTextSplitter
    const splitter = new StreamTextSplitter(file);
    const chapters = await splitter.parse();
    chapterCount.value = chapters.length;

    if (chapters.length === 0) {
      throw new Error(
        "未能从 TXT 中提取出有效的章节。请检查章节标题是否包含“第X章”或“第X回”等格式（例如：第一章、第12章）。"
      );
    }

    status.value = 'generating';

    // 2. Build EPUB
    const title = file.name.replace(/\.[^/.]+$/, "");
    const author = "未知";

    const builder = new EpubBuilder({
      title,
      author,
      chapters,
    });

    const epubBlob = await builder.build();

    // 3. Trigger automatic download
    const url = URL.createObjectURL(epubBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.epub`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    status.value = 'success';
  } catch (err: any) {
    console.error("EPUB export error:", err);
    status.value = 'error';
    errorMsg.value = err.message || '导出过程中发生了未知错误';
  }
};

const reset = () => {
  status.value = 'idle';
  fileName.value = '';
  errorMsg.value = '';
  chapterCount.value = 0;
};
</script>

<style scoped>
@keyframes progress {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}

.animate-progress-bar {
  width: 100%;
  animation: progress 2s infinite ease-in-out;
}
</style>