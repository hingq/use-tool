import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  esbuild: {
    target: "es2022",
  },
  resolve: {
    alias: {
      // 2. 配置别名：将 @ 映射到项目根目录下的 src 文件夹
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
