<script lang="ts" module>
  import { link } from "svelte-spa-router";
  import active from "svelte-spa-router/active";
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";
  import { type VariantProps, tv } from "tailwind-variants";

  export const buttonVariants = tv({
    base: "focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 aria-invalid:border-destructive rounded-4xl border border-transparent text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer",
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-glass hover:shadow-glass-hover hover:bg-primary/90",
        outline:
          "border-border hover:bg-foreground/10 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground shadow-glass hover:shadow-glass-hover",
        "outline-blur":
          "text-foreground border border-border bg-background/50 backdrop-blur-sm shadow-glass hover:shadow-glass-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground shadow-glass hover:shadow-glass-hover",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 text-destructive focus-visible:border-destructive/40 shadow-glass hover:shadow-glass-hover",
        link: "text-secondary-foreground underline-offset-4 hover:underline",
      },
      "active-scale": {
        default:
          "active:not-aria-[haspopup]:scale-90 transition-transform origin-center",
        child:
          "active:not-aria-[haspopup]:**:not-[[role='presentation']]:scale-90 **:not-[[role='presentation']]:transition-transform **:not-[[role='presentation']]:origin-center",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      "active-scale": "default",
    },
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
  export type ButtonSize = VariantProps<typeof buttonVariants>["size"];
  export type ButtonActiveScale = VariantProps<
    typeof buttonVariants
  >["active-scale"];

  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
      "active-scale"?: ButtonActiveScale;
    };
</script>

<script lang="ts">
  let {
    class: className,
    variant = "default",
    size = "default",
    "active-scale": activeScale = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    use:link
    use:active
    data-slot="button"
    data-glow={variant !== "link" ? "" : undefined}
    class={cn(
      buttonVariants({ variant, size, "active-scale": activeScale }),
      variant !== "link" && "relative overflow-hidden",
      className,
    )}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? "link" : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    data-glow={variant !== "link" ? "" : undefined}
    class={cn(
      buttonVariants({ variant, size, "active-scale": activeScale }),
      variant !== "link" && "relative overflow-hidden",
      className,
    )}
    {type}
    {disabled}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}
