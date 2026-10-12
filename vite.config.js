import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({mode}) => {
 const env=loadEnv(mode,process.cwd(),'');
 return {esbuild:{jsx:'automatic'},server:{port:5175,proxy:env.N8N_PROXY_TARGET ? {'/api':{target:env.N8N_PROXY_TARGET,changeOrigin:true,rewrite:path=>path.replace(/^\/api\/?/,'/')}} : undefined}, build:{sourcemap:false}};
});
