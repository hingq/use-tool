<script lang="ts" setup>
import { RouterView } from "vue-router";

</script>

<template>

  <div class="bg bg-tl"></div>
  <div class="bg bg-tl2"></div>
  <div class="bg bg-br"></div>
  <router-view />

  <div class="mail">
    <a href="mailto:amazyko@foxmail.com" target="_blank">
      <svg fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <rect height="16" rx="2" ry="2" width="18" x="3" y="4"></rect>
        <polyline points="3,4 12,13 21,4"></polyline>
      </svg>
    </a>
  </div>
</template>

<style scoped>
.bg {
  position: fixed;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle,
      var(--color) 0%,
      rgba(246, 246, 246, 1) 100%);
  filter: blur(130px);
  opacity: 0.9;
}

.bg-tl {
  top: 10%;
  left: 10%;
  /* Adjust as needed */
}

.bg-tl2 {
  top: 3%;
  left: 30%;
  /* Adjust as needed */
}

.bg-br {
  bottom: 7%;
  right: 5%;
  /* Adjust as needed */
}

.mail {
  position: fixed;
  right: 10%;
  bottom: 10%;
}

.mail a {
  display: block;
  width: 32px;
  height: 32px;
  color: #000;
  text-decoration: none;
  font-size: 24px;
  transition: color 0.3s ease;
}

svg {
  stroke: rgb(43, 118, 205);
}

@media (max-width: 768px) {
  .bg {
    width: 200px;
    height: 200px;
  }

  .mail {
    visibility: hidden;
  }
}
</style>
