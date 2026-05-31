<script lang="ts" setup>
import { computed } from "vue";
import { Wrench } from "lucide-vue-next";

const props = defineProps<{
  toolName: string;
  args: string;
}>();

const formattedArgs = computed(() => {
  try {
    const parsed = JSON.parse(props.args);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return props.args;
  }
});
</script>

<template>
  <div class="agent-tool-card border border-blue-200/60 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/5 rounded-xl my-4 overflow-hidden shadow-sm transition-all duration-300">
    <!-- Header -->
    <div class="agent-tool-header flex items-center justify-between px-4 py-2.5 bg-blue-100/30 dark:bg-blue-900/10 border-b border-blue-200/40 select-none">
      <div class="flex items-center space-x-2 text-blue-700 dark:text-blue-400 text-sm font-semibold">
        <Wrench class="h-4 w-4 text-blue-600 dark:text-blue-500" />
        <span>调用工具: <code class="bg-blue-100/80 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-xs font-mono font-bold">{{ toolName }}</code></span>
      </div>
      <div class="flex items-center space-x-1.5 text-xs text-blue-600 dark:text-blue-500 font-medium">
        <span class="status-dot h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="status-text">已完成</span>
      </div>
    </div>
    
    <!-- Arguments display -->
    <pre class="agent-tool-body p-4 text-xs font-mono bg-zinc-50/50 dark:bg-black/10 text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre text-left"><code>{{ formattedArgs }}</code></pre>
  </div>
</template>
