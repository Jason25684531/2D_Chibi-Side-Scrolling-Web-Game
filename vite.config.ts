import { defineConfig } from 'vitest/config';
// ComfyUI rejects cross-origin POSTs (403), so the station reaches it same-origin through /comfy with Origin stripped.
const comfy={'/comfy':{target:'http://127.0.0.1:8188',rewrite:(p:string)=>p.replace(/^\/comfy/,''),configure:(proxy:any)=>proxy.on('proxyReq',(req:any)=>req.removeHeader('origin'))}};
export default defineConfig({
  server: { port: 5175, strictPort: true, proxy: comfy },
  preview: { proxy: comfy },
  build:{rollupOptions:{input:{game:'index.html',prototype:'prototype.html',gamepad:'gamepad.html'}}},
  test: { include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'] }
});
