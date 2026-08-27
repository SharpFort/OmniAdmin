import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'
import zlib from 'node:zlib'
import vueDevTools from 'vite-plugin-vue-devtools'
import viteCompression from 'vite-plugin-compression'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import ElementPlus from 'unplugin-element-plus/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import tailwindcss from '@tailwindcss/vite'
// import { visualizer } from 'rollup-plugin-visualizer'

export default ({ mode }: { mode: string }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root)
  const {
    VITE_VERSION,
    VITE_PORT,
    VITE_BASE_URL,
    VITE_API_URL,
    VITE_API_PROXY_URL,
    VITE_LOGTO_ENDPOINT
  } = env

  console.log(`🚀 API_URL = ${VITE_API_URL}`)
  console.log(`🚀 VERSION = ${VITE_VERSION}`)

  const logtoTarget = VITE_LOGTO_ENDPOINT || 'http://localhost:3001'
  const apiTarget = VITE_API_PROXY_URL || logtoTarget

  /**
   * Logto 同源代理：转发响应时把 Logto 服务器生成的 http://localhost:3001
   * 改写为当前前端 origin，解决：
   *  - iframe 跨站 SameSite Cookie 不发送（未找到会话）
   *  - 登录提交后 redirectTo 指向 localhost:3001 导致会话丢失
   */
  const logtoProxy = (target: string) => ({
    target,
    changeOrigin: false,
    selfHandleResponse: true,
    configure: (proxy: any) => {
      proxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
        const origin = `http://${req?.headers?.host || 'localhost:3006'}`
        const chunks: Buffer[] = []
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
        proxyRes.on('end', () => {
          const raw = Buffer.concat(chunks)
          const headers: Record<string, any> = { ...proxyRes.headers }
          // Logto 响应的 Origin-Agent-Cluster 与 Vite 自身页面不一致，
          // 会导致浏览器报 “origin-keyed agent cluster” 警告；统一去掉
          delete headers['origin-agent-cluster']
          delete headers['Origin-Agent-Cluster']
          const enc = String(headers['content-encoding'] ?? '').toLowerCase()
          const patch = (input: Buffer) => {
            const text = input.toString('utf8').split('http://localhost:3001').join(origin)
            return Buffer.from(text, 'utf8')
          }
          let body: Buffer
          if (enc === 'gzip') {
            body = zlib.gzipSync(patch(zlib.gunzipSync(raw)))
          } else if (enc === 'br') {
            body = zlib.brotliCompressSync(patch(zlib.brotliDecompressSync(raw)))
          } else {
            body = patch(raw)
          }
          if (headers.location) {
            headers.location = String(headers.location).split('http://localhost:3001').join(origin)
          }
          delete headers['content-length']
          headers['content-length'] = String(body.length)
          res.writeHead(proxyRes.statusCode ?? 200, headers)
          res.end(body)
        })
      })
    }
  })

  return defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(VITE_VERSION)
    },
    base: VITE_BASE_URL,
    server: {
      port: Number(VITE_PORT),
      proxy: {
        // Logto 同源代理：转发并改写 http://localhost:3001 → 前端 origin
        '/oidc': logtoProxy(logtoTarget),
        '/sign-in': logtoProxy(logtoTarget),
        '/unknown-session': logtoProxy(logtoTarget),
        // 静态资源不改写（避免二进制损坏），只透传（同样去掉 Origin-Agent-Cluster；
        // 需 selfHandleResponse 缓冲后重写头部，直接改 proxyRes.headers 在透传模式下不生效）
        '/assets': {
          target: logtoTarget,
          changeOrigin: false,
          selfHandleResponse: true,
          configure: (proxy: any) => {
            proxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
              const chunks: Buffer[] = []
              proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
              proxyRes.on('end', () => {
                const body = Buffer.concat(chunks)
                const headers: Record<string, any> = { ...proxyRes.headers }
                delete headers['origin-agent-cluster']
                delete headers['Origin-Agent-Cluster']
                delete headers['content-length']
                headers['content-length'] = String(body.length)
                res.writeHead(proxyRes.statusCode ?? 200, headers)
                res.end(body)
              })
            })
          }
        },
        '/.well-known': logtoProxy(logtoTarget),
        // Logto experience 页面自身的 /api/interaction 等请求（开发态；不替代业务 API）
        '/api': logtoProxy(apiTarget)
      },
      // 仅监听 localhost：host:true 会让 Vite 绑定 0.0.0.0 并枚举全部网卡，
      // 在 Windows 上会打印 169.254.*(链路本地)、WSL/Hyper-V 虚拟网卡等无用地址。
      // 如需局域网/手机调试改回 true，且该 IP 必须已登记 Logto redirect/postLogout URI
      host: 'localhost'
    },
    // 路径别名
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@views': resolvePath('src/views'),
        '@imgs': resolvePath('src/assets/images'),
        '@icons': resolvePath('src/assets/icons'),
        '@utils': resolvePath('src/utils'),
        '@stores': resolvePath('src/store'),
        '@styles': resolvePath('src/assets/styles')
      }
    },
    build: {
      target: 'es2015',
      outDir: 'dist',
      chunkSizeWarningLimit: 2000,
      minify: 'terser',
      terserOptions: {
        compress: {
          // 生产环境去除 console
          drop_console: true,
          // 生产环境去除 debugger
          drop_debugger: true
        }
      },
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [],
        include: ['src/views/**/*.vue']
      }
    },
    plugins: [
      vue(),
      tailwindcss(),
      // 自动按需导入 API
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        dts: 'src/types/import/auto-imports.d.ts',
        resolvers: [ElementPlusResolver()],
        eslintrc: {
          enabled: true,
          filepath: './.auto-import.json',
          globalsPropValue: true
        }
      }),
      // 自动按需导入组件
      Components({
        dts: 'src/types/import/components.d.ts',
        resolvers: [ElementPlusResolver()]
      }),
      // 按需定制主题配置
      ElementPlus({
        useSource: true
      }),
      // 压缩
      viteCompression({
        verbose: false, // 是否在控制台输出压缩结果
        disable: false, // 是否禁用
        algorithm: 'gzip', // 压缩算法
        ext: '.gz', // 压缩后的文件名后缀
        threshold: 10240, // 只有大小大于该值的资源会被处理 10240B = 10KB
        deleteOriginFile: false // 压缩后是否删除原文件
      }),
      vueDevTools()
      // 打包分析
      // visualizer({
      //   open: true,
      //   gzipSize: true,
      //   brotliSize: true,
      //   filename: 'dist/stats.html' // 分析图生成的文件名及路径
      // }),
    ],
    // 依赖预构建：避免运行时重复请求与转换，提升首次加载速度
    optimizeDeps: {
      include: [
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/renderers',
        'xlsx',
        'xgplayer',
        'crypto-js',
        'file-saver',
        'vue-img-cutter',
        'element-plus/es',
        'element-plus/es/components/*/style/css',
        'element-plus/es/components/*/style/index'
      ]
    },
    css: {
      preprocessorOptions: {
        // sass variable and mixin
        scss: {
          additionalData: `
            @use "@styles/core/el-light.scss" as *; 
            @use "@styles/core/mixin.scss" as *;
          `
        }
      },
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove()
                }
              }
            }
          }
        ]
      }
    }
  })
}

function resolvePath(paths: string) {
  return path.resolve(__dirname, paths)
}
