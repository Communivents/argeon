<script lang="ts">
	import type { InstanceData } from './types';
	import InstanceCard from './instance-card.svelte';

	export let instances: InstanceData[] = [];
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
	{#each instances as instance}
		<InstanceCard {instance} />
	{/each}
</div>
