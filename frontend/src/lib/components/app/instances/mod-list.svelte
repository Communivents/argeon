<script lang="ts">
	import path from 'path-browserify';
	import type { Mod } from './types';
	import { formatBytes } from './utils';

	export let mods: Mod[];
</script>

<div class="space-y-2">
	<h4 class="font-semibold text-white/90">Mods:</h4>
	<div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-black/10 scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
		{#each mods as mod}
			<div class="text-sm p-2 rounded-md bg-black/30 backdrop-blur-sm border border-white/10">
				<div class="font-medium text-white/90 truncate">
					{mod.filename.match(/^[a-zA-Z]+/g) || path.basename(mod.filename,".jar")}
				</div>
				<div class="text-xs text-white/70">
					{formatBytes(mod.size)}
				</div>
			</div>
		{/each}
	</div>
</div>