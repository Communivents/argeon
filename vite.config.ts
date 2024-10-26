import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import * as path from 'path';
import neutralino from './scripts/package/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
	root: 'frontend',
	plugins: [svelte(), neutralino()],
	build: {
		outDir: path.resolve('./frontend/dist'),
		rollupOptions: {
			external: ['/__neutralino_globals.js'],
		},
	},
	resolve: {
		alias: {
			$lib: path.resolve('./frontend/src/lib'),
			'@': path.resolve('./frontend/src'),
			'$root': path.resolve('./'),
		},
	},
	server: {
		host: 'localhost',
	},
});
