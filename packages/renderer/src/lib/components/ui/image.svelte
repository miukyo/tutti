<script lang="ts">
  let {
    src,
    alt = "",
    class: className = "",
    width = undefined,
    height = undefined,
    ...restProps
  }: {
    src?: string;
    alt?: string;
    class?: string;
    width?: number;
    height?: number;
    [key: string]: any;
  } = $props();

  let currentSrc = $state<string | undefined>(undefined);
  let loading = $state(true);
  let error = $state(false);

  function modifyImageUrl(url: string, w?: number, h?: number): string {
    if (!w && !h) return url;

    // 1. Handle w60-h60-l90-rj format
    if (url.includes("=w") && url.includes("-h")) {
      const targetWidth = w || h || 120;
      const targetHeight = h || w || 120;
      return url.replace(/=w\d+-h\d+/, `=w${targetWidth}-h${targetHeight}`);
    }

    // 2. Handle s192 format
    if (url.includes("=s")) {
      const targetSize = w || h || 192;
      return url.replace(/=s\d+/, `=s${targetSize}`);
    }

    return url;
  }

  function tryLoadImage(imgSrc?: string) {
    if (!imgSrc) {
      error = true;
      loading = false;
      return;
    }

    loading = true;
    error = false;

    const modifiedSrc = modifyImageUrl(imgSrc, width, height);

    const img = new globalThis.Image();
    img.src = modifiedSrc;

    img.onload = () => {
      currentSrc = modifiedSrc;
      loading = false;
      error = false;
    };

    img.onerror = () => {
      loading = false;
      error = true;
    };
  }

  $effect(() => {
    tryLoadImage(src);
  });
</script>

{#if loading}
  <div class="bg-muted animate-pulse size-full {className}"></div>
{:else if error || !currentSrc}
  <div
    class="bg-muted flex items-center justify-center text-xs text-muted-foreground font-semibold size-full {className}"
  >
    ⚠️
  </div>
{:else}
  <img src={currentSrc} {alt} class={className} {...restProps} />
{/if}
