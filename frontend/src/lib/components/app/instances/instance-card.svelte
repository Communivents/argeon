<script lang="ts">
	import type { InstanceData } from './types';
	import { stringToColor } from './utils';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Download, Play } from 'lucide-svelte';
	import ModList from './mod-list.svelte';
	import InstanceBadges from './instance-badges.svelte';
	import InstallModal from './install-modal.svelte';
	import { getPrismLauncherInstancePath, startPrismInstance } from '@/windows/main/ts/instances/instance';
	import { pathExists } from '@/windows/main/ts/utils';
	import { filesystem, events } from '@neutralinojs/lib';
	import path from 'path-browserify';

	export let instance: InstanceData;

	let showInstallModal = false;
	const backgroundColor = stringToColor(instance.name);

	function handleInstallClick(event: MouseEvent) {
		if (prismInstanceName) {
			startPrismInstance(prismInstanceName);
		} else {
			event.stopPropagation();
			showInstallModal = true;
		}
	}

	const mods = instance.files.mods.filter((mod) => mod.filename.endsWith('.jar'));

	// Update the download/play button if the PrismLauncher instance is installed
	let prismInstanceName: string | null = null;
	async function checkCanPlay() {
		try {
			const instancePath = await getPrismLauncherInstancePath(instance);
			if (!(await pathExists(instancePath))) return;
			const cfgContent = await filesystem.readFile(path.join(instancePath, 'instance.cfg'));
			const nameLine = cfgContent.split('\n').find((line) => line.startsWith('name='));
			if (!nameLine) return;
			prismInstanceName = nameLine.trim().slice(5);
		} catch (err) {
			console.warn(`Couldn't check if the instance "${instance.name}" is already installed in prism.`);
		}
	}
	checkCanPlay();

	events.off(`check_play:${instance.name}`, checkCanPlay);
	events.on(`check_play:${instance.name}`, checkCanPlay);
</script>

<InstallModal {instance} open={showInstallModal} onOpenChange={(open) => (showInstallModal = open)} />

<div class="group">
	<Card.Root
		class="card-container transform transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden relative"
		style="border-color: {backgroundColor};"
		on:click={() => (showInstallModal = true)}
	>
		<!-- Minimized State -->
		<div class="p-4 flex justify-between items-start">
			<div class="flex flex-col text-card-foreground overflow-hidden">
				<h2 class="text-xl font-semibold text-white truncate">
					{instance.name}
				</h2>
				<p class="text-sm text-white/50 line-clamp-2">{instance.description || 'No description provided'}</p>
			</div>

			<Button variant="ghost" size="icon" class="text-white/50 hover:text-white hover:bg-white/10 z-10 flex-shrink-0 ml-2" on:click={handleInstallClick}>
				{#if prismInstanceName}
					<Play class="w-6 h-6 fill-green-500 text-green-500" />
				{:else}
					<Download class="h-5 w-5" />
				{/if}
			</Button>
		</div>

		<!-- Expanded State -->
		<div class="expand-content border-t border-white/10 bg-black/30 backdrop-blur-sm">
			<div class="p-4 space-y-4">
				<InstanceBadges mcVersion={instance.minecraft_version} loaderType={instance.loader.type} loaderVersion={instance.loader.version} />

				<div class="flex items-center justify-between text-white/80">
					<div class="text-sm">
						Java {instance.java.minimum_version} • {instance.java.recommended_memory} RAM
					</div>
					<div class="text-sm">
						{mods.length > 0 ? mods.length : ''}
						{mods.length > 0 ? (mods.length > 1 ? 'total mods' : 'mod') : 'No mods'}
					</div>
				</div>

				{#if mods.length > 0}
					<ModList {mods} />
				{/if}
			</div>
		</div>
	</Card.Root>
</div>

<style>
	.expand-content {
		max-height: 0;
		opacity: 0;
		transform: translateY(10px);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		visibility: hidden;
	}

	.group:hover .expand-content {
		max-height: 500px;
		opacity: 1;
		transform: translateY(0);
		visibility: visible;
	}
</style>
