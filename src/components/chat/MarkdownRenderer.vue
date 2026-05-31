<script lang="ts" setup>
import { ref, watch, onUnmounted, computed, h, type VNode } from "vue";
import MarkdownIt from "markdown-it";
import markdownItKatex from "@traptitech/markdown-it-katex";
import "katex/dist/katex.min.css";

// Import custom sub-components
import CodeBlock from "./components/CodeBlock.vue";
import MathBlock from "./components/MathBlock.vue";
import ThoughtBlock from "./components/ThoughtBlock.vue";
import ToolBlock from "./components/ToolBlock.vue";

const { content, isStreaming = false } = defineProps<{
  content: string;
  isStreaming?: boolean;
}>();

// 1. Throttled content rendering
const displayContent = ref(content);
let frameId: number | null = null;
let lastUpdateTime = 0;
let pendingContent = "";
const THROTTLE_MS = 60; // Max ~16 updates per second during stream

const startLoop = () => {
  if (frameId !== null) return;

  const tick = () => {
    const now = performance.now();
    if (now - lastUpdateTime >= THROTTLE_MS) {
      displayContent.value = pendingContent;
      lastUpdateTime = now;
    }

    if (isStreaming || displayContent.value !== pendingContent) {
      frameId = requestAnimationFrame(tick);
    } else {
      frameId = null;
    }
  };

  frameId = requestAnimationFrame(tick);
};

watch(
  [() => content, () => isStreaming],
  ([newContent, newStreaming]) => {
    pendingContent = newContent;

    if (!newStreaming) {
      displayContent.value = newContent;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      return;
    }

    startLoop();
  },
  { immediate: true }
);

onUnmounted(() => {
  if (frameId !== null) cancelAnimationFrame(frameId);
});

// 2. Initialize markdown-it with KaTeX plugin
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

md.use(markdownItKatex);

// 3. Helper to format VNode properties and apply Tailwind classes
function getPropsForToken(token: any): any {
  const props: any = {};
  if (token.attrs) {
    for (const [name, val] of token.attrs) {
      props[name] = val;
    }
  }

  const tag = token.tag;
  let classes = "";

  if (tag === "a") {
    classes = "text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-150";
    if (props.href && props.href.trim().toLowerCase().startsWith("javascript:")) {
      props.href = "#";
    }
    props.target = "_blank";
    props.rel = "noopener noreferrer";
  } else if (tag === "blockquote") {
    classes = "border-l-4 border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 px-4 py-2.5 my-4 rounded-r-xl text-zinc-600 dark:text-zinc-400 italic text-left";
  } else if (tag === "table") {
    classes = "block overflow-x-auto w-full border-collapse border border-zinc-200 dark:border-zinc-800/60 my-4 rounded-xl shadow-sm text-sm";
  } else if (tag === "th") {
    classes = "border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100";
  } else if (tag === "td") {
    classes = "border border-zinc-200 dark:border-zinc-800/60 px-4 py-2 text-zinc-700 dark:text-zinc-300";
  } else if (tag === "h1") {
    classes = "text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-1.5 text-left";
  } else if (tag === "h2") {
    classes = "text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-5 mb-2.5 text-left";
  } else if (tag === "h3") {
    classes = "text-base font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 text-left";
  } else if (tag === "ul") {
    classes = "list-disc pl-6 mb-4 space-y-1 text-left";
  } else if (tag === "ol") {
    classes = "list-decimal pl-6 mb-4 space-y-1 text-left";
  } else if (tag === "li") {
    classes = "text-zinc-800 dark:text-zinc-200 text-left";
  } else if (tag === "p") {
    classes = "text-zinc-800 dark:text-zinc-200 mb-3 leading-relaxed text-left";
  } else if (tag === "hr") {
    classes = "my-6 border-t border-zinc-200 dark:border-zinc-800/80";
  }

  if (classes) {
    props.class = props.class ? `${props.class} ${classes}` : classes;
  }

  return props;
}

// 4. Render code blocks or custom thoughts/tools cards
function renderFenceToken(token: any): VNode {
  const code = token.content;
  const lang = (token.info || "").trim().toLowerCase();

  if (lang === "thought") {
    return h(ThoughtBlock, { content: code });
  }

  if (lang.startsWith("call:")) {
    const toolName = lang.substring(5);
    return h(ToolBlock, { toolName, args: code });
  }

  return h(CodeBlock, { code, lang });
}

// 5. Build inline tokens VNodes recursively using a stack
function renderInlineTokens(inlineTokens: any[]): any[] {
  const rootChildren: any[] = [];
  const stack: any[] = [{ children: rootChildren }];

  for (let i = 0; i < inlineTokens.length; i++) {
    const token = inlineTokens[i];
    const type = token.type;

    if (type.endsWith("_open")) {
      const tag = token.tag;
      const props = getPropsForToken(token);
      const node = { tag, props, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (type.endsWith("_close")) {
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (type === "code_inline") {
      stack[stack.length - 1].children.push({
        tag: "code",
        props: { class: "bg-zinc-100 dark:bg-zinc-800/80 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono text-[0.85em]" },
        children: [token.content],
      });
    } else if (type === "math_inline") {
      const mathVNode = h(MathBlock, { formula: token.content, displayMode: false });
      stack[stack.length - 1].children.push(mathVNode);
    } else if (type === "text") {
      stack[stack.length - 1].children.push(token.content);
    } else if (type === "softbreak" || type === "hardbreak") {
      stack[stack.length - 1].children.push({ tag: "br", props: {}, children: [] });
    } else if (type === "html_inline") {
      const content = token.content.trim().toLowerCase();
      if (content === "<br>" || content === "<br />") {
        stack[stack.length - 1].children.push({ tag: "br", props: {}, children: [] });
      } else {
        stack[stack.length - 1].children.push(token.content);
      }
    }
  }

  return rootChildren;
}

// 6. Convert Tree nodes to real Vue VNodes
function convertToVNode(node: any): any {
  if (typeof node === "string") {
    return node;
  }
  if (node.__v_isVNode) {
    return node;
  }

  const children = (node.children || []).map((child: any) => convertToVNode(child));
  return h(node.tag, node.props || {}, children);
}

// 7. Parse Markdown tokens into VNodes tree
function tokensToVNodes(tokens: any[]): VNode[] {
  const root: any = { tag: "div", props: {}, children: [] };
  const stack: any[] = [root];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const type = token.type;

    if (type.endsWith("_open")) {
      const tag = token.tag;
      const props = getPropsForToken(token);
      const node = { tag, props, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (type.endsWith("_close")) {
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (type === "inline") {
      if (token.children) {
        const inlineVNodes = renderInlineTokens(token.children);
        stack[stack.length - 1].children.push(...inlineVNodes);
      } else {
        stack[stack.length - 1].children.push(token.content);
      }
    } else if (type === "fence") {
      const codeBlockVNode = renderFenceToken(token);
      stack[stack.length - 1].children.push(codeBlockVNode);
    } else if (type === "math_block") {
      const mathVNode = h(MathBlock, { formula: token.content, displayMode: true });
      stack[stack.length - 1].children.push(mathVNode);
    } else if (type === "hr") {
      const hrNode = { tag: "hr", props: getPropsForToken(token), children: [] };
      stack[stack.length - 1].children.push(hrNode);
    } else if (type === "html_block") {
      const content = token.content.trim().toLowerCase();
      if (content === "<hr>" || content === "<hr />") {
        const hrNode = { tag: "hr", props: getPropsForToken({ tag: "hr" }), children: [] };
        stack[stack.length - 1].children.push(hrNode);
      } else {
        stack[stack.length - 1].children.push(token.content);
      }
    } else if (token.content) {
      stack[stack.length - 1].children.push(token.content);
    }
  }

  return root.children.map((child: any) => convertToVNode(child));
}

// 8. Computed markdown-it token array
const tokens = computed(() => {
  let processed = displayContent.value;
  // Preprocess XML thought tags
  processed = processed.replace(/<thought>([\s\S]*?)<\/thought>/gi, "\n\n```thought\n$1\n```\n\n");
  processed = processed.replace(/<thought>([\s\S]*)$/i, "\n\n```thought\n$1\n```\n\n");

  try {
    return md.parse(processed, {});
  } catch (err) {
    console.error("Markdown-it parse error:", err);
    return [];
  }
});

// Local functional component to render VNodes tree in template
const RenderVNodes = () => {
  return tokensToVNodes(tokens.value);
};
</script>

<template>
  <div class="markdown-content text-left leading-relaxed text-zinc-800 dark:text-zinc-200">
    <RenderVNodes />
  </div>
</template>
