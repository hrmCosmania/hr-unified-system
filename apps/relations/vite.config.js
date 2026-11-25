import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // แอปย่อยของระบบ HR รวมศูนย์: เสิร์ฟที่ /relations/ และ build ลงโฟลเดอร์ relations/ ที่รากของ repo
  base: '/relations/',
  build: { outDir: '../../relations', emptyOutDir: true },
  plugins: [react()],
  server: { port: 5180 }
})
