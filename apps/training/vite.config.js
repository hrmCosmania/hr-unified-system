import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // แอปย่อยของระบบ HR รวมศูนย์: เสิร์ฟที่ /training/ และ build ลงโฟลเดอร์ training/ ที่รากของ repo (Vercel เสิร์ฟไฟล์ตรง ๆ ไม่มีขั้น build)
  base: '/training/',
  build: { outDir: '../../training', emptyOutDir: true },
  plugins: [react()],
  server: { port: 5173 },
})
