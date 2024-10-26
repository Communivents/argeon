<script lang="ts">
	import InstanceList from '$lib/components/app/instances/instance-list.svelte';
	import type { InstanceData } from '$lib/components/app/instances/types';
	import { ModeWatcher, setMode } from 'mode-watcher';
	import { loadInstances } from './ts/instances/api';
	import { Toaster } from '$lib/components/ui/sonner';
	import { Github } from 'lucide-svelte';
	import { os } from '@neutralinojs/lib';

	let instances: InstanceData[] = [];
	async function initInstancesData() {
		instances = await loadInstances();
	}

	setMode('dark');
</script>

<main class="p-10 mt-0">
	<Toaster richColors />
	<ModeWatcher />
	{#await initInstancesData()}
		<p>Loading...</p>
	{:then}
		<InstanceList bind:instances />
	{:catch error}
		<h2 class="text-red-500">An error occured while loading instances:</h2>
		<p class="text-red-300">{error}</p>
	{/await}
	<button
		class="fixed bottom-2 right-2 w-10 h-10 p-1 group"
		on:click={() => {
			os.open('https://github.com/Communivents/argeon');
		}}
	>
		<Github class="w-full h-full text-neutral-700 group-hover:text-neutral-100 transition-colors" />
	</button>
</main>
