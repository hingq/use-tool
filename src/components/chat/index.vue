<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import MarkdownRenderer from "./MarkdownRenderer.vue";
import ChatHeader from "./components/ChatHeader.vue";
import ActionCards from "./components/ActionCards.vue";
import ChatInput from "./components/ChatInput.vue";
import LoadingBubble from "./components/LoadingBubble.vue";
import Sidebar from "./components/Sidebar.vue";
import DeleteConfirmModal from "./components/DeleteConfirmModal.vue";

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
    
现在我支持由 **markdown-it** + **KaTeX** + **highlight.js** 强力驱动的纯虚拟 DOM（VNode）组件化渲染。您可以点击输入框上方的 **“运行模拟测试流”**，体验我为您准备的包含数学公式 and 工具调用的多模态文档。`,
  },
]);

const inputMsg = ref("");
const isConnecting = ref(false);
const isStreaming = ref(false);
const isUserScrolling = ref(false);
const isDark = ref(false);

const messagesContainer = ref<HTMLElement | null>(null);

// API Service Settings (fixed/non-editable: endpoint and model are locked)
const apiEndpoint = "http://82.156.247.203:8080/v1";
const apiKey = (import.meta.env.VITE_API_KEY as string);
const modelName = "deepseek-v4-flash";
const systemPrompt = "";
const conversationId = ref(localStorage.getItem("hermes-conversation-id") || `conv_${Date.now()}`);

// Dashboard API (port 9119)
const dashboardApiBase = (import.meta.env.VITE_DASHBOARD_API_BASE as string) || "http://127.0.0.1:9119/api";

// Sidebar & Sessions State
const sessions = ref<any[]>([]);
const isSidebarOpen = ref(localStorage.getItem("hermes-sidebar-open") !== "false");
const isDeleteModalOpen = ref(false);
const sessionToDelete = ref<string | null>(null);

// Ensure conversationId is stored
localStorage.setItem("hermes-conversation-id", conversationId.value);

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

// 3. Scroll Logic (Industry Standard - Snap to bottom only if already there)
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

  // 核心逻辑：只要向上滑动超过 15px，就判定为“用户手动浏览历史”，立即锁死自动滚动，交出控制权
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

// 4. Connect to Real SSE Service (using POST stream fetch)
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
    const targetUrl = apiEndpoint.endsWith("/")
      ? `${apiEndpoint}responses`
      : `${apiEndpoint}/responses`;

    // Stateful request: only send the new query and conversation ID
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        input: query,
        conversation: conversationId.value,
        instructions: systemPrompt || undefined,
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
    fetchSessions();
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

// 5. Simulate Mock Stream response
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

  // Wait 1.2 seconds to simulate connecting/thinking delay and show LoadingBubble
  setTimeout(() => {
    if (!isStreaming.value || assistantMsg.value.id !== assistantMsgId) return;

    let currentIndex = 0;
    const charsPerTick = 2; // Stream 2 characters per 35ms

    const timer = setInterval(() => {
      if (currentIndex < fullMockText.length) {
        if (!isStreaming.value) {
          clearInterval(timer);
          return;
        }
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
  }, 1200);
};

const handleSend = () => {
  if (!inputMsg.value.trim() || isStreaming.value || isConnecting.value) return;
  connectSSE();
};

// Fetch the list of historical sessions
const fetchSessions = async () => {
  try {
    const res = await fetch(`${dashboardApiBase}/sessions`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      sessions.value = Array.isArray(data) ? data : (data.sessions || []);
    }
  } catch (error) {
    console.error("Error fetching sessions:", error);
  }
};

// Load full message history of a selected session
const loadSessionMessages = async (id: string) => {
  if (!id) return;
  try {
    const res = await fetch(`${dashboardApiBase}/sessions/${id}/messages`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to load messages: ${res.status}`);
    }
    const data = await res.json();
    const rawMessages = Array.isArray(data) ? data : (data.messages || []);
    
    // Filter and map to local message structure
    messages.value = rawMessages
      .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
      .map((msg: any, idx: number) => ({
        id: msg.id || `${msg.role}_${idx}_${Date.now()}`,
        role: msg.role,
        content: msg.content || ""
      }));
      
    if (messages.value.length === 0) {
      resetToWelcomeMessage();
    }
    resetScrollState();
  } catch (error) {
    console.error("Error loading session messages:", error);
  }
};

// Start a fresh new chat
const startNewChat = () => {
  if (isStreaming.value || isConnecting.value) return;
  resetToWelcomeMessage();
  conversationId.value = `conv_${Date.now()}`;
  localStorage.setItem("hermes-conversation-id", conversationId.value);
  isUserScrolling.value = false;
};

// Reset welcome message
const resetToWelcomeMessage = () => {
  messages.value = [
    {
      id: "welcome",
      role: "assistant",
      content: `你好！我是 **Hermes Agent**。我已经升级了我的渲染引擎！
    
现在我支持由 **markdown-it** + **KaTeX** + **highlight.js** 强力驱动的纯虚拟 DOM（VNode）组件化渲染。您可以点击输入框上方的 **“运行模拟测试流”**，体验我为您准备的包含数学公式 and 工具调用的多模态文档。`,
    },
  ];
};

// Select and load a session
const selectSession = async (id: string) => {
  if (isStreaming.value || isConnecting.value) return;
  conversationId.value = id;
  localStorage.setItem("hermes-conversation-id", id);
  await loadSessionMessages(id);
  
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
};

// Open deletion confirmation modal
const confirmDeleteSession = (id: string) => {
  sessionToDelete.value = id;
  isDeleteModalOpen.value = true;
};

// Confirm delete API call
const handleDeleteConfirm = async () => {
  if (!sessionToDelete.value) return;
  const id = sessionToDelete.value;
  isDeleteModalOpen.value = false;
  sessionToDelete.value = null;

  try {
    const res = await fetch(`${dashboardApiBase}/sessions/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (res.ok) {
      if (conversationId.value === id) {
        startNewChat();
      }
      await fetchSessions();
    } else {
      console.error(`Failed to delete session ${id}: ${res.status}`);
    }
  } catch (error) {
    console.error("Error deleting session:", error);
  }
};

const handleDeleteCancel = () => {
  isDeleteModalOpen.value = false;
  sessionToDelete.value = null;
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
  localStorage.setItem("hermes-sidebar-open", isSidebarOpen.value ? "true" : "false");
};

const clearHistory = () => {
  startNewChat();
};

onMounted(async () => {
  // Read saved theme preference
  const saved = localStorage.getItem("hermes-dark-theme");
  if (saved !== null) {
    isDark.value = saved === "true";
  } else {
    isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  applyThemeClass();
  if (!apiKey) {
    throw new Error("API Key is not set. Please define API_KEY in your environment variables.");
  }
  // Scrollbar and page body overflow locks
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  
  // Load session list & load current active session history
  await fetchSessions();
  if (conversationId.value && !conversationId.value.startsWith("conv_mock_")) {
    await loadSessionMessages(conversationId.value);
  }
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
  <div class="flex h-screen w-full overflow-hidden chat-app-wrapper bg-transparent">
    <!-- Sidebar for session history -->
    <Sidebar
      :sessions="sessions"
      :activeSessionId="conversationId"
      :isSidebarOpen="isSidebarOpen"
      @select="selectSession"
      @delete="confirmDeleteSession"
      @new-chat="startNewChat"
      @toggle-sidebar="toggleSidebar"
    />

    <!-- Main Chat Workspace -->
    <div class="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden">
      <!-- Top model header -->
      <ChatHeader
        :isConnecting="isConnecting"
        :isStreaming="isStreaming"
        :isDark="isDark"
        :isSidebarOpen="isSidebarOpen"
        @toggleTheme="toggleTheme"
      />

      <!-- Message flow viewport -->
      <div ref="messagesContainer" @scroll="handleScroll"
        class="flex-1 overflow-y-auto w-full scroll-smooth scrollbar-thin">
        <div class="max-w-3xl mx-auto w-full px-4 py-6 space-y-8">
          <div v-for="msg in messages" :key="msg.id" class="flex flex-col">
            <!-- User Chat Bubble -->
            <div v-if="msg.role === 'user'" class="flex justify-end w-full">
              <div
                class="max-w-[80%] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/10 dark:border-zinc-800/20 text-zinc-900 dark:text-zinc-100 px-4 py-2.5 rounded-2xl text-left whitespace-pre-wrap leading-relaxed text-sm shadow-sm">
                {{ msg.content }}
              </div>
            </div>

            <!-- Assistant Chat Area (Claude/Gemini borderless layout) -->
            <div v-else class="flex items-start space-x-4 w-full">
              <!-- Circular HA Avatar -->
              <div
                class="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-md shadow-blue-500/15 select-none mt-1">
                HA
              </div>
              <!-- Borderless Content -->
              <div class="flex-1 min-w-0 pr-4">
                <LoadingBubble v-if="msg.isStreaming && !msg.content" />
                <MarkdownRenderer v-else :content="msg.content" :isStreaming="msg.isStreaming" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Input & Controls Container -->
      <div class="relative w-full bg-transparent">
        <div class="max-w-3xl mx-auto w-full px-4 pb-6">
          <!-- Suspended Action Test Cards -->
          <ActionCards
            :isStreaming="isStreaming"
            :isConnecting="isConnecting"
            @startSimulation="startSimulation"
            @clearHistory="clearHistory"
          />

          <!-- Rounded Input Capsule (GPT/Claude style) -->
          <ChatInput
            v-model="inputMsg"
            :isStreaming="isStreaming"
            :isConnecting="isConnecting"
            @send="handleSend"
            @stop="stopStreaming"
          />

          <!-- Small Bottom Caption -->
          <div class="text-[10px] text-zinc-400 dark:text-zinc-500 text-center mt-2 font-medium">
            Hermes 2.5. 运行模拟测试流以检验 LaTeX 与 VNode 语法高亮渲染。
          </div>
        </div>
      </div>
    </div>

    <!-- Micro-modal for deletion confirmation -->
    <DeleteConfirmModal
      :isOpen="isDeleteModalOpen"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </div>
</template>

<style scoped>
/* Scoped layout rules */
.chat-app-wrapper {
  margin: 0;
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
</style>
