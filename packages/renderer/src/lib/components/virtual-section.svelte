<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
  let element: HTMLDivElement;
  let isVisible = $state(false);

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        isVisible = entry.isIntersecting;
      },
      {
        rootMargin: "400px 0px 400px 0px", // Pre-render when within 400px of viewport
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  });
</script>

<div bind:this={element} class="min-h-[305px]">
  {#if isVisible}
    {@render children()}
  {:else}
    <div class="h-[305px]"></div>
  {/if}
</div>
