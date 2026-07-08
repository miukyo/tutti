class NavigationStore {
  historyIndex = $state(0);
  historyStack = $state<string[]>([]);

  canGoBack = $derived(this.historyIndex > 0);
  canGoForward = $derived(this.historyIndex < this.historyStack.length - 1);

  init() {
    if (typeof window !== "undefined") {
      this.historyStack = [window.location.hash || "#/"];
      this.historyIndex = 0;

      window.addEventListener("hashchange", () => {
        const currentHash = window.location.hash || "#/";

        // If we went back to a hash that matches the previous index
        if (this.historyIndex > 0 && this.historyStack[this.historyIndex - 1] === currentHash) {
          this.historyIndex--;
        }
        // If we went forward to a hash that matches the next index
        else if (this.historyIndex < this.historyStack.length - 1 && this.historyStack[this.historyIndex + 1] === currentHash) {
          this.historyIndex++;
        }
        // Otherwise, it is a new navigation (push state)
        else {
          // Truncate any forward history if we were in the middle of back history
          this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
          this.historyStack.push(currentHash);
          this.historyIndex = this.historyStack.length - 1;
        }
      });
    }
  }

  back() {
    if (this.canGoBack) {
      window.history.back();
    }
  }

  forward() {
    if (this.canGoForward) {
      window.history.forward();
    }
  }
}

export const navigation = new NavigationStore();
