<script lang="ts">
  import {
    ytmusic,
    toggleFloatingLyrics,
    isFloatingLyricsOpen,
    onFloatingLyricsStatus,
    toggleFloatingLyricsLock,
    isFloatingLyricsLocked,
    onFloatingLyricsLockStatus,
  } from "@app/preload";
  import { player } from "$lib/stores/player.svelte";
  import { Spinner } from "$lib/components/ui/spinner";
  import type { LyricResult, LyricLine } from "@app/api/src/types";
  import {
    Music2Icon,
    Music3Icon,
    PictureInPicture2Icon,
    LockIcon,
    UnlockIcon,
  } from "@lucide/svelte";
  import { GoogleService } from "../google-tl";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";

  let lyricsResult = $state<LyricResult | null>(null);
  let loading = $state(false);
  let containerEl = $state<HTMLDivElement | null>(null);
  let linesContainerEl = $state<HTMLDivElement | null>(null);
  let isUserScrolling = $state(false);
  let containerHeight = $state(0);
  let contentHeight = $state(0);
  let userScrollOffset = $state(0);
  let userScrollingTimeout: any = null;
  let {
    showInfo = false,
    isExtended = false,
    isFloating = false,
  }: {
    showInfo?: boolean;
    isExtended?: boolean;
    isFloating?: boolean;
  } = $props();

  // React to track and source changes
  $effect(() => {
    const track = player.currentTrack;
    const source = player.selectedSource;
    if (track) {
      fetchLyrics(
        track.videoId,
        track.name,
        track.artists.map((a) => a.name).join(" & "),
        track.duration || player.duration,
        source,
      );
    } else {
      lyricsResult = null;
    }
  });

  async function fetchLyrics(
    videoId: string,
    title: string,
    artist: string,
    duration?: number | null,
    source: string = "Auto",
  ) {
    loading = true;
    lyricsResult = null;
    try {
      const result = await ytmusic.getLyrics(
        videoId,
        title,
        artist,
        duration || undefined,
        source,
      );
      if (player.currentTrack?.videoId !== videoId) return;

      if (result && result.lines) {
        // Check if any line has original word-level timings
        const originalWordSynced = result.lines.some(
          (l) => l.words && l.words.length > 0,
        );
        result.wordSynced = originalWordSynced;

        // Step 1: Pre-populate faked words for line-synced lyrics
        for (let i = 0; i < result.lines.length; i++) {
          const line = result.lines[i];
          if (result.synced && !line.words) {
            const startTime = line.startTimeMs || 0;
            const nextStartTime =
              i < result.lines.length - 1
                ? result.lines[i + 1].startTimeMs || startTime
                : player.duration * 1000 || startTime + 4000;

            const wordsList = line.text.match(/\S+\s*/g) || [];
            const n = wordsList.length;

            line.words = wordsList.map((text, j) => ({
              startTimeMs: startTime + (j / n) * 300,
              text,
            }));
            line.isFaked = true;
          }
        }

        // Step 2: Insert instrumental breaks
        if (result.synced) {
          const processedLinesWithBreaks = [];
          const gapThreshold = 10000;

          const createInstrumental = (startTimeMs: number): LyricLine => ({
            startTimeMs,
            text: "-",
            isBackground: false,
            isInstrumental: true,
          });

          // Check if there's an instrumental break at the very beginning of the song
          if (
            result.lines.length > 0 &&
            (result.lines[0].startTimeMs || 0) > gapThreshold
          ) {
            processedLinesWithBreaks.push(createInstrumental(0));
          }

          for (let i = 0; i < result.lines.length; i++) {
            const line = result.lines[i];
            processedLinesWithBreaks.push(line);

            if (i < result.lines.length - 1) {
              const nextStartMs =
                result.lines[i + 1].startTimeMs || line.startTimeMs || 0;
              let lineEndMs = line.startTimeMs || 0;

              if (originalWordSynced && line.words && line.words.length > 0) {
                const lastWord = line.words[line.words.length - 1];
                // Use parsed durationMs if available, otherwise default to 300ms
                lineEndMs = lastWord.startTimeMs + (lastWord.durationMs || 300);
              } else {
                // For line-by-line sync (originalWordSynced is false), assume 4000ms duration
                lineEndMs = Math.min(
                  nextStartMs,
                  (line.startTimeMs || 0) + 4000,
                );
              }

              const gap = nextStartMs - lineEndMs;

              if (gap > gapThreshold) {
                processedLinesWithBreaks.push(createInstrumental(lineEndMs));
              }
            }
          }
          result.lines = processedLinesWithBreaks;
        }

        // Step 3: Normalize spacing and calculate durationMs / endTimeMs
        const processedLines = [];
        for (let i = 0; i < result.lines.length; i++) {
          const line = result.lines[i];
          const startTime = line.startTimeMs || 0;
          const nextStartTime =
            i < result.lines.length - 1
              ? result.lines[i + 1].startTimeMs || startTime
              : player.duration * 1000 || startTime + 4000;

          if (result.synced && line.words) {
            const isFaked = line.isFaked;

            // Clean up and normalize spacing
            const cleanWords = [];
            for (let j = 0; j < line.words.length; j++) {
              const word = line.words[j];
              if (word.text.trim() !== "") {
                cleanWords.push(word);
              }
            }

            for (let j = 0; j < cleanWords.length; j++) {
              const word = cleanWords[j];
              const current = word.text;
              const hasLeading = /^\s/.test(current);
              const hasTrailing = /\s$/.test(current);

              word.text = current.trim();

              if (hasLeading && j > 0) {
                const prev = cleanWords[j - 1];
                if (!prev.text.endsWith(" ")) {
                  prev.text += " ";
                }
              }

              if (hasTrailing && j < cleanWords.length - 1) {
                if (!word.text.endsWith(" ")) {
                  word.text += " ";
                }
              }

              // Compute durationMs
              const nextWord = cleanWords[j + 1];
              let duration = word.durationMs;
              if (!duration) {
                duration = nextWord
                  ? nextWord.startTimeMs - word.startTimeMs
                  : isFaked
                    ? 100
                    : nextStartTime - word.startTimeMs;
              }
              word.durationMs = duration > 0 ? duration : 300;
            }
            line.words = cleanWords;

            // Compute line.endTimeMs based on words (only for real word-synced lyrics)
            if (cleanWords.length > 0 && !line.isFaked) {
              const lastWord = cleanWords[cleanWords.length - 1];
              line.endTimeMs =
                lastWord.startTimeMs + (lastWord.durationMs || 300);
            } else {
              line.endTimeMs = nextStartTime;
            }
          } else {
            // For lines without words (instrumental, static, or unsynced lines)
            line.endTimeMs = nextStartTime;
          }
          processedLines.push(line);
        }
        result.lines = processedLines;
        lyricsResult = result;

        // Romanize non-Latin lyrics in the background
        try {
          const romanizedLines = await GoogleService.romanize(result.lines);
          if (player.currentTrack?.videoId === videoId) {
            lyricsResult = {
              synced: result.synced,
              source: result.source,
              wordSynced: result.wordSynced,
              lines: romanizedLines,
            };
          }
        } catch (romanizeError) {
          console.warn("Romanization failed:", romanizeError);
        }
      }
    } catch (e) {
      if (player.currentTrack?.videoId === videoId) {
        console.error("Failed to fetch lyrics:", e);
      }
    } finally {
      if (player.currentTrack?.videoId === videoId) {
        loading = false;
      }
    }
  }

  let interpolatedTime = $state(0);
  let lastAudioTime = 0;
  let lastUpdateTime = 0;
  let rafId: number;

  function updateInterpolatedTime() {
    if (player.isPlaying) {
      const now = performance.now();
      if (lastUpdateTime === 0) {
        lastUpdateTime = now;
      }
      const elapsed = (now - lastUpdateTime) / 1000;
      let targetTime = lastAudioTime + elapsed;

      if (player.audio && !player.audio.paused) {
        const actualTime = player.audio.currentTime;
        if (Math.abs(targetTime - actualTime) > 0.5) {
          targetTime = actualTime;
          lastAudioTime = actualTime;
          lastUpdateTime = now;
        }
      }
      interpolatedTime = targetTime;
    } else {
      interpolatedTime = player.currentTime;
    }
    rafId = requestAnimationFrame(updateInterpolatedTime);
  }

  // Anchor points synchronizer
  $effect(() => {
    const current = player.currentTime;
    lastAudioTime = current;
    lastUpdateTime = performance.now();
    interpolatedTime = current;
  });

  // RAF loop lifecycle
  $effect(() => {
    rafId = requestAnimationFrame(updateInterpolatedTime);
    return () => {
      cancelAnimationFrame(rafId);
    };
  });

  // Get offset-adjusted player time in milliseconds (compensates for audio latency)
  let adjustedTimeMs = $derived.by(() => {
    const timeMs = interpolatedTime * 1000;
    if (!lyricsResult) return timeMs;
    // Offset: +150ms for word-by-word sync, +115ms for line-level sync
    const offset = lyricsResult.wordSynced ? 150 : 115;
    return timeMs + offset;
  });

  function getFirstActiveIndex(timeMs: number) {
    if (!lyricsResult || !lyricsResult.synced) return -1;
    for (let i = 0; i < lyricsResult.lines.length; i++) {
      const line = lyricsResult.lines[i];
      if (
        line.startTimeMs !== undefined &&
        line.endTimeMs !== undefined &&
        line.startTimeMs <= timeMs &&
        timeMs < line.endTimeMs
      ) {
        return i;
      }
    }
    // Fallback: last past index
    let lastPastIndex = -1;
    for (let i = 0; i < lyricsResult.lines.length; i++) {
      const line = lyricsResult.lines[i];
      if (line.startTimeMs !== undefined && line.startTimeMs <= timeMs) {
        lastPastIndex = i;
      } else {
        break;
      }
    }
    return lastPastIndex;
  }

  // Calculate scroll target index based on first active line (or fallback)
  let scrollTargetIndex = $derived(getFirstActiveIndex(adjustedTimeMs));

  let activeIndicesStr = $derived.by(() => {
    if (!lyricsResult || !lyricsResult.synced) return "";
    const timeMs = adjustedTimeMs;
    const indices: number[] = [];
    for (let i = 0; i < lyricsResult.lines.length; i++) {
      const line = lyricsResult.lines[i];
      if (
        line.startTimeMs !== undefined &&
        line.endTimeMs !== undefined &&
        line.startTimeMs <= timeMs &&
        timeMs < line.endTimeMs
      ) {
        indices.push(i);
      }
    }
    if (indices.length === 0 && scrollTargetIndex !== -1) {
      indices.push(scrollTargetIndex);
    }
    return indices.join(",");
  });

  let pastIndicesStr = $derived.by(() => {
    if (!lyricsResult || !lyricsResult.synced) return "";
    const timeMs = adjustedTimeMs;
    const indices: number[] = [];
    for (let i = 0; i < lyricsResult.lines.length; i++) {
      const line = lyricsResult.lines[i];
      if (line.endTimeMs !== undefined && line.endTimeMs <= timeMs) {
        indices.push(i);
      }
    }
    return indices.join(",");
  });

  let stableTargetIndex = $derived(scrollTargetIndex);

  let scrollRatio = $derived(isFloating ? 0.3 : 0.45);

  let activeLineOffset = $derived.by(() => {
    if (stableTargetIndex === -1 || !containerEl || !linesContainerEl) {
      return containerHeight * scrollRatio;
    }
    const activeEl = linesContainerEl.querySelector(
      `[data-index="${stableTargetIndex}"]`,
    ) as HTMLElement;
    if (!activeEl) return containerHeight * scrollRatio;

    const activeOffsetTop = activeEl.offsetTop;
    const activeHeight = activeEl.clientHeight;
    return containerHeight * scrollRatio - activeOffsetTop - activeHeight / 2;
  });

  let translateY = $derived.by(() => {
    const rawY = activeLineOffset + userScrollOffset;
    const minY = containerHeight * scrollRatio - contentHeight;
    const maxY = containerHeight * scrollRatio;
    if (contentHeight > containerHeight) {
      return Math.max(minY, Math.min(maxY, rawY));
    }
    return rawY;
  });

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    isUserScrolling = true;

    const minY = containerHeight * scrollRatio - contentHeight;
    const maxY = containerHeight * scrollRatio;

    let targetOffset = userScrollOffset - event.deltaY;
    const rawY = activeLineOffset + targetOffset;
    if (rawY < minY) {
      targetOffset = minY - activeLineOffset;
    } else if (rawY > maxY) {
      targetOffset = maxY - activeLineOffset;
    }

    userScrollOffset = targetOffset;

    clearTimeout(userScrollingTimeout);
    userScrollingTimeout = setTimeout(() => {
      isUserScrolling = false;
      userScrollOffset = 0;
    }, 4000);
  }

  let isPointerDown = false;
  let isDragging = false;
  let startPointerY = 0;
  let startScrollOffset = 0;

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    isPointerDown = true;
    isDragging = false;
    startPointerY = event.clientY;
    startScrollOffset = userScrollOffset;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isPointerDown) return;
    const deltaY = event.clientY - startPointerY;

    if (!isDragging && Math.abs(deltaY) > 5) {
      isDragging = true;
      isUserScrolling = true;
      clearTimeout(userScrollingTimeout);
      containerEl?.setPointerCapture(event.pointerId);
    }

    if (isDragging) {
      const minY = containerHeight * scrollRatio - contentHeight;
      const maxY = containerHeight * scrollRatio;

      let targetOffset = startScrollOffset + deltaY;
      const rawY = activeLineOffset + targetOffset;
      if (rawY < minY) {
        targetOffset = minY - activeLineOffset;
      } else if (rawY > maxY) {
        targetOffset = maxY - activeLineOffset;
      }

      userScrollOffset = targetOffset;
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (isDragging) {
      containerEl?.releasePointerCapture(event.pointerId);
      isDragging = false;

      clearTimeout(userScrollingTimeout);
      userScrollingTimeout = setTimeout(() => {
        isUserScrolling = false;
        userScrollOffset = 0;
      }, 4000);
    }
  }

  function handleLineClick(line: LyricLine) {
    if (line.startTimeMs !== undefined) {
      player.seek(line.startTimeMs / 1000);
      isUserScrolling = false;
      userScrollOffset = 0;
    }
  }

  function getWordProgress(word: any, timeMs: number) {
    const elapsed = timeMs - word.startTimeMs;
    if (elapsed < 0) return 0;
    const duration = word.durationMs || 300;
    return elapsed >= duration ? 1 : elapsed / duration;
  }

  let isFloatingOpen = $state(false);
  let isFloatingLocked = $state(false);

  onMount(() => {
    isFloatingLyricsOpen().then((open) => {
      isFloatingOpen = open;
    });

    isFloatingLyricsLocked().then((locked) => {
      isFloatingLocked = locked;
    });

    const unsubscribeStatus = onFloatingLyricsStatus((open) => {
      isFloatingOpen = open;
    });

    const unsubscribeLockStatus = onFloatingLyricsLockStatus((locked) => {
      isFloatingLocked = locked;
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLockStatus();
    };
  });

  async function handleToggleFloating() {
    isFloatingOpen = await toggleFloatingLyrics();
  }

  async function handleToggleLock() {
    isFloatingLocked = await toggleFloatingLyricsLock();
  }
  const currentLyricsSize = $derived(
    isFloating
      ? player.lyricsFontSizeFloating
      : isExtended
        ? player.lyricsFontSizeExtended
        : player.lyricsFontSize
  );
</script>

<div
  class="flex flex-col h-full w-full select-none overflow-hidden relative"
  bind:clientHeight={containerHeight}
>
  {#if lyricsResult && lyricsResult.synced && !loading && !isFloating}
    <div
      class="absolute top-4 right-4 z-50 flex gap-2"
      style="app-region: no-drag;"
    >
      {#if isFloatingOpen}
        <Button
          variant="outline-blur"
          size="icon"
          onclick={handleToggleLock}
          class="rounded-full size-9 text-muted-foreground hover:text-foreground shadow-glass"
          title={isFloatingLocked
            ? "Unlock Desktop Lyrics Position"
            : "Lock Desktop Lyrics Position"}
        >
          {#if isFloatingLocked}
            <LockIcon class="size-4.5" />
          {:else}
            <UnlockIcon class="size-4.5" />
          {/if}
        </Button>
      {/if}
      <Button
        variant="outline-blur"
        size="icon"
        onclick={handleToggleFloating}
        class="rounded-full size-9 shadow-glass {isFloatingOpen
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground'}"
        title={isFloatingOpen ? "Close Desktop Lyrics" : "Open Desktop Lyrics"}
      >
        <PictureInPicture2Icon class="size-4.5" />
      </Button>
    </div>
  {/if}
  {#if loading}
    <div class="flex flex-col items-center justify-center flex-1 gap-3">
      <Spinner />
      <p class="text-xs text-muted-foreground animate-pulse">
        Loading lyrics...
      </p>
    </div>
  {:else if !lyricsResult || !lyricsResult.lines || lyricsResult.lines.length === 0}
    <div
      class="flex flex-col items-center justify-center flex-1 text-center p-6"
    >
      <p class="text-muted-foreground font-semibold">No lyrics available</p>
      <p class="text-xs text-muted-foreground/60 mt-1">
        We couldn't find lyrics for this song.
      </p>
    </div>
  {:else}
    <!-- Container with overflow-hidden or overflow-y-auto depending on sync status -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={containerEl}
      onwheel={lyricsResult.synced ? handleWheel : null}
      onpointerdown={lyricsResult.synced ? handlePointerDown : null}
      onpointermove={lyricsResult.synced ? handlePointerMove : null}
      onpointerup={lyricsResult.synced ? handlePointerUp : null}
      class="flex-1 px-6 relative {lyricsResult.synced
        ? 'overflow-hidden cursor-grab active:cursor-grabbing'
        : 'overflow-y-auto scrollbar-none py-12'}"
      style="--lyric-font-size: {1.5 * currentLyricsSize}rem;
             --lyric-size-multiplier: {currentLyricsSize};"
    >
      <div
        bind:this={linesContainerEl}
        bind:clientHeight={contentHeight}
        class="flex flex-col w-full select-none {isFloating
          ? 'gap-4'
          : 'gap-6'}"
      >
        {#each lyricsResult.lines as line, index}
          {@const isActive = activeIndicesStr
            .split(",")
            .includes(index.toString())}
          {@const isPast = pastIndicesStr.split(",").includes(index.toString())}
          {@const distance =
            isUserScrolling || stableTargetIndex === -1
              ? 0
              : Math.min(
                  isExtended ? 20 : 3,
                  Math.abs(index - stableTargetIndex),
                )}
          {@const viewportTopIndex = Math.max(0, stableTargetIndex - 4)}
          {@const staggerDelay = isUserScrolling
            ? 0
            : Math.max(0, index - viewportTopIndex) * 50}
          <div
            data-index={index}
            class={lyricsResult.synced ? "will-change-transform" : ""}
            style={lyricsResult.synced
              ? `transform: translateY(${translateY}px); transition: ${
                  isUserScrolling
                    ? "transform 0.2s cubic-bezier(0.33, 1, 0.68, 1);"
                    : "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);"
                };`
              : ""}
          >
            {#if lyricsResult.synced && line.words}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => handleLineClick(line)}
                class="lyric-line {isActive ? 'active' : isPast ? 'past' : ''}"
                class:is-background={line.isBackground}
                class:is-extended={isExtended}
                class:is-floating={isFloating}
                style="--distance: {distance};"
              >
                <div class="main-line flex flex-wrap">
                  {#each line.words as word, wIndex}
                    {@const progress = isActive
                      ? getWordProgress(word, adjustedTimeMs)
                      : isPast
                        ? 1
                        : 0}
                    {@const isWordActive = progress > 0 && progress < 1}
                    {@const isWordPast = progress >= 1}
                    {@const isTransition =
                      wIndex > 0 &&
                      word.isBackground !== line.words[wIndex - 1].isBackground}
                    {#if isTransition}
                      <div class="w-full {isFloating ? 'h-0.5' : 'h-2'}"></div>
                    {/if}
                    <span
                      class="word-wrapper {isWordPast
                        ? 'past'
                        : isWordActive
                          ? 'active'
                          : ''}"
                      class:is-background={word.isBackground}
                    >
                      <span
                        class="word-span"
                        style="--progress: {progress};"
                        data-text={word.text}
                      >
                        {word.text}
                      </span>
                    </span>
                  {/each}
                </div>
                {#if line.romanizedText}
                  <span
                    class="romanized-line text-[0.6em] font-bold leading-normal {isFloating
                      ? 'mt-0.5'
                      : 'mt-1'} select-none transition-opacity"
                  >
                    {line.romanizedText}
                  </span>
                {/if}
              </div>
            {:else}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => handleLineClick(line)}
                class="lyric-line {isActive ? 'active' : isPast ? 'past' : ''}"
                class:is-background={line.isBackground}
                class:is-instrumental={line.isInstrumental}
                class:is-extended={isExtended}
                class:is-floating={isFloating}
                style="--distance: {distance};"
              >
                {#if line.isInstrumental}
                  <Music2Icon
                    strokeWidth={4}
                    class={isExtended
                      ? "size-[2vw]"
                      : isFloating
                        ? "size-[4.5vw]"
                        : ""}
                  />
                {:else}
                  <div class="main-line">
                    {line.text}
                  </div>
                  {#if line.romanizedText}
                    <span
                      class="romanized-line text-[0.6em] font-bold leading-normal {isFloating
                        ? 'mt-0.5'
                        : 'mt-1'} select-none transition-opacity"
                    >
                      {line.romanizedText}
                    </span>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Source footer info -->
    {#if showInfo}
      <div
        class="p-3 border-t border-border/40 bg-background/25 backdrop-blur-md flex items-center justify-between text-[10px] text-muted-foreground/50"
      >
        <span
          >Sync: {lyricsResult.synced
            ? lyricsResult.wordSynced
              ? "Word-by-word"
              : "Line-by-line"
            : "Unsynced"}</span
        >
        <span>Source: {lyricsResult.source}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  @keyframes blyrics-wobble {
    0% {
      transform: scaleX(1);
    }
    12.5% {
      transform: translateY(-0.1em) scaleX(1.025);
      animation-timing-function: ease-in-out;
    }
    75% {
      transform: translateY(0) scaleX(1);
    }
    100% {
      transform: scaleX(1);
      animation-timing-function: ease-out;
    }
  }

  .lyric-line {
    cursor: pointer;
    transform-origin: left center;
    word-break: break-word;
    transform: scale(0.95);
    display: flex;
    flex-flow: column nowrap;
    align-items: flex-start;
    align-content: flex-start;
    font-weight: 600;
    text-align: left;
    line-height: 1.333;
    font-size: var(--lyric-font-size, 1.5rem);

    /* Progressive blur and opacity based on distance from active index */
    /* --blur-amount: calc(var(--distance, 0) * 0.5px); */
    --opacity-amount: calc(1 - var(--distance, 0) * 0.1);
    opacity: max(0.15, var(--opacity-amount));
    /* filter: blur(var(--blur-amount)); */

    transition:
      transform 0.4s ease,
      opacity 0.4s ease,
      filter 0.4s ease;
  }

  .lyric-line.active {
    transform: scale(1.03);
    opacity: 1;
  }

  .lyric-line.is-extended {
    transform: scale(0.95) translateX(calc(var(--distance, 0) * -10px + 3rem));
    margin-left: 50%;
    width: 45%;
    font-size: calc(2.5vw * var(--lyric-size-multiplier, 1.0));
    transition:
      transform 1.5s ease,
      opacity 0.4s ease,
      filter 0.4s ease;
  }

  .word-wrapper {
    transform: translateZ(0);
    backface-visibility: hidden;
    display: inline-block;
    transform-origin: left center;
    will-change: transform;
    transition: transform 0.5s cubic-bezier(0.33, 1, 0.68, 1);
  }

  .word-wrapper.active {
    transform: translateY(-0.08em) scaleX(1.04);
  }

  .word-span {
    transform: translateZ(0);
    backface-visibility: hidden;
    position: relative;
    display: inline-block;
    color: rgba(255, 255, 255, 0.25);
    white-space: pre-wrap;
    transform-origin: left center;
    filter: drop-shadow(0 0 0.4rem rgba(255, 255, 255, 0));
  }

  .word-wrapper.active .word-span {
    color: transparent;
    background: linear-gradient(
      to right,
      #ffffff calc(var(--progress, 0) * 100% - 8px),
      rgba(255, 255, 255, 0.25) calc(var(--progress, 0) * 100% + 8px)
    );
    -webkit-background-clip: text;
    background-clip: text;
    filter: drop-shadow(0 0 0.4rem rgba(255, 255, 255, 1));
    transition: filter 0.2s ease;
  }

  .word-wrapper.past .word-span {
    color: #ffffff;
    filter: drop-shadow(0 0 0rem rgba(255, 255, 255, 0));
    transition: filter 2s ease;
  }

  .lyric-line.is-background {
    font-size: 1.2rem;
    opacity: calc(max(0.15, var(--opacity-amount)) * 0.6);
  }

  .lyric-line.is-extended.is-background {
    font-size: calc(2vw * var(--lyric-size-multiplier, 1.0));
  }

  .lyric-line.is-background.active {
    opacity: 0.65;
  }

  .word-wrapper.is-background {
    font-size: 1.2rem;
    opacity: 0.7;
  }

  .lyric-line.is-extended .word-wrapper.is-background {
    font-size: calc(2vw * var(--lyric-size-multiplier, 1.0));
  }

  .lyric-line.is-instrumental {
    opacity: calc(max(0.15, var(--opacity-amount)) * 0.2);
  }

  .lyric-line.is-instrumental.past {
    opacity: calc(max(0.15, var(--opacity-amount)) * 0.8);
  }

  .lyric-line.is-instrumental.active {
    opacity: 0.8;
  }

  .lyric-line .romanized-line {
    opacity: max(0.15, var(--opacity-amount) * 0.2);
  }

  .lyric-line.active .romanized-line {
    opacity: 1;
  }

  .lyric-line.past .romanized-line {
    opacity: max(0.15, var(--opacity-amount) * 0.8);
  }

  .lyric-line.is-floating {
    transform-origin: center center;
    align-items: center;
    align-content: center;
    text-align: center;
    font-size: calc(5vw * var(--lyric-size-multiplier, 1.0));
  }

  .lyric-line.is-floating .word-wrapper.is-background {
    font-size: calc(4.5vw * var(--lyric-size-multiplier, 1.0));
  }

  .lyric-line.is-floating .main-line {
    justify-content: center;
    text-align: center;
  }
</style>
