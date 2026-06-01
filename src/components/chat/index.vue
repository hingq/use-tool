<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { Sparkles, Play, RefreshCw, ArrowDown, Paperclip, Mic, ArrowUp, Sun, Moon, Settings, X } from "lucide-vue-next";
import MarkdownRenderer from "./MarkdownRenderer.vue";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

// 1. Core State
const messages = ref<Message[]>([
  {
    id: "welcome",
    role: "assistant",
    content: `你好！我是 **Hermes Agent**。我已经升级了我的渲染引擎！
    
现在我支持由 **markdown-it** + **KaTeX** + **highlight.js** 强力驱动的纯虚拟 DOM（VNode）组件化渲染。您可以点击输入框上方的 **“运行模拟测试流”**，体验我为您准备的包含数学公式和工具调用的多模态文档。`,
  },
]);

const inputMsg = ref("");
const isConnecting = ref(false);
const isStreaming = ref(false);
const isUserScrolling = ref(false);
const isDark = ref(false);

const inputRef = ref<HTMLTextAreaElement | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

// API Service Settings (TODO(security): localStorage storage exposes API keys to XSS. Use BFF or HttpOnly cookies in production.)
const defaultApiKey = (import.meta.env.VITE_API_KEY as string) || (import.meta.env.VITE_HERMES_API_KEY as string) || "nev";
const apiEndpoint = ref(localStorage.getItem("hermes-api-endpoint") || "http://82.156.247.203:8080/v1");
const apiKey = ref(localStorage.getItem("hermes-api-key") || defaultApiKey);
const modelName = ref(localStorage.getItem("hermes-model-name") || "deepseek-v4-flash");
const systemPrompt = ref(localStorage.getItem("hermes-system-prompt") || "");
const conversationId = ref(localStorage.getItem("hermes-conversation-id") || `conv_${Date.now()}`);
const showSettings = ref(false);

// Ensure conversationId is stored
localStorage.setItem("hermes-conversation-id", conversationId.value);

const saveSettings = () => {
  localStorage.setItem("hermes-api-endpoint", apiEndpoint.value);
  localStorage.setItem("hermes-api-key", apiKey.value);
  localStorage.setItem("hermes-model-name", modelName.value);
  localStorage.setItem("hermes-system-prompt", systemPrompt.value);
  showSettings.value = false;
};

let abortController: AbortController | null = null;

// 2. Theme Toggling
const toggleTheme = () => {
  const doc = document as any;
  if (!doc.startViewTransition) {
    isDark.value = !isDark.value;
    localStorage.setItem("hermes-dark-theme", isDark.value ? "true" : "false");
    applyThemeClass();
    return;
  }

  doc.startViewTransition(() => {
    isDark.value = !isDark.value;
    localStorage.setItem("hermes-dark-theme", isDark.value ? "true" : "false");
    applyThemeClass();
  });
};

const applyThemeClass = () => {
  if (isDark.value) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

// 3. Textarea Auto-grow
const adjustHeight = () => {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = "auto";
  const newHeight = Math.min(el.scrollHeight, 160);
  el.style.height = `${newHeight}px`;
};

watch(inputMsg, () => {
  nextTick(adjustHeight);
});

// 4. Scroll Logic (Industry Standard - Snap to bottom only if already there)
const scrollToBottom = (force = false) => {
  nextTick(() => {
    const el = messagesContainer.value;
    if (!el) return;

    if (force || !isUserScrolling.value) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  });
};

const handleScroll = (event: Event) => {
  const el = event.target as HTMLElement;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

  // 核心逻辑：只要向上滑动超过 10px，就判定为“用户手动浏览历史”，立即锁死自动滚动，交出控制权
  if (distanceFromBottom > 15) {
    isUserScrolling.value = true;
  } else {
    // 只有重新贴回底部（15px内）时，才释放锁定，恢复自动跟随
    isUserScrolling.value = false;
  }
};

const resetScrollState = () => {
  isUserScrolling.value = false;
  scrollToBottom(true);
};

// 5. Connect to Real SSE Service (using POST stream fetch)
const stopStreaming = () => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  isStreaming.value = false;
  isConnecting.value = false;
  const lastMsg = messages.value[messages.value.length - 1];
  if (lastMsg && lastMsg.role === "assistant") {
    lastMsg.isStreaming = false;
  }
  scrollToBottom(true);
};

const connectSSE = async () => {
  if (isStreaming.value || isConnecting.value) return;

  if (abortController) {
    abortController.abort();
  }

  const query = inputMsg.value.trim() || "实时获取数据流";
  inputMsg.value = "";
  nextTick(adjustHeight);

  // Append user message
  messages.value.push({
    id: `user_${Date.now()}`,
    role: "user",
    content: query,
  });

  // Append empty streaming assistant message
  const assistantMsgId = `assistant_${Date.now()}`;
  const assistantMsg = ref<Message>({
    id: assistantMsgId,
    role: "assistant",
    content: "",
    isStreaming: true,
  });
  messages.value.push(assistantMsg.value);

  isConnecting.value = true;
  isStreaming.value = true;
  scrollToBottom(true);

  abortController = new AbortController();

  try {
    const targetUrl = apiEndpoint.value.endsWith("/")
      ? `${apiEndpoint.value}responses`
      : `${apiEndpoint.value}/responses`;

    // Stateful request: only send the new query and conversation ID
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.value}`,
      },
      body: JSON.stringify({
        model: modelName.value,
        input: query,
        conversation: conversationId.value,
        instructions: systemPrompt.value || undefined,
        stream: true,
      }),
      signal: abortController.signal,
    });

    isConnecting.value = false;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let reasoningMode = false;
    let currentEvent = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("event: ")) {
          currentEvent = trimmed.slice(7).trim();
        } else if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const data = JSON.parse(dataStr);
            
            // 1. Check for standard Chat Completions delta (fallback compatibility)
            const choice = data.choices?.[0];
            if (choice) {
              const delta = choice.delta;
              if (delta.reasoning_content) {
                if (!reasoningMode) {
                  reasoningMode = true;
                  assistantMsg.value.content += "<thought>\n";
                }
                assistantMsg.value.content += delta.reasoning_content;
              } else {
                if (reasoningMode) {
                  reasoningMode = false;
                  assistantMsg.value.content += "\n</thought>\n\n";
                }
                if (delta.content) {
                  assistantMsg.value.content += delta.content;
                }
              }
            } 
            // 2. Check for Responses API reasoning delta
            else if (currentEvent === "response.output_text.reasoning_delta" && data.delta) {
              if (!reasoningMode) {
                reasoningMode = true;
                assistantMsg.value.content += "<thought>\n";
              }
              assistantMsg.value.content += data.delta;
            }
            // 3. Check for Responses API output_text delta
            else if (currentEvent === "response.output_text.delta" && data.delta) {
              if (reasoningMode) {
                reasoningMode = false;
                assistantMsg.value.content += "\n</thought>\n\n";
              }
              assistantMsg.value.content += data.delta;
            }
            // 4. In case event name is missing but data has delta (completions fallback)
            else if (data.delta) {
              if (reasoningMode) {
                reasoningMode = false;
                assistantMsg.value.content += "\n</thought>\n\n";
              }
              assistantMsg.value.content += data.delta;
            }
            scrollToBottom();
          } catch (err) {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }

    if (reasoningMode) {
      assistantMsg.value.content += "\n</thought>\n\n";
    }

    isStreaming.value = false;
    assistantMsg.value.isStreaming = false;
    scrollToBottom(true);
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("Fetch stream aborted by user");
      return;
    }
    console.error("SSE connection exception:", error);
    isConnecting.value = false;
    isStreaming.value = false;
    assistantMsg.value.isStreaming = false;
    assistantMsg.value.content += `\n\n*(⚡ 连接异常，请检查配置和网络: ${error.message})*`;
    scrollToBottom(true);
  } finally {
    abortController = null;
  }
};

// 6. Simulate Mock Stream response
const startSimulation = () => {
  if (isStreaming.value || isConnecting.value) return;

  messages.value.push({
    id: `user_${Date.now()}`,
    role: "user",
    content: "计算一维与二维高斯积分的证明，展示工具调用与代码细节",
  });

  const assistantMsgId = `assistant_${Date.now()}`;
  const assistantMsg = ref<Message>({
    id: assistantMsgId,
    role: "assistant",
    content: "",
    isStreaming: true,
  });
  messages.value.push(assistantMsg.value);

  isStreaming.value = true;
  scrollToBottom(true);

  const fullMockText = `<thought>
1. 用户请求展示高斯积分证明并测试 VNode 组件化高亮渲染。
2. 首先输出 LaTeX 行内与块级公式。
3. 接着调用 search_wikipedia 与 get_weather 工具展示折叠卡片。
4. 渲染对比表格和 Python 计算代码块。
</thought>

你好！关于高斯积分（Gaussian Integral）的证明 and 计算方法，以下为您进行流式渲染展示。

### 1. 高阶数学公式展示 (LaTeX)

一维高斯积分的基础形式为：

$$I = \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

而在多维计算中，若 $A$ 是一个二次型对称正定矩阵，其对应的二维高斯积分可以表达为：

$$\\iint_{\\mathbb{R}^2} e^{-\\frac{1}{2} \\mathbf{x}^T A \\mathbf{x}} dx_1 dx_2 = \\frac{2\\pi}{\\sqrt{\\det A}}$$

通过引入极坐标变换，我们可以将复杂的指数二次型极简地映射到二维空间计算。

---

### 2. Agent 运行工具追踪

在此阶段，我将启动 Wikipedia 检索获取高斯函数的历史文献：

\`\`\`call:search_wikipedia
{
  "query": "Carl Friedrich Gauss integral history",
  "limit": 1
}
\`\`\`

随后，调用实时的气象查询接口：

\`\`\`call:get_weather
{
  "city": "Beijing",
  "forecast": "1 day"
}
\`\`\`

工具执行圆满结束。以下为整理的数据对照信息表。

### 3. 数据表排版样式

| 区域 | 状态 | 温度 | 空气质量 (AQI) | 备注 |
| :--- | :---: | :---: | :---: | :--- |
| **北京** | 晴朗 | $22^\\circ\\text{C}$ | 45 (优) | 非常适宜户外实验 |
| **上海** | 小雨 | $26^\\circ\\text{C}$ | 58 (良) | 湿度偏高，注意设备防潮 |

---

### 4. 算法代码高亮与复制功能测试

以下是 Python 验证该矩阵 determinant 与积分值的计算实现：

\`\`\`python
import numpy as np

# 二维正定矩阵 A
A = np.array([[4, 1], [1, 3]])
det_A = np.linalg.det(A)

# 二维积分结果
integral_val = (2 * np.pi) / np.sqrt(det_A)
print(f"det(A) = {det_A:.4f}")
print(f"二维高斯积分 = {integral_val:.6f}")
\`\`\`

流式渲染演示已全部结束。您可以点击输入框右上方的 **“清空会话”** 复位界面！`;

  let currentIndex = 0;
  const charsPerTick = 2; // Stream 2 characters per 35ms
  
  const timer = setInterval(() => {
    if (currentIndex < fullMockText.length) {
      const chunk = fullMockText.substring(currentIndex, currentIndex + charsPerTick);
      assistantMsg.value.content += chunk;
      currentIndex += charsPerTick;
      scrollToBottom();
    } else {
      clearInterval(timer);
      isStreaming.value = false;
      assistantMsg.value.isStreaming = false;
      scrollToBottom(true);
    }
  }, 35);
};

const handleSend = () => {
  if (!inputMsg.value.trim() || isStreaming.value || isConnecting.value) return;
  connectSSE();
};

const clearHistory = () => {
  if (isStreaming.value || isConnecting.value) return;
  messages.value = [
    {
      id: "welcome",
      role: "assistant",
      content: "会话历史已清空。请输入您想讨论的话题或点击上方测试流按钮。",
    }
  ];
  conversationId.value = `conv_${Date.now()}`;
  localStorage.setItem("hermes-conversation-id", conversationId.value);
  isUserScrolling.value = false;
};

onMounted(() => {
  // Read saved theme preference
  const saved = localStorage.getItem("hermes-dark-theme");
  if (saved !== null) {
    isDark.value = saved === "true";
  } else {
    isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  applyThemeClass();

  // Scrollbar and page body overflow locks
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  scrollToBottom(true);
});

onUnmounted(() => {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  if (abortController) {
    abortController.abort();
  }
});
</script>

<template>
  <div class="chat-app-wrapper relative w-full h-[100vh] md:h-[calc(100vh-2rem)] flex flex-col justify-between bg-transparent">
    <!-- Top model header -->
    <header class="w-full border-b border-zinc-200/40 dark:border-zinc-800/40 bg-transparent select-none">
      <div class="max-w-3xl mx-auto w-full flex items-center justify-between px-3 py-2 md:px-4 md:py-3">
        <div class="flex items-center space-x-2">
          <span class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[10px] md:text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full flex items-center shadow-sm">
            <Sparkles class="h-3 md:h-3.5 w-3 md:w-3.5 mr-1 md:mr-1.5 text-blue-500 animate-pulse" />
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
          <button 
            @click="toggleTheme"
            type="button"
            class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] md:text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full flex items-center shadow-sm cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800/60 transition-all active:scale-95 duration-200"
            :title="isDark ? '切换至明亮模式' : '切换至暗黑模式'"
          >
            <Sun v-if="isDark" class="h-3 md:h-3.5 w-3 md:w-3.5 mr-1 text-amber-500 animate-pulse" />
            <Moon v-else class="h-3 md:h-3.5 w-3 md:w-3.5 mr-1 text-blue-500" />
            <span>{{ isDark ? '暗黑模式' : '明亮模式' }}</span>
          </button>

          <!-- Settings Button -->
          <button 
            @click="showSettings = true"
            type="button"
            class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[9px] md:text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full flex items-center shadow-sm cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800/60 transition-all active:scale-95 duration-200"
            title="API 配置"
          >
            <Settings class="h-3 md:h-3.5 w-3 md:w-3.5 mr-1 text-zinc-500" />
            <span>设置</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Message flow viewport -->
    <div 
      ref="messagesContainer"
      @scroll="handleScroll"
      class="flex-1 overflow-y-auto w-full scroll-smooth scrollbar-thin"
    >
      <div class="max-w-3xl mx-auto w-full px-4 py-6 space-y-8">
        <div 
          v-for="msg in messages" 
          :key="msg.id"
          class="flex flex-col"
        >
          <!-- User Chat Bubble -->
          <div v-if="msg.role === 'user'" class="flex justify-end w-full">
            <div class="max-w-[80%] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/10 dark:border-zinc-800/20 text-zinc-900 dark:text-zinc-100 px-4 py-2.5 rounded-2xl text-left whitespace-pre-wrap leading-relaxed text-sm shadow-sm">
              {{ msg.content }}
            </div>
          </div>

          <!-- Assistant Chat Area (Claude/Gemini borderless layout) -->
          <div v-else class="flex items-start space-x-4 w-full">
            <!-- Circular HA Avatar -->
            <div class="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-md shadow-blue-500/15 select-none mt-1">
              HA
            </div>
            <!-- Borderless Content -->
            <div class="flex-1 min-w-0 pr-4">
              <MarkdownRenderer 
                :content="msg.content" 
                :isStreaming="msg.isStreaming"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll down floating anchor -->
    <button 
      v-if="isUserScrolling"
      @click="resetScrollState"
      class="absolute bottom-28 right-4 md:bottom-40 md:right-8 lg:right-auto lg:left-[calc(50%+330px)] h-8 w-8 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-200 z-10 cursor-pointer"
    >
      <ArrowDown class="h-4 w-4" />
    </button>

    <!-- Bottom Input & Controls Container -->
    <div class="relative w-full bg-transparent">
      <div class="max-w-3xl mx-auto w-full px-4 pb-6">
        <!-- Suspended Action Test Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 max-w-2xl mx-auto mb-3 md:mb-4 select-none w-full">
          <!-- Card 1: Simulation -->
          <button 
            @click="startSimulation" 
            :disabled="isStreaming || isConnecting"
            class="flex items-start space-x-3 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md hover:border-blue-500/50 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 text-left transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none w-full"
          >
            <div class="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
              <Play class="h-4 w-4 md:h-4.5 md:w-4.5 fill-current" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] md:text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">运行模拟测试流</div>
              <div class="text-[9px] md:text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">验证 LaTeX 公式与 VNode 代码 high-light</div>
            </div>
          </button>
          
          <!-- Card 2: Clear Session -->
          <button 
            @click="clearHistory"
            :disabled="isStreaming || isConnecting"
            class="flex items-start space-x-3 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md hover:border-amber-500/50 hover:bg-amber-50/20 dark:hover:amber-950/10 text-left transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none w-full"
          >
            <div class="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
              <RefreshCw class="h-4.5 w-4.5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] md:text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">清理会话历史</div>
              <div class="text-[9px] md:text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">重置上下文，清空缓存与消息</div>
            </div>
          </button>
        </div>

        <!-- Rounded Input Capsule (GPT/Claude style) -->
        <div class="flex items-end space-x-2 md:space-x-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-[22px] md:rounded-3xl px-3 py-2 md:px-4 md:py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-zinc-300 dark:focus-within:border-zinc-700 transition-all duration-300">
          <!-- Attachment Icon -->
          <button 
            type="button"
            class="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Paperclip class="h-4 w-4" />
          </button>

          <!-- Dynamic Textarea -->
          <textarea
            ref="inputRef"
            v-model="inputMsg"
            @keydown.enter.prevent="handleSend"
            placeholder="给 Hermes 发送消息，或输入 Prompt 测试 SSE..."
            rows="1"
            class="flex-1 resize-none bg-transparent outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 min-h-[24px] max-h-40 overflow-y-auto py-1 md:py-1.5 leading-relaxed"
          ></textarea>

          <!-- Voice Mic Icon -->
          <button 
            type="button"
            class="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 mr-1"
          >
            <Mic class="h-4 w-4" />
          </button>

          <!-- Circular Send/Stop Button -->
          <button
            @click="isStreaming || isConnecting ? stopStreaming() : handleSend()"
            :disabled="!inputMsg.trim() && !isStreaming && !isConnecting"
            class="h-8 w-8 rounded-full bg-blue-600 disabled:bg-zinc-100 dark:disabled:bg-zinc-900 text-white disabled:text-zinc-300 dark:disabled:text-zinc-700 flex items-center justify-center hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-sm"
          >
            <span v-if="isStreaming || isConnecting" class="h-2.5 w-2.5 bg-white rounded-sm"></span>
            <ArrowUp v-else class="h-4.5 w-4.5" />
          </button>
        </div>

        <!-- Small Bottom Caption -->
        <div class="text-[10px] text-zinc-400 dark:text-zinc-500 text-center mt-2 font-medium">
          Hermes 2.5. 运行模拟测试流以检验 LaTeX 与 VNode 语法高亮渲染。
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <Transition name="fade">
      <div v-if="showSettings" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div class="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-900">
            <h3 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">API 服务配置</h3>
            <button @click="showSettings = false" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
              <X class="h-5 w-5" />
            </button>
          </div>
          
          <!-- Content -->
          <div class="p-6 space-y-4 text-left">
            <div>
              <label class="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">API Base URL (Prefix)</label>
              <input 
                v-model="apiEndpoint" 
                type="text" 
                placeholder="http://82.156.247.203:8080/v1" 
                class="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">API Key</label>
              <input 
                v-model="apiKey" 
                type="password" 
                placeholder="API Key" 
                class="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Model Name</label>
              <input 
                v-model="modelName" 
                type="text" 
                placeholder="deepseek-v4-flash" 
                class="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">System Prompt</label>
              <textarea 
                v-model="systemPrompt" 
                rows="3"
                placeholder="您是 AI 助手..." 
                class="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors resize-none"
              ></textarea>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="flex justify-end space-x-3 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/20 border-t border-zinc-100 dark:border-zinc-900">
            <button 
              @click="showSettings = false" 
              class="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              取消
            </button>
            <button 
              @click="saveSettings" 
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-95 duration-200"
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Scoped layout rules */
.chat-app-wrapper {
  margin: 0.5rem auto;
}

/* Custom scrollbar widths */
::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.15);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.3);
}

/* Fade transition for settings modal */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
