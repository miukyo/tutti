<script lang="ts">
  import { onMount } from "svelte";

  let glowEl: HTMLDivElement;
  let currentTarget: HTMLElement | null = $state(null);
  let isHovered = $state(false);
  let isActive = $state(false);

  function handleMouseMove(e: MouseEvent) {
    if (!glowEl) return;
    const target = (e.target as HTMLElement).closest("[data-glow]");
    if (target instanceof HTMLElement) {
      currentTarget = target;
      if (glowEl.parentElement !== target) {
        target.appendChild(glowEl);
      }
      isHovered = true;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glowEl.style.setProperty("--mouse-x", `${x}px`);
      glowEl.style.setProperty("--mouse-y", `${y}px`);
    } else {
      isHovered = false;
      isActive = false;
      currentTarget = null;
    }
  }

  onMount(() => {
    const handleMouseDown = () => {
      if (currentTarget) isActive = true;
    };

    const handleMouseUp = () => {
      isActive = false;
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mouseup", handleMouseUp, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
    };
  });
</script>

<div
  bind:this={glowEl}
  role="presentation"
  class="absolute pointer-events-none inset-0 size-full overflow-hidden"
>
  <div
    class="
		absolute w-10 h-10 rounded-full pointer-events-none
		bg-radial from-white to-transparent
		blur-lg
        mix-blend-screen
		left-(--mouse-x) top-(--mouse-y) -translate-x-1/2 -translate-y-1/2
		transition-[opacity,transform,scale]! duration-500 ease-out will-change-[top,left,opacity,transform,scale]
	"
    class:opacity-60={isHovered}
    class:opacity-0={!isHovered}
    class:scale-150={isActive}
  ></div>
</div>
