<script lang="ts">
  import { ytmusic } from "@app/preload";
  import { player } from "$lib/stores/player.svelte";
  import { Spinner } from "$lib/components/ui/spinner";
  import type { LyricResult, LyricLine } from "@app/api/src/types";
  import { Music2Icon, Music3Icon } from "@lucide/svelte";
  import { GoogleService } from "../google-tl";

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
  }: { showInfo?: boolean; isExtended?: boolean } = $props();

  // React to track changes
  $effect(() => {
    const track = player.currentTrack;
    if (track) {
      fetchLyrics(track.videoId, track.name, track.artist, track.duration);
    } else {
      lyricsResult = null;
    }
  });

  async function fetchLyrics(
    videoId: string,
    title: string,
    artist: string,
    duration?: number | null,
  ) {
    loading = true;
    lyricsResult = null;
    try {
      const result = await ytmusic.getLyrics(
        videoId,
        title,
        artist,
        duration || undefined,
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
    if (player.isPlaying && player.audio && !player.audio.paused) {
      const now = performance.now();
      const elapsed = (now - lastUpdateTime) / 1000;
      let targetTime = lastAudioTime + elapsed;
      const actualTime = player.audio.currentTime;

      if (Math.abs(targetTime - actualTime) > 0.5) {
        targetTime = actualTime;
        lastAudioTime = actualTime;
        lastUpdateTime = now;
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

  function isLineActive(line: LyricLine, timeMs: number) {
    if (!lyricsResult || !lyricsResult.synced) return false;
    return (
      line.startTimeMs !== undefined &&
      line.endTimeMs !== undefined &&
      line.startTimeMs <= timeMs &&
      timeMs < line.endTimeMs
    );
  }

  // Calculate scroll target index based on first active line (or fallback)
  let scrollTargetIndex = $derived(getFirstActiveIndex(adjustedTimeMs));

  let stableTargetIndex = $state(-1);
  let lastIndexChangeTime = 0;

  // Track track changes to reset time and index immediately
  $effect(() => {
    if (player.currentTrack) {
      lastIndexChangeTime = 0;
      stableTargetIndex = -1;
    }
  });

  $effect(() => {
    const newIndex = scrollTargetIndex;
    if (newIndex === -1) {
      stableTargetIndex = -1;
      return;
    }

    const now = performance.now();
    const timeSinceLastChange = now - lastIndexChangeTime;

    let timeoutId: any = null;

    if (timeSinceLastChange >= 3000) {
      stableTargetIndex = newIndex;
      lastIndexChangeTime = now;
    } else {
      const delay = 3000 - timeSinceLastChange;
      timeoutId = setTimeout(() => {
        stableTargetIndex = newIndex;
        lastIndexChangeTime = performance.now();
      }, delay);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  let activeLineOffset = $derived.by(() => {
    if (stableTargetIndex === -1 || !containerEl || !linesContainerEl) {
      return containerHeight * 0.45;
    }
    const activeEl = linesContainerEl.querySelector(
      `[data-index="${stableTargetIndex}"]`,
    ) as HTMLElement;
    if (!activeEl) return containerHeight * 0.45;

    const activeOffsetTop = activeEl.offsetTop;
    const activeHeight = activeEl.clientHeight;
    return containerHeight * 0.45 - activeOffsetTop - activeHeight / 2;
  });

  let translateY = $derived.by(() => {
    const rawY = activeLineOffset + userScrollOffset;
    const minY = containerHeight * 0.45 - contentHeight;
    const maxY = containerHeight * 0.45;
    if (contentHeight > containerHeight) {
      return Math.max(minY, Math.min(maxY, rawY));
    }
    return rawY;
  });

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    isUserScrolling = true;

    const minY = containerHeight * 0.45 - contentHeight;
    const maxY = containerHeight * 0.45;

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
      const minY = containerHeight * 0.45 - contentHeight;
      const maxY = containerHeight * 0.45;

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
      lastIndexChangeTime = 0;
    }
  }

  function getWordProgress(word: any, isLineActive: boolean) {
    if (!isLineActive) return adjustedTimeMs >= word.startTimeMs ? 1 : 0;
    const elapsed = adjustedTimeMs - word.startTimeMs;
    if (elapsed < 0) return 0;
    const duration = word.durationMs || 300;
    return elapsed >= duration ? 1 : elapsed / duration;
  }
</script>

<div
  class="flex flex-col h-full w-full select-none overflow-hidden"
  bind:clientHeight={containerHeight}
>
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
      style="--lyric-font-size: {player.lyricsFontSize === 'small'
        ? '1.2rem'
        : player.lyricsFontSize === 'large'
          ? '1.8rem'
          : '1.5rem'};"
    >
      <div
        bind:this={linesContainerEl}
        bind:clientHeight={contentHeight}
        class="flex flex-col gap-6 w-full select-none"
      >
        {#each lyricsResult.lines as line, index}
          {@const isActive = isLineActive(line, adjustedTimeMs)}
          {@const isPast =
            lyricsResult.synced &&
            line.endTimeMs !== undefined &&
            line.endTimeMs <= adjustedTimeMs}
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
                    : "transform 2s cubic-bezier(0.65, 0, 0.35, 1)"
                }; transition-delay: ${staggerDelay}ms;`
              : ""}
          >
            {#if lyricsResult.synced && line.words}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => handleLineClick(line)}
                class="lyric-line {isActive ? 'active' : isPast ? 'past' : ''}"
                class:is-background={line.isBackground}
                class:is-extended={isExtended}
                style="--distance: {distance};"
              >
                <div class="main-line flex flex-wrap">
                  {#each line.words as word, wIndex}
                    {@const progress = getWordProgress(word, isActive)}
                    {@const isWordActive = progress > 0 && progress < 1}
                    {@const isWordPast = progress >= 1}
                    {@const isTransition =
                      wIndex > 0 &&
                      word.isBackground !== line.words[wIndex - 1].isBackground}
                    {#if isTransition}
                      <div class="w-full h-2"></div>
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
                  <div
                    class="romanized-line text-muted-foreground/60 text-[0.6em] font-normal leading-normal mt-1 select-none"
                  >
                    {line.romanizedText}
                  </div>
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
                style="--distance: {distance};"
              >
                {#if line.isInstrumental}
                  <Music2Icon
                    strokeWidth={4}
                    class={isExtended ? "size-[2vw]" : ""}
                  />
                {:else}
                  <div class="main-line">
                    {line.text}
                  </div>
                  {#if line.romanizedText}
                    <div
                      class="romanized-line text-muted-foreground/60 text-[0.6em] font-normal leading-normal mt-1 select-none"
                    >
                      {line.romanizedText}
                    </div>
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

  @keyframes blyrics-glow {
    0% {
      filter: drop-shadow(0 0 0rem rgba(255, 255, 255, 0));
    }
    1% {
      filter: drop-shadow(0 0 0.4rem rgba(255, 255, 255, 1));
    }
    100% {
      filter: drop-shadow(0 0 0rem rgba(255, 255, 255, 0));
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
    --blur-amount: calc(var(--distance, 0) * 0.5px);
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
    filter: drop-shadow(0 0 0.8rem rgba(255, 255, 255, 0.3));
    transition:
      transform 0.25s ease,
      opacity 0.25s ease,
      filter 0.25s ease;
  }

  .lyric-line.is-extended {
    transform: scale(0.95) translateX(calc(var(--distance, 0) * -10px + 3rem));
    margin-left: 50%;
    width: 45%;
    font-size: 2.5vw;
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
    transition:
      transform 0.3s ease,
      drop-shadow 0.33s ease;
    animation: blyrics-wobble 1s forwards ease;
    animation-play-state: paused;
  }

  .word-wrapper.active {
    animation-play-state: running;
  }

  .word-wrapper.past {
    animation-play-state: running;
  }

  .word-span {
    transform: translateZ(0);
    backface-visibility: hidden;
    position: relative;
    display: inline-block;
    color: rgba(255, 255, 255, 0.25);
    white-space: pre-wrap;
    transform-origin: left center;
    animation: blyrics-glow 2s forwards ease;
    animation-play-state: paused;
  }

  .word-wrapper.active .word-span {
    color: #ffffff;
    background: linear-gradient(
      to right,
      #ffffff calc(var(--progress, 0) * 100% - 8px),
      rgba(255, 255, 255, 0.25) calc(var(--progress, 0) * 100% + 8px)
    );
    -webkit-background-clip: text;
    background-clip: text;
    animation-play-state: initial;
  }

  .word-wrapper.past .word-span {
    color: #ffffff;
    animation-play-state: running;
  }

  .lyric-line.is-background {
    font-size: 1.2rem;
    opacity: calc(max(0.15, var(--opacity-amount)) * 0.6);
  }

  .lyric-line.is-extended.is-background {
    font-size: 2vw;
  }

  .lyric-line.is-background.active {
    opacity: 0.65;
  }

  .word-wrapper.is-background {
    font-size: 1.2rem;
    opacity: 0.7;
  }

  .lyric-line.is-extended .word-wrapper.is-background {
    font-size: 2vw;
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
</style>
