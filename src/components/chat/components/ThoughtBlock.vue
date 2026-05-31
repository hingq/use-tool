<script lang="ts" setup>
import { ref, computed } from "vue";
import { ChevronDown, MessageSquare } from "lucide-vue-next";

const props = defineProps<{
  content: string;
}>();

const isCollapsed = ref(true);

const contentLines = computed(() => {
  return props.content.split("\n");
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};
</script>

<template>
  <div class="agent-thought-card border border-amber-200/60 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/5 rounded-xl my-4 overflow-hidden shadow-sm transition-all duration-300">
    <!-- Header -->
    <div 
      @click="toggleCollapse"
      class="agent-thought-header flex items-center justify-between px-4 py-2.5 bg-amber-100/30 dark:bg-amber-900/10 border-b border-amber-200/40 cursor-pointer select-none"
    >
      <div class="flex items-center space-x-2 text-amber-700 dark:text-amber-400 text-sm font-semibold">
        <MessageSquare class="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <span>Agent 思考过程</span>
      </div>
      <div class="flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-500 font-medium">
        <span>{{ isCollapsed ? '展开' : '收起' }}</span>
        <ChevronDown 
          class="w-3.5 h-3.5 transform transition-transform duration-200" 
          :class="!isCollapsed ? 'rotate-180' : ''" 
        />
      </div>
    </div>
    
    <!-- Collapsible Body -->
    <div 
      v-show="!isCollapsed"
      class="agent-thought-body p-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed border-t border-amber-100/20 max-h-96 overflow-y-auto space-y-1 text-left"
    >
      <div v-for="(line, idx) in contentLines" :key="idx" class="min-h-5 whitespace-pre-wrap">
        {{ line }}
      </div>
    </div>
  </div>
</template>
