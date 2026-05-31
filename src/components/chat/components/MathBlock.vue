<script lang="ts" setup>
import { computed } from "vue";
import { renderToString } from "katex";

const props = withDefaults(
  defineProps<{
    formula: string;
    displayMode?: boolean;
  }>(),
  {
    displayMode: false,
  }
);

const renderedMath = computed(() => {
  try {
    return renderToString(props.formula, {
      throwOnError: false,
      displayMode: props.displayMode,
    });
  } catch (err: any) {
    console.error("KaTeX rendering error:", err);
    return `<span class="text-red-500 font-mono text-xs cursor-help" title="${err.message}">⚠ Formula Error</span>`;
  }
});
</script>

<template>
  <div 
    v-if="displayMode" 
    class="katex-block-wrapper my-4 py-2 overflow-x-auto text-center w-full max-w-full"
    v-html="renderedMath"
  ></div>
  <span 
    v-else 
    class="katex-inline-wrapper px-1 inline-block align-middle"
    v-html="renderedMath"
  ></span>
</template>
