<script lang="ts" setup>
import { Sparkles, Sun, Moon } from "lucide-vue-next";

defineProps<{
  isConnecting: boolean;
  isStreaming: boolean;
  isDark: boolean;
  isSidebarOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "toggleTheme"): void;
}>();
</script>

<template>
  <header class="w-full border-b border-zinc-200/40 dark:border-zinc-800/40 bg-transparent select-none">
    <div
      class="max-w-3xl mx-auto w-full flex items-center justify-between px-3 py-2 md:px-4 md:py-3 transition-[padding] duration-350 ease-in-out"
      :class="[!isSidebarOpen ? 'pl-14 md:pl-4' : '']"
    >
      <div class="flex items-center space-x-2">
        <span
          class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[10px] md:text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full flex items-center shadow-sm">
          <Sparkles class="h-3 md:h-4 w-3 md:w-4 mr-1 md:mr-1.5 text-blue-500 animate-pulse" />
          Hermes Agent 2.5
        </span>
      </div>

      <div class="flex items-center space-x-3 text-[10px] md:text-xs text-zinc-400">
        <!-- Status Indicator -->
        <span v-if="isConnecting" class="flex items-center text-amber-500 font-medium">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping mr-1"></span>
          连接中
        </span>
        <span v-else-if="isStreaming" class="flex items-center text-emerald-500 font-medium">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
          生成中
        </span>
        <span v-else class="flex items-center text-zinc-400">
          <span class="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 mr-1"></span>
          就绪
        </span>

        <!-- Divider -->
        <span class="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800/60"></span>

        <!-- Theme Toggle Switch Pill -->
        <button @click="emit('toggleTheme')" type="button"
          class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] md:text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full flex items-center shadow-sm cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800/60 transition-all active:scale-95 duration-200"
          :title="isDark ? '切换至明亮模式' : '切换至暗黑模式'">
          <Sun v-if="isDark" class="h-3 md:h-4 w-3 md:w-4 mr-1 text-amber-500 animate-pulse" />
          <Moon v-else class="h-3 md:h-4 w-3 md:w-4 mr-1 text-blue-500" />
          <span>{{ isDark ? '暗黑模式' : '明亮模式' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>
