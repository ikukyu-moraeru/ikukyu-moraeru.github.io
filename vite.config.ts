import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 公開時のサブパスに合わせる
export default defineConfig({
  base: '/MaternityLeaveCalculator/',
  plugins: [react()],
})
