<script lang="ts" setup>
import { renderToString } from "katex";
import { ref, watch } from "vue";

const showCopy = ref<boolean>(true);
const count = ref<string>("");
const copyFunc = () => {
  const content: HTMLDivElement | null = document.querySelector(
    "#content>.subcontent>span",
  );
  if (content && content.innerHTML && content.textContent) {
    setTimeoutFunc();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${content.innerHTML}`).then(
        () => {
          console.log("复制成功");
        },
        () => {
          console.error("复制失败");
        },
      );
      return;
    }

    if (content) {
      const range = document.createRange();
      range.selectNode(content);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("copy");
      selection?.removeAllRanges();
    }
  } else {
    console.error("内容为空，无法复制");
  }
};
const randerFunc = () => {
  const content = document.querySelector("#content>.subcontent");
  if (content) {
    content.innerHTML = renderToString(count.value, {
      throwOnError: false,
      displayMode: true,
      output: "mathml",
    });
  }
};
const setTimeoutFunc = () => {
  showCopy.value = false;
  setTimeout(() => {
    showCopy.value = true;
  }, 2000);
};
watch(
  () => count.value,
  () => {
    randerFunc();
  },
);
</script>
<template>
  <div class="card">
    <input
      v-model="count"
      autocomplete="off"
      autofocus
      class="card-body"
      placeholder="Enter your math expression here"
      type="text"
    />
    <div id="content">
      <div class="header">
        <div class="copy" @click="copyFunc">
          <span v-if="showCopy">
            <svg
              fill="none"
              height="24"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect height="13" rx="2" ry="2" width="13" x="9" y="9"></rect>
              <path
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              ></path>
            </svg>
          </span>
          <span v-else> 🎉 </span>
        </div>
      </div>
      <div class="subcontent"></div>
    </div>
  </div>
</template>

<style scoped>
/* 页面整体居中 */
.card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100vw;
}

/* 卡片容器 */
.card-container {
  position: relative;
  width: 350px;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* 文字输入框 */
.card-body {
  //background: #ccc;

  min-height: 40px;
  padding-left: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  height: 36px;
  width: 26vw;
  max-width: 460px;
  min-width: 320px;
  font-size: 16px;
  letter-spacing: 1px;
}

input:focus {
  border: 1px solid rgba(32, 135, 203, 1);
  outline: none;
  /* 移除默认的 outline */
  box-shadow: 0 0 5px rgba(32, 135, 203, 0.5);
  /* 增加更明显的焦点效果 */
}

#content {
  position: relative;
  min-height: 100px;
  min-width: 320px;
  max-width: 640px;
  width: 27vw;
  margin-top: 20px;
  font-size: 24px;
  color: #333;
  border-radius: 8px;
  //background: #ccc;
  border: 1px solid rgba(32, 135, 203, 0.75);
}

.header {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 30px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

svg {
  width: 20px;
  height: 20px;
  margin-right: 4px;
  cursor: pointer;
}

.subcontent {
  margin-top: 35px;
  max-width: 640px;
  width: 20vw;
  white-space: pre-wrap;
  word-break: break-all;
  /* 允许长单词或公式内断行 */
}

@media (prefers-reduced-motion: dark) {
  .card-body {
    background: #f8f9fa;
  }

  #content {
    background: #f8f9fa;
  }
}
</style>
