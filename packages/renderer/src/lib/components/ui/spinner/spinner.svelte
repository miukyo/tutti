<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { LoaderCircleIcon, LoaderIcon } from "@lucide/svelte";
  import type { SVGAttributes } from "svelte/elements";

  let {
    class: className,
    role = "status",
    variant = "line",
    // we add name, color, and stroke for compatibility with different icon libraries props
    name,
    color,
    stroke,
    "aria-label": ariaLabel = "Loading",
    ...restProps
  }: SVGAttributes<SVGSVGElement> & {
    variant?: "line" | "circle";
  } = $props();
</script>

{#if variant === "line"}
  <LoaderIcon
    {role}
    name={name === null ? undefined : name}
    color={color === null ? undefined : color}
    stroke={stroke === null ? undefined : stroke}
    aria-label={ariaLabel}
    class={cn("size-4 animate-spin", className)}
    {...restProps}
  />
{:else if variant === "circle"}
  <LoaderCircleIcon
    {role}
    name={name === null ? undefined : name}
    color={color === null ? undefined : color}
    stroke={stroke === null ? undefined : stroke}
    aria-label={ariaLabel}
    class={cn("size-4 animate-spin", className)}
    {...restProps}
  />
{/if}
