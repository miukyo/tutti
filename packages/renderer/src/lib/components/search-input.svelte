<script lang="ts">
  import { SearchIcon } from "@lucide/svelte/icons";
  import { ytmusic } from "@app/preload";
  import { Button } from "$lib/components/ui/button";
  import * as InputGroup from "$lib/components/ui/input-group/";
  import { push } from "svelte-spa-router";
  import { Portal } from "bits-ui";

  import { fly } from "svelte/transition";

  let searchQuery = $state("");
  let suggestions = $state<string[]>([]);
  let suggestionsVisible = $state(false);
  let searchInputWrapper = $state<HTMLElement | null>(null);
  let dropdownRect = $state({ top: 0, left: 0, width: 0 });
  let activeIndex = $state(-1);
  let dropdownContainer = $state<HTMLElement | null>(null);

  let searchInput = $state<HTMLInputElement | null>(null);

  let searchTimeout: any;
  async function handleSearchInput(e: Event) {
    clearTimeout(searchTimeout);
    const val = (e.target as HTMLInputElement).value;
    searchQuery = val;
    updateDropdownPosition();
    if (!val.trim()) {
      suggestions = [];
      suggestionsVisible = false;
      activeIndex = -1;
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        suggestions = await ytmusic.getSearchSuggestions(val);
        suggestionsVisible = suggestions.length > 0;
        activeIndex = -1;
        updateDropdownPosition();
      } catch (err) {
        console.error(err);
      }
    }, 300);
  }

  function updateDropdownPosition() {
    if (searchInputWrapper) {
      const rect = searchInputWrapper.getBoundingClientRect();
      dropdownRect = {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      };
    }
  }

  function triggerSearch(query: string) {
    if (!query.trim()) return;
    suggestionsVisible = false;
    activeIndex = -1;
    push(`/search/${encodeURIComponent(query)}`);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        searchQuery = suggestions[activeIndex];
        triggerSearch(suggestions[activeIndex]);
      } else {
        triggerSearch(searchQuery);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        activeIndex = (activeIndex + 1) % suggestions.length;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0) {
        activeIndex =
          (activeIndex - 1 + suggestions.length) % suggestions.length;
      }
    } else if (e.key === "Escape") {
      suggestionsVisible = false;
      activeIndex = -1;
    }
  }
</script>

<div bind:this={searchInputWrapper} class="w-full relative">
  <InputGroup.Root style="app-region: no-drag;">
    <InputGroup.Input
      bind:ref={searchInput}
      placeholder="Search"
      value={searchQuery}
      oninput={handleSearchInput}
      onkeydown={handleKeyDown}
      onfocus={() => {
        updateDropdownPosition();
        if (suggestions.length > 0) {
          suggestionsVisible = true;
        }
      }}
      onblur={() =>
        setTimeout(() => {
          suggestionsVisible = false;
        }, 200)}
    />
    <Button
      variant="ghost"
      size="icon-sm"
      onclick={() => triggerSearch(searchQuery)}
    >
      <SearchIcon class="size-4" />
    </Button>
  </InputGroup.Root>
</div>

<!-- Search suggestions dropdown (Portaled via bits-ui to avoid clipping) -->
<Portal>
  {#if suggestionsVisible && suggestions.length > 0}
    <div
      bind:this={dropdownContainer}
      transition:fly={{ y: -8, duration: 150 }}
      style="position: absolute; top: {dropdownRect.top}px; left: {dropdownRect.left}px; width: {dropdownRect.width}px;"
      class="bg-popover text-popover-foreground border border-border rounded-4xl shadow-glass z-[999] flex flex-col p-1 mt-1 outline-none"
      role="listbox"
    >
      {#each suggestions as suggestion, index}
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-2xl transition-colors cursor-pointer outline-none"
          class:bg-muted={activeIndex === index}
          class:text-primary={activeIndex === index}
          onclick={() => {
            searchQuery = suggestion;
            triggerSearch(suggestion);
          }}
        >
          {suggestion}
        </button>
      {/each}
    </div>
  {/if}
</Portal>
