<script lang="ts">
  import { 
    minimizeWindow, 
    maximizeWindow, 
    closeWindow, 
    isWindowMaximized, 
    onMaximizedStatus, 
    platform 
  } from "@app/preload";
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import { MinusIcon, SquareIcon, CopyIcon, XIcon } from "@lucide/svelte/icons";
  import { onMount } from "svelte";

  // Window Controls should only display on Windows/Linux.
  // macOS automatically renders native controls on the top-left of the frameless window.
  let showControls = $derived(platform !== "darwin");
  let isMaximized = $state(false);

  onMount(() => {
    if (typeof window !== "undefined") {
      isWindowMaximized().then((val) => {
        isMaximized = val;
      });

      const unsubscribe = onMaximizedStatus((val) => {
        isMaximized = val;
      });

      return unsubscribe;
    }
  });
</script>

{#if showControls}
  <div 
    class="absolute top-[clamp(0.5rem,1vw,1rem)] right-[clamp(0.5rem,1vw,1rem)] z-500 flex items-center select-none" 
    style="app-region: no-drag;"
  >
    <ButtonGroup.Root
      class="rounded-full bg-background/50 backdrop-blur-md border border-border h-[clamp(2.2rem,2.5vw,2.6rem)] items-center flex px-2 gap-1.5 shadow-glass hover:shadow-glass-hover transition-all duration-300 overflow-hidden"
      data-glow
    >
      <!-- Minimize Button -->
      <Button
        variant="link"
        size="icon-sm"
        active-scale="child"
        onclick={minimizeWindow}
        class="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-0 w-[clamp(1.6rem,2vw,1.8rem)] h-[clamp(1.6rem,2vw,1.8rem)] rounded-full hover:bg-foreground/5"
        title="Minimize"
      >
        <MinusIcon class="size-[clamp(0.9rem,1.1vw,1.1rem)]" />
      </Button>

      <div class="w-[1px] h-3 my-auto bg-border/40"></div>

      <!-- Maximize / Restore Button -->
      <Button
        variant="link"
        size="icon-sm"
        active-scale="child"
        onclick={maximizeWindow}
        class="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-0 w-[clamp(1.6rem,2vw,1.8rem)] h-[clamp(1.6rem,2vw,1.8rem)] rounded-full hover:bg-foreground/5"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {#if isMaximized}
          <CopyIcon class="size-[clamp(0.8rem,0.95vw,0.95rem)]" />
        {:else}
          <SquareIcon class="size-[clamp(0.8rem,0.95vw,0.95rem)]" />
        {/if}
      </Button>

      <div class="w-[1px] h-3 my-auto bg-border/40"></div>

      <!-- Close Button -->
      <Button
        variant="link"
        size="icon-sm"
        active-scale="child"
        onclick={closeWindow}
        class="text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center p-0 w-[clamp(1.6rem,2vw,1.8rem)] h-[clamp(1.6rem,2vw,1.8rem)] rounded-full hover:bg-destructive/10"
        title="Close"
      >
        <XIcon class="size-[clamp(0.9rem,1.1vw,1.1rem)]" />
      </Button>
    </ButtonGroup.Root>
  </div>
{/if}
