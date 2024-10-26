<script lang="ts">
	import InstanceList from '$lib/components/app/instances/instance-list.svelte';
	import type { InstanceData } from '$lib/components/app/instances/types';
	import { ModeWatcher, setMode } from 'mode-watcher';
	import { loadInstances } from './ts/instances/api';
	import { Toaster } from "$lib/components/ui/sonner";

	let instances: InstanceData[] = [];
	async function initInstancesData() {
		instances = await loadInstances();
	}

	setMode('dark');
</script>

<main class="p-10 mt-0">
	<Toaster richColors/>
	<ModeWatcher />
	{#await initInstancesData()}
		<p>Loading...</p>
	{:then}
		<InstanceList bind:instances />
	{:catch error}
		<h2 class="text-red-500">An error occured while loading instances:</h2>
		<p class="text-red-300">{error}</p>
	{/await}
</main>
