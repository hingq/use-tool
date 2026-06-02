<script lang="ts" setup>
import { Play, RefreshCw } from "lucide-vue-next";

defineProps<{
  isStreaming: boolean;
  isConnecting: boolean;
}>();

const emit = defineEmits<{
  (e: "startSimulation"): void;
  (e: "clearHistory"): void;
}>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 max-w-2xl mx-auto mb-3 md:mb-4 select-none w-full">
    <!-- Card 1: Simulation -->
    <button @click="emit('startSimulation')" :disabled="isStreaming || isConnecting"
      class="flex items-start space-x-3 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md hover:border-blue-500/50 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 text-left transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none w-full">
      <div
        class="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
        <Play class="h-4 w-4 md:h-5 md:w-5 fill-current" />
      </div>
      <div class="min-w-0 flex-1">
        <div
          class="text-[11px] md:text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          运行模拟测试流</div>
        <div class="text-[9px] md:text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">验证 LaTeX 公式与 VNode
          代码 high-light</div>
      </div>
    </button>

    <!-- Card 2: Clear Session -->
    <button @click="emit('clearHistory')" :disabled="isStreaming || isConnecting"
      class="flex items-start space-x-3 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md hover:border-amber-500/50 hover:bg-amber-50/20 dark:hover:amber-950/10 text-left transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none w-full">
      <div
        class="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
        <RefreshCw class="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div class="min-w-0 flex-1">
        <div
          class="text-[11px] md:text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          清理会话历史</div>
        <div class="text-[9px] md:text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">重置上下文，清空缓存与消息
        </div>
      </div>
    </button>
  </div>
</template>
