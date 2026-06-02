<script lang="ts" setup>
import { ref, watch, nextTick } from "vue";
import { Send, Square } from "lucide-vue-next";

const props = defineProps<{
  modelValue: string;
  isStreaming: boolean;
  isConnecting: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", val: string): void;
  (e: "send"): void;
  (e: "stop"): void;
}>();

const inputRef = ref<HTMLTextAreaElement | null>(null);

// Adjust height dynamically based on content scroll height
const adjustHeight = () => {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = "auto";
  const newHeight = Math.min(el.scrollHeight, 160);
  el.style.height = `${newHeight}px`;
};

// Watch modelValue change to trigger resize
watch(
  () => props.modelValue,
  () => {
    nextTick(adjustHeight);
  }
);

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:modelValue", target.value);
};

const handleSend = () => {
  if (!props.modelValue.trim() || props.isStreaming || props.isConnecting) return;
  emit("send");
};

const handleBtnClick = () => {
  if (props.isStreaming || props.isConnecting) {
    emit("stop");
  } else {
    handleSend();
  }
};
</script>

<template>
  <div
    class="flex items-end space-x-2 md:space-x-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-[24px] md:rounded-3xl px-4 py-3 md:px-6 md:py-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-zinc-300 dark:focus-within:border-zinc-700 transition-all duration-300">

    <!-- Dynamic Textarea -->
    <textarea ref="inputRef" :value="modelValue" @input="handleInput" @keydown.enter.prevent="handleSend"
      placeholder="给 Hermes 发送消息，或输入 Prompt 测试 SSE..." rows="1"
      class="flex-1 resize-none bg-transparent outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 min-h-[24px] max-h-40 overflow-y-auto py-1.5 md:py-2 leading-relaxed"></textarea>

    <!-- Circular Send/Stop Button -->
    <div role="button" @click="handleBtnClick"
      class="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 mb-0.5"
      :class="[
        !(modelValue || '').trim() && !isStreaming && !isConnecting
          ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 opacity-50 pointer-events-none'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      ]"
      :title="isStreaming || isConnecting ? '停止生成' : '发送消息'">
      <Square v-if="isStreaming || isConnecting" class="h-4 w-4 fill-current text-white" />
      <Send v-else class="h-4 w-4" />
    </div>
  </div>
</template>
