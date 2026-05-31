<script lang="ts" setup>
import { ref, computed } from "vue";
import hljs from "highlight.js";
import { Check, Copy } from "lucide-vue-next";
import "highlight.js/styles/github-dark.css";

const props = withDefaults(
  defineProps<{
    code: string;
    lang?: string;
  }>(),
  {
    lang: "plaintext",
  }
);

const copied = ref(false);

const highlightedCode = computed(() => {
  const language = props.lang.trim().toLowerCase();
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(props.code, { language }).value;
    } catch (e) {
      console.error("Highlight.js error:", e);
    }
  }
  
  // Safe HTML escape fallback
  return props.code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
});

const handleCopy = async () => {
  if (copied.value) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(props.code);
    } else {
      // Fallback copy method for non-secure HTTP sources
      const textArea = document.createElement("textarea");
      textArea.value = props.code;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy code:", err);
  }
};
</script>

<template>
  <div class="code-block-container relative border border-zinc-200/80 dark:border-zinc-800 rounded-xl my-4 overflow-hidden bg-zinc-950 text-zinc-200 shadow-md">
    <!-- Header panel -->
    <div class="code-block-header flex items-center justify-between px-4 py-2 bg-zinc-900 text-xs text-zinc-400 border-b border-zinc-800 font-medium select-none">
      <span class="font-mono text-zinc-300">{{ lang }}</span>
      
      <button 
        @click="handleCopy" 
        class="copy-code-btn flex items-center space-x-1 hover:text-white transition-colors duration-200 cursor-pointer"
        :class="copied ? 'text-emerald-400 hover:text-emerald-400' : ''"
      >
        <Check v-if="copied" class="h-3.5 w-3.5 text-emerald-400" />
        <Copy v-else class="h-3.5 w-3.5" />
        <span>{{ copied ? '已复制' : '复制' }}</span>
      </button>
    </div>
    
    <!-- Code display -->
    <pre class="p-4 overflow-x-auto text-xs font-mono leading-relaxed"><code :class="'hljs language-' + lang" v-html="highlightedCode"></code></pre>
  </div>
</template>
