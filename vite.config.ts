import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Set NODE_ENV for production builds
  if (command === 'build') {
    process.env.NODE_ENV = 'production'
  }

  const serverPort = parseInt(env.PORT) || 3000
  const devPort = parseInt(env.VITE_DEV_PORT) || 5173

  return {
    plugins: [vue()],
    server: {
      port: devPort,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: devPort
    },
    define: {
      // Make NODE_ENV available to the client if needed
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || mode)
    }
  }
})