<script lang="ts">
	import * as Badge from '$lib/components/ui/badge';

	export let mcVersion: string;
	export let loaderType: string;
	export let loaderVersion: string;
</script>

<div class="flex items-center gap-2">
	<Badge.Badge variant="outline" class="bg-black/30 text-white border-white/20 flex gap-1 items-center">
		<img src="/minecraft.png" class="w-4 h-4" alt="Minecraft icon" />
		{mcVersion}
	</Badge.Badge>
	<Badge.Badge variant="outline" class="flex items-center gap-1 bg-black/30 text-white border-white/20">
		{#if loaderType === 'fabric'}
			<img src="/fabric.png" class="w-4 h-4" alt="Fabric logo" />
		{:else}
			<img src="/milk.webp" class="w-4 h-4" alt="Vanilla logo" />
		{/if}
		{loaderType}
		{loaderType === 'fabric' ? loaderVersion : ''}
	</Badge.Badge>
</div>
