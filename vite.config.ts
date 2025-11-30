import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 需要子路径，Vercel 使用根路径
  // 通过环境变量 GITHUB_PAGES 来区分部署平台
  base: process.env.GITHUB_PAGES === 'true' ? '/zplpreview/' : '/',
})
