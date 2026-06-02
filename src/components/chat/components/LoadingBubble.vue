<template>
  <div class="flex items-center space-x-1.5 py-3 px-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl w-max border border-zinc-200/20 dark:border-zinc-800/30 shadow-sm animate-pulse-subtle">
    <div class="h-2 w-2 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 animate-bounce-custom" style="animation-delay: 0ms"></div>
    <div class="h-2 w-2 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 animate-bounce-custom" style="animation-delay: 150ms"></div>
    <div class="h-2 w-2 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 animate-bounce-custom" style="animation-delay: 300ms"></div>
  </div>
</template>

<style scoped>
.animate-pulse-subtle {
  animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(0.98);
  }
}

.animate-bounce-custom {
  animation: bounce-custom 1.2s infinite ease-in-out;
}

@keyframes bounce-custom {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
