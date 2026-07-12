<script lang="ts">
  import { syncStore } from "$lib/stores/sync.svelte";
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Input } from "$lib/components/ui/input";
  import Image from "$lib/components/ui/image.svelte";
  import {
    RadioIcon,
    Users2Icon,
    UserIcon,
    UsersRoundIcon,
  } from "@lucide/svelte/icons";
  import Spinner from "./ui/spinner/spinner.svelte";
</script>

{#if syncStore.status !== "disconnected"}
  <h2 class="text-lg font-bold absolute pt-5 px-2 z-10">Listen Together</h2>
{/if}
<div
  class="w-full h-12 absolute top-0 bg-linear-to-b from-background to-transparent z-5 pointer-events-none"
></div>
<div
  class="w-full h-12 absolute bottom-0 bg-linear-to-t from-background to-transparent z-5 pointer-events-none"
></div>

<ScrollArea class="flex-1 min-h-0 h-full" scrollbarYClasses="hidden">
  <div class="h-14"></div>

  <div class="flex flex-col gap-4 mt-2 pr-2">
    {#if syncStore.status === "disconnected"}
      <div class="flex flex-col gap-3 justify-center h-[80vh] px-2">
        <div
          class="w-[80%] animate-pulse h-32 bg-radial blur-2xl from-primary/80 to-transparent absolute left-1/2 -translate-x-1/2 -translate-y-5 -z-10"
        ></div>
        <div>
          <p class="text-2xl font-bold text-center">Listen Together</p>
          <p class="text-xs text-foreground/50 text-center">
            Listen to music with your friends in real-time.
          </p>
        </div>
        <Button
          variant="default"
          size="lg"
          onclick={() => syncStore.createRoom()}
          class="w-full rounded-full py-6 font-semibold flex items-center justify-center gap-2"
        >
          <RadioIcon class="size-4" />
          <span>Host a Session</span>
        </Button>

        <div class="relative flex py-1 items-center">
          <div class="flex-grow border-t border-border/50"></div>
          <span
            class="flex-shrink mx-3 text-muted-foreground text-[10px] uppercase font-bold"
            >or join one</span
          >
          <div class="flex-grow border-t border-border/50"></div>
        </div>

        <form
          onsubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const code = formData.get("code") as string;
            if (code) syncStore.joinRoom(code);
          }}
          class="flex gap-1"
        >
          <Input
            type="text"
            name="code"
            placeholder="Enter Room Code"
            class="w-full rounded-full h-10 px-4 py-2.5 text-center"
            required
          />
          <Button
            type="submit"
            variant="outline"
            class="rounded-full py-5 px-5"
          >
            Join
          </Button>
        </form>
      </div>
    {:else if syncStore.status === "connecting"}
      <div class="flex flex-col items-center justify-center gap-3 h-[80vh]">
        <Spinner />
        <p class="text-xs text-muted-foreground animate-pulse">Connecting...</p>
      </div>
    {:else if syncStore.status === "connected"}
      <div class="flex flex-col gap-4">
        {#if syncStore.role === "host"}
          <div
            class="flex items-center justify-between bg-primary/20 p-4 rounded-4xl"
          >
            <div>
              <p class="text-sm">Invite your friends!</p>
              <p class="text-[8px] text-foreground/50">
                Copy the code and share it with your friends.
              </p>
            </div>
            <Button
              size="sm"
              variant="default"
              onclick={() => {
                if (syncStore.roomCode) {
                  navigator.clipboard.writeText(syncStore.roomCode);
                }
              }}
            >
              Copy
            </Button>
          </div>
        {/if}

        <div class="flex flex-col gap-2">
          <div class="flex justify-between">
            <div
              class="text-xs font-semibold text-muted-foreground px-1 flex items-center gap-1.5"
            >
              <UsersRoundIcon class="size-3.5" />
              <span>Session Members ({syncStore.participants.length})</span>
            </div>

            <Button
              variant="destructive"
              size="xs"
              onclick={() => syncStore.leaveRoom()}
            >
              Leave
            </Button>
          </div>

          <div class="flex flex-col gap-1">
            {#each syncStore.participants as member}
              <div
                class="flex items-center justify-between text-xs py-1.5 bg-foreground/5 rounded-3xl px-3"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  {#if member.photoUrl}
                    <Image
                      src={member.photoUrl}
                      alt={member.name}
                      width={24}
                      height={24}
                      class="size-8 rounded-full object-cover border border-border shrink-0"
                    />
                  {:else}
                    <div
                      class="size-6 rounded-full bg-accent flex items-center justify-center shrink-0 border border-border"
                    >
                      <UserIcon class="size-3 text-muted-foreground" />
                    </div>
                  {/if}
                  <span
                    class="font-medium text-foreground truncate max-w-28"
                    title={member.name}
                  >
                    {member.name}
                  </span>
                </div>
                {#if member.role === "host"}
                  <span class="text-xs text-primary font-bold">HOST</span>
                {/if}
              </div>
            {/each}

            {#if syncStore.participants.length === 0}
              <div
                class="text-[11px] text-center text-muted-foreground/75 py-2"
              >
                No members in session
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if syncStore.error}
      <div
        class="text-xs text-center text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded-xl py-2 px-3"
      >
        {syncStore.error}
      </div>
    {/if}
  </div>
  {#if syncStore.status !== "disconnected"}
    <div class="h-14"></div>
  {/if}
</ScrollArea>
