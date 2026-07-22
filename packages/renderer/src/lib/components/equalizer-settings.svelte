<script lang="ts">
  import { equalizer, EQ_FREQUENCIES, EQ_PRESETS } from "$lib/stores/equalizer.svelte";
  import { Slider as SliderPrimitive } from "bits-ui";
  import Switch from "./ui/switch/switch.svelte";
  import * as Select from "./ui/select";

  // Svelte 5 reactive array for local slider bindings to prevent direct mutations issues
  let bandsState = $state([0, 0, 0, 0, 0]);

  // Synchronize local UI state with store values
  $effect(() => {
    bandsState = [...equalizer.bands];
  });

  function handleBandChange(index: number, val: number) {
    equalizer.setBand(index, val);
  }

  function handlePresetChange(presetName: string) {
    equalizer.setPreset(presetName);
  }

  function formatFreq(freq: number): string {
    return freq >= 1000 ? `${freq / 1000} kHz` : `${freq} Hz`;
  }
</script>

<div class="flex flex-col gap-6 w-full">
  <div>
    <h3 class="text-base font-semibold leading-none tracking-tight">
      Audio Equalizer
    </h3>
    <p class="text-sm text-muted-foreground mt-1">
      Adjust audio frequency response to customize your listening experience.
    </p>
  </div>

  <div class="flex flex-col gap-6 border-t border-border/40 pt-4">
    <!-- Equalizer Enable/Disable Toggle -->
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-medium">Enable Equalizer</span>
        <span class="text-xs text-muted-foreground">
          Turn the 5-band equalizer on or off.
        </span>
      </div>
      <Switch
        checked={equalizer.enabled}
        onCheckedChange={(checked) => equalizer.toggle(checked)}
      />
    </div>

    <!-- Equalizer Presets Dropdown -->
    <div class="flex items-center justify-between {!equalizer.enabled ? 'opacity-50 pointer-events-none' : ''} transition-opacity">
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-medium">Preset</span>
        <span class="text-xs text-muted-foreground">
          Select a predefined sound profile.
        </span>
      </div>
      <div class="w-[180px]">
        <Select.Root
          type="single"
          value={equalizer.preset}
          onValueChange={handlePresetChange}
        >
          <Select.Trigger
            class="w-full shadow-glass bg-background/50 border border-border backdrop-blur-md rounded-full focus-visible:ring-0 overflow-hidden"
            data-glow
          >
            {equalizer.preset}
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              class="bg-background/50 backdrop-blur-md border border-border/80 rounded-3xl p-1 z-500 shadow-glass w-[180px]"
            >
              {#each EQ_PRESETS as preset}
                <Select.Item value={preset.name} label={preset.name} />
              {/each}
              {#if equalizer.preset === "Custom"}
                <Select.Item value="Custom" label="Custom" />
              {/if}
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
    </div>

    <!-- Sliders for the 5 bands -->
    <div class="flex flex-col gap-4 mt-2 {!equalizer.enabled ? 'opacity-50 pointer-events-none' : ''} transition-opacity">
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Frequency Bands (dB)
      </p>

      <div class="grid grid-cols-5 gap-3 h-56 bg-background/20 rounded-3xl border border-border/40 p-4 pt-6 pb-8 items-center justify-items-center relative">
        {#each EQ_FREQUENCIES as freq, index}
          <div class="flex flex-col items-center gap-1.5 h-full w-full justify-center">
            <!-- 4. Perbesar sedikit label dB di atas tiap slider dan pastikan jaraknya (margin-bottom) lebih dekat -->
            <span class="text-xs font-semibold text-muted-foreground select-none mb-1">
              {bandsState[index] > 0 ? `+${bandsState[index]}` : bandsState[index]} dB
            </span>
            
            <div class="h-32 flex items-center justify-center relative w-8">
              <!-- 3. Tambahkan grid halus (horizontal guide lines) di background tiap slider track (interval 3dB, total 9 baris dari -12 ke +12) -->
              <div class="absolute inset-y-0 inset-x-0 pointer-events-none flex flex-col justify-between z-0">
                {#each Array(9) as _, i}
                  <div class="w-full border-t border-muted/10 dark:border-foreground/10 h-0"></div>
                {/each}
              </div>

              <SliderPrimitive.Root
                type="single"
                orientation="vertical"
                min={-12}
                max={12}
                step={1}
                bind:value={bandsState[index]}
                onValueChange={(val: any) => handleBandChange(index, Array.isArray(val) ? (val[0] ?? 0) : val)}
                class="relative flex flex-col h-full items-center touch-none select-none group cursor-pointer w-6 z-10"
              >
                {#snippet children({ thumbItems })}
                  {@const val = bandsState[index]}
                  {@const percentage = ((val + 12) / 24) * 100}
                  {@const isPositive = val >= 0}
                  {@const fillHeight = isPositive ? (percentage - 50) : (50 - percentage)}
                  {@const fillBottom = isPositive ? 50 : percentage}
                  <span
                    data-slot="slider-track"
                    class="bg-input/90 rounded-full w-1.5 h-full bg-muted relative grow overflow-hidden"
                  >
                    <!-- 1. Garis tengah/reference line di 0 dB -->
                    <span class="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-foreground/30 z-10"></span>

                    <span
                      class="bg-primary absolute left-0 right-0 select-none transition-all duration-75"
                      style="bottom: {fillBottom}%; height: {fillHeight}%;"
                    ></span>
                  </span>
                  {#each thumbItems as thumb (thumb.index)}
                    <SliderPrimitive.Thumb
                      data-slot="slider-thumb"
                      index={thumb.index}
                      class="focus-visible:ring-ring/30 h-4 w-6 rounded-full bg-primary shadow-md transition-[color,box-shadow,background-color] not-dark:bg-clip-padding focus-visible:ring-4 focus-visible:outline-hidden block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50 z-20"
                    />
                  {/each}
                {/snippet}
              </SliderPrimitive.Root>
            </div>
            
            <!-- 5. Perjelas jarak antara label frekuensi (Hz/kHz) di bawah slider dengan track-nya — kurangi sedikit gap-nya -->
            <span class="text-[10px] font-medium text-foreground text-center truncate w-full mt-1.5 select-none">
              {formatFreq(freq)}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
