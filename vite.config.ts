import { defineConfig } from 'vite';
import path, { format } from 'path';
import { version } from './package.json';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'RSS3',
            formats: ['umd', 'es'],
            fileName: (format) => `rss3.${format}.js`,
        },
    },
    define: {
        SDK_VERSION: JSON.stringify(version),
    },
    server: {
        base: '/demo/',
    },
    plugins: [
        vue(),
        AutoImport({
            resolvers: [ElementPlusResolver()],
        }),
        Components({
            resolvers: [ElementPlusResolver()],
        }),
    ],
});
