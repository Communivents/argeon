<script lang="ts">
	import type { InstanceData } from './types';
	import { stringToColor } from './utils';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Download } from 'lucide-svelte';
	import ModList from './mod-list.svelte';
	import InstanceBadges from './instance-badges.svelte';
	import InstallModal from './install-modal.svelte';

	export let instance: InstanceData;

	let showInstallModal = false;
	const backgroundColor = stringToColor(instance.name);

	function handleInstallClick(event: MouseEvent) {
		event.stopPropagation();
		showInstallModal = true;
	}

  const mods = instance.files.mods.filter(mod => mod.filename.endsWith(".jar"))
</script>

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

      <Button 
        variant="ghost" 
        size="icon" 
        class="text-white/50 hover:text-white hover:bg-white/10 z-10 flex-shrink-0 ml-2" 
        on:click={handleInstallClick}
      >
        <Download class="h-5 w-5" />
      </Button>
    </div>

    <!-- Expanded State -->
    <div
      class="expand-content border-t border-white/10 bg-black/30 backdrop-blur-sm"
    >
      <div class="p-4 space-y-4">
        <InstanceBadges 
          mcVersion={instance.minecraft_version} 
          loaderType={instance.loader.type} 
          loaderVersion={instance.loader.version} 
        />

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