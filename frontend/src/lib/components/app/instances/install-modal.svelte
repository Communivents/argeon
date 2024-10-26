<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import type { InstallationType, InstanceData } from './types';
	import { createMinecraftInstance } from '@/windows/main/ts/instances/create';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { events } from '@neutralinojs/lib';
	import { onMount, onDestroy } from 'svelte';

	export let instance: InstanceData;
	export let open = false;
	export let onOpenChange: (open: boolean) => void;

	let showReplaceAlertDialog = false;
	let lastChosenLauncher: InstallationType = 'minecraft';
	let installing = false;
	let progress = 0;
	let currentFile = '';
	let progressCount = '';

	// Use the correct Neutralino Response type
	let unsubscribePromise: Promise<events.Response> | null = null;

	onMount(async () => {
		unsubscribePromise = events.on('instanceCreationProgress', (evt: any) => {
			const data = evt.detail;
			progress = data.percentage;
			currentFile = data.filename;
			progressCount = `${data.current}/${data.total}`;
		});
	});

	onDestroy(async () => {
		if (unsubscribePromise) {
			await unsubscribePromise;
		}
	});

	async function handleInstall(launcher: InstallationType, force = false) {
		lastChosenLauncher = launcher;
		installing = true;
		progress = 0;
		try {
			const hasBeenCreated = await createMinecraftInstance(instance, launcher, force);
			if (!hasBeenCreated) {
				showReplaceAlertDialog = true;
			} else {
				onOpenChange(false);
			}
		} catch (err) {
			console.error(err);
		} finally {
			installing = false;
		}
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Install {instance.name}</Dialog.Title>
			<Dialog.Description>Choose where you'd like to install this instance</Dialog.Description>
		</Dialog.Header>

		{#if installing}
			<div class="py-4 space-y-4">
				<Progress value={progress} />
				<div class="text-sm text-muted-foreground">
					<div class="truncate">{currentFile}</div>
					<div>{progressCount}</div>
				</div>
			</div>
		{:else}
			<div class="grid gap-4 py-4">
				<!-- Minecraft Button with Emerald Border -->
				<div class="emerald-border p-[2px] rounded-md hover:scale-[1.02] transition-transform">
					<Button
						variant="outline"
						class="launcher-button w-full flex items-center justify-center gap-2 h-20 m-0 bg-background hover:bg-background/90 transition-colors focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-border/60"
						on:click={() => handleInstall('minecraft')}
					>
						<img src="/minecraft.png" alt="Minecraft Logo" class="w-8 h-8" />
						<span>Minecraft Launcher</span>
					</Button>
				</div>

				<!-- Prism Launcher Button with Rainbow Border -->
				<div class="rainbow-border p-[2px] rounded-md hover:scale-[1.02] transition-transform">
					<Button
						variant="outline"
						class="launcher-button w-full flex items-center justify-center gap-2 h-20 m-0 bg-background hover:bg-background/90 transition-colors focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-border/60"
						on:click={() => handleInstall('prism')}
					>
						<img src="/prism.webp" alt="Prism Launcher Logo" class="w-8 h-8" />
						<span>Prism Launcher</span>
					</Button>
				</div>
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="secondary" on:click={() => onOpenChange(false)} disabled={installing}>
				{installing ? 'Installing...' : 'Cancel'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={showReplaceAlertDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This instance already exists and if you continue, all previous data will be replaced and lost.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				on:click={() => {
					showReplaceAlertDialog = false;
					handleInstall(lastChosenLauncher, true);
				}}
			>
				Continue
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<style>
	@keyframes border-flow {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	.rainbow-border:hover {
		background: linear-gradient(
			90deg,
			#ff0000 0%,
			#ff8700 17%,
			#ffd300 33%,
			#00b326 50%,
			#0066ff 67%,
			#a958ff 83%,
			#ff0000 100%
		)
			0 0 / 200% 100%;
		animation: border-flow 4s linear infinite;
	}

	.emerald-border:hover {
		background: linear-gradient(90deg, #064e3b 0%, #059669 25%, #10b981 50%, #059669 75%, #064e3b 100%) 0 0 /
			200% 100%;
		animation: border-flow 4s linear infinite;
	}
</style>