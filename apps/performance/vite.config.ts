import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // แอปย่อยของระบบ HR รวมศูนย์: เสิร์ฟที่ /performance/ และ build ลงโฟลเดอร์ performance/ ที่รากของ repo
  base: "/performance/",
  build: { outDir: "../../performance", emptyOutDir: true },
  server: { port: 5173 },
});
