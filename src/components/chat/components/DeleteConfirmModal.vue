<script lang="ts" setup>
import { AlertTriangle, X } from "lucide-vue-next";

defineProps<{
  isOpen: boolean;
  title?: string;
  message?: string;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm"
      @click.self="emit('cancel')"
    >
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div
          class="relative w-full max-w-md overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xl transition-all duration-300"
        >
          <!-- Top Accent Line -->
          <div class="h-1.5 w-full bg-red-500"></div>

          <!-- Close button -->
          <button
            @click="emit('cancel')"
            class="absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X class="h-4 w-4" />
          </button>

          <div class="p-6">
            <div class="flex items-start space-x-4">
              <!-- Warning Icon -->
              <div
                class="flex items-center justify-center flex-shrink-0 h-10 w-10 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400"
              >
                <AlertTriangle class="h-5 w-5" />
              </div>

              <!-- Content -->
              <div class="flex-1 space-y-2">
                <h3 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {{ title || "确认删除会话？" }}
                </h3>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {{ message || "此操作将永久删除该会话及其所有聊天历史记录，此过程不可逆。" }}
                </p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                @click="emit('cancel')"
                class="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-850 rounded-xl transition-all active:scale-98 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                @click="emit('confirm')"
                class="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 shadow-md shadow-red-500/10 rounded-xl transition-all active:scale-98 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
