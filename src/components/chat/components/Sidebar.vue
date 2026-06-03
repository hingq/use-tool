<script lang="ts" setup>
import { ref, computed } from "vue";
import { MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight } from "lucide-vue-next";

interface Session {
  id: string;
  session_id?: string;
  model?: string;
  preview?: string;
  title?: string;
  timestamp?: number;
  updated_at?: number;
  tokens?: number;
}

const props = defineProps<{
  sessions: Session[];
  activeSessionId: string;
  isSidebarOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "delete", id: string): void;
  (e: "new-chat"): void;
  (e: "toggle-sidebar"): void;
}>();

// Helper to format timestamps nicely (e.g. "刚刚", "5分钟前", "14:32", "昨天")
const formatTime = (timestamp?: number) => {
  if (!timestamp) return "";

  // Handle both second and millisecond timestamps
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (diffHours < 48 && new Date(now.getTime() - 86400000).getDate() === date.getDate()) {
    return "昨天";
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Robust helper to get the title of the session
const getSessionTitle = (session: Session) => {
  return session.preview || session.title || "新会话";
};

// Robust helper to get session ID
const getSessionId = (session: Session) => {
  return session.id || session.session_id || "";
};
</script>

<template>
  <!-- Backdrop for mobile drawer mode -->
  <Transition enter-active-class="transition-opacity duration-350 ease-out" enter-from-class="opacity-0"
    enter-to-class="opacity-100" leave-active-class="transition-opacity duration-250 ease-in"
    leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="isSidebarOpen" class="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs md:hidden"
      @click="emit('toggle-sidebar')"></div>
  </Transition>

  <!-- Sidebar Outer Wrapper (controls layout space on desktop) -->
  <div class="fixed md:relative inset-y-0 left-0 z-45  shrink-0 transition-[width] duration-350 ease-in-out  h-screen"
    :class="[
      isSidebarOpen ? 'w-64' : 'w-0'
    ]">
    <!-- Close-state Side Expand Button (floating on the left side) -->
    <Transition enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 -translate-x-4"
      enter-to-class="opacity-100 translate-x-0" leave-active-class="transition-all duration-250 ease-in"
      leave-from-class="opacity-100 translate-x-0" leave-to-class="opacity-0 -translate-x-4">
      <div v-if="!isSidebarOpen" class="absolute left-4 top-3 md:top-3.5 z-50">
        <button @click="emit('toggle-sidebar')"
          class="p-2 hover:bg-[#ecebe5] dark:hover:bg-[#2a2a27] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-[#f3f2ee] rounded-lg cursor-pointer transition-all duration-200 border border-[#e6e6e2] dark:border-[#2d2d2a] bg-[#f9f9f6]/95 dark:bg-[#181816]/95 shadow-xs hover:shadow flex items-center justify-center active:scale-95"
          title="展开侧边栏">
          <PanelLeftOpen class="h-4 w-4" />
        </button>
      </div>
    </Transition>

    <!-- Inner Fixed-Width Container -->
    <aside
      class="absolute top-0 left-0 w-64 h-full flex flex-col bg-[#f9f9f6]/95 dark:bg-[#181816]/95 border-r border-[#e6e6e2]/80 dark:border-[#2d2d2a]/80 backdrop-blur-md select-none shadow-lg md:shadow-none transition-transform duration-350 ease-in-out"
      :class="[
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]">
      <!-- Header with logo and collapse button -->
      <div class="flex items-center justify-between p-4 border-b border-[#e6e6e2]/60 dark:border-[#2d2d2a]/60 shrink-0">
        <span class="text-xs font-bold font-mono tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">历史会话</span>
        <button @click="emit('toggle-sidebar')"
          class="hidden md:inline-flex p-1.5 hover:bg-[#ecebe5] dark:hover:bg-[#2a2a27] text-zinc-500 hover:text-zinc-800 dark:hover:text-[#f3f2ee] rounded-lg cursor-pointer transition-colors"
          title="关闭侧边栏">
          <PanelLeftClose class="h-4 w-4" />
        </button>
      </div>

      <!-- New Chat Button -->
      <div class="p-3 shrink-0">
        <button @click="emit('new-chat')"
          class="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#1f1f1e] hover:bg-[#333331] text-[#f9f9f6] dark:bg-[#f3f2ee] dark:hover:bg-[#e4e3de] dark:text-[#181816] border border-zinc-200/10 dark:border-zinc-800/10 rounded-xl font-medium text-xs shadow-md shadow-zinc-950/5 dark:shadow-white/5 active:scale-98 transition-all duration-200 cursor-pointer">
          <Plus class="h-4 w-4" />
          <span>开启新会话</span>
        </button>
      </div>

      <!-- Scrollable session list -->
      <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-1 scrollbar-thin">
        <div v-if="sessions.length === 0" class="text-center py-8 px-4 text-xs text-zinc-400 dark:text-zinc-500">
          暂无历史会话记录
        </div>
        <div v-for="session in sessions" :key="getSessionId(session)"
          class="group relative flex items-center w-full rounded-xl transition-all duration-250 ease-out" :class="[
            activeSessionId === getSessionId(session)
              ? 'bg-[#ecebe5] dark:bg-[#2a2a27] text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-[#f2f1eb]/70 dark:hover:bg-[#232320]/70 hover:text-zinc-900 dark:hover:text-zinc-100'
          ]">
          <!-- Selection Button Area -->
          <button @click="emit('select', getSessionId(session))"
            class="flex-1 flex items-start space-x-3 p-3 text-left min-w-0 rounded-l-xl cursor-pointer">
            <MessageSquare
              class="h-4 w-4 mt-0.5 shrink-0 text-zinc-400/80 group-hover:text-zinc-500 dark:group-hover:text-zinc-300" />
            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="text-xs truncate leading-snug">
                {{ getSessionTitle(session) }}
              </div>
              <div class="flex items-center space-x-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                <span class="truncate max-w-[85px]">{{ session.model }}</span>
                <span class="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                <span>{{ formatTime(session.timestamp || session.updated_at) }}</span>
              </div>
            </div>
          </button>

          <!-- Delete Action Button (Claude minimal style) -->
          <button @click.stop="emit('delete', getSessionId(session))"
            class="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:translate-x-2 md:group-hover:translate-x-0 p-2 mr-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-all duration-250 ease-out cursor-pointer active:scale-90"
            title="删除会话">
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Claude-style Hover Rail/Handle for Desktop (Attached to right edge of the outer wrapper) -->
    <div
      class="md:flex absolute top-0 bottom-0 z-50 items-center justify-center group/rail cursor-pointer transition-all duration-350 ease-in-out"
      :class="isSidebarOpen ? '-right-3 w-6' : '-right-4 w-8'" @click="emit('toggle-sidebar')">
      <!-- Vertical Highlight Line -->
      <div
        class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-zinc-300/60 dark:bg-zinc-800 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-250 ease-out">
      </div>

      <!-- Toggle Button Capsule -->
      <div
        class="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#e6e6e2] dark:border-[#2d2d2a] bg-white dark:bg-[#181816] shadow-md opacity-0 group-hover/rail:opacity-100 hover:scale-105 active:scale-95 transition-all duration-250 ease-out">
        <component :is="isSidebarOpen ? ChevronLeft : ChevronRight"
          class="h-4 w-4 text-zinc-500 hover:text-zinc-800 dark:hover:text-[#f3f2ee]" />
      </div>
    </div>
  </div>
</template>
