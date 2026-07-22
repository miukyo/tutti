<script lang="ts">
  import {
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    isWindowMaximized,
    onMaximizedStatus,
    platform,
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
    class="flex items-center select-none"
    style="app-region: no-drag;"
  >
    <ButtonGroup.Root
      class="rounded-full bg-background/50 backdrop-blur-sm border border-border h-10 items-center flex px-2 gap-1 shadow-glass hover:shadow-glass-hover transition-shadow overflow-hidden"
      data-glow
    >
      <!-- Minimize Button -->
      <Button
        variant="link"
        size="icon-sm"
        active-scale="child"
        onclick={minimizeWindow}
        class="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-0 size-8 rounded-full hover:bg-foreground/5"
        title="Minimize"
      >
        <MinusIcon class="size-5" />
      </Button>

      <div class="w-[1px] h-3 my-auto bg-border/40"></div>

      <!-- Maximize / Restore Button -->
      <Button
        variant="link"
        size="icon-sm"
        active-scale="child"
        onclick={maximizeWindow}
        class="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-0 size-8 rounded-full hover:bg-foreground/5"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {#if isMaximized}
          <CopyIcon class="size-5" />
        {:else}
          <SquareIcon class="size-5" />
        {/if}
      </Button>

      <div class="w-[1px] h-3 my-auto bg-border/40"></div>

      <!-- Close Button -->
      <Button
        variant="link"
        size="icon-sm"
        active-scale="child"
        onclick={closeWindow}
        class="text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center p-0 size-8 rounded-full hover:bg-destructive/10"
        title="Close"
      >
        <XIcon class="size-5" />
      </Button>
    </ButtonGroup.Root>
  </div>
{/if}
