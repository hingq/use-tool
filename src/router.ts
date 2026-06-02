import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/math",
    },
    {
      path: "/math",
      name: "Home",
      component: () => import("./components/math.vue"),
    },
    {
      path: "/epub",
      name: "epub",
      component: () => import("./components/epub/index.vue"),
    },
    {
      path: "/audiobook",
      name: "audiobook",
      component: () => import("./components/epub/audiobook.vue"),
    },
    {
      path: "/chat",
      name: "chat",
      component: () => import("./components/chat/index.vue"),
    },
  ],
});
export default router;
