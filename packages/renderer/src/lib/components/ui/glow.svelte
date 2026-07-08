<script lang="ts">
  import { onMount } from "svelte";

  let container: HTMLDivElement;
  let isHovered = $state(false);
  let isActive = $state(false);

  function handleMouseMove(event: MouseEvent) {
    if (!container) return;

    // Calculate mouse position relative to the container
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Update CSS variables for high-performance rendering
    container.style.setProperty("--mouse-x", `${x}px`);
    container.style.setProperty("--mouse-y", `${y}px`);
  }

  onMount(() => {
    const parent = container.parentElement;
    if (!parent) return;

    const handleEnter = () => (isHovered = true);
    const handleLeave = () => {
      isHovered = false;
      isActive = false;
    };
    const handleMouseDown = () => (isActive = true);
    const handleMouseUp = () => (isActive = false);

    parent.addEventListener("mousemove", handleMouseMove);
    parent.addEventListener("mouseenter", handleEnter);
    parent.addEventListener("mouseleave", handleLeave);
    parent.addEventListener("mousedown", handleMouseDown);
    parent.addEventListener("mouseup", handleMouseUp);

    return () => {
      parent.removeEventListener("mousemove", handleMouseMove);
      parent.removeEventListener("mouseenter", handleEnter);
      parent.removeEventListener("mouseleave", handleLeave);
      parent.removeEventListener("mousedown", handleMouseDown);
      parent.removeEventListener("mouseup", handleMouseUp);
    };
  });
</script>

<div
  bind:this={container}
  role="presentation"
  class="absolute size-full pointer-events-none"
>
  <div
    class="
		absolute w-10 h-10 rounded-full pointer-events-none
		bg-radial from-white to-transparent
		blur-lg
        mix-blend-overlay
		left-(--mouse-x) top-(--mouse-y) -translate-x-1/2 -translate-y-1/2
		transition-[opacity,transform,scale]! duration-500 ease-out will-change-[top,left,opacity,transform,scale]
	"
    class:opacity-100={isHovered}
    class:opacity-0={!isHovered}
    class:scale-150={isActive}
  ></div>
</div>
