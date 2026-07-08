# 🎵 Tutti — Desktop YouTube Music Client

**Tutti** is a beautifully designed, highly modular desktop client for YouTube Music. It is built as a modern Electron application using a monorepo workspace architecture powered by Vite, Svelte 5, TypeScript, and Tailwind CSS.

---

## ✨ Features

- **🎨 Desktop Experience**: A modern, immersive UI built with [Svelte 5 (Runes)](https://svelte.dev) and [Tailwind CSS v4](https://tailwindcss.com) and [Electron](https://www.electronjs.org/).
- **🎵 YouTube Music Integration**: Instant streaming access to songs, videos, albums, playlists, and artists directly from YouTube Music.
- **📜 Synced Lyrics & Playback**: Integrated audio player featuring queue management, track progress control, and synchronized lyrics support.
- **🗂️ Library & History Management**: Easily browse and organize your personal playlists, liked songs, albums, subscriptions, and playback history.
- **🔑 Secure Authentication**: Native integration with Google accounts that securely logs you in and encrypts your credentials using OS-level keys (`safeStorage`).
- **🚀 Ultra-fast Performance**: Background request caching (`node-fetch-cache`) ensures search results and lyrics load almost instantaneously.

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js**: `v23.0.0` or higher is required (recommended for optimal performance).
- **npm**: Standard Node Package Manager.

### Step-by-Step Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd vite-electron-builder
   ```

2. **Run the Init Script**:
   Tutti provides a convenient initialization pipeline that installs workspace packages, builds scripts, and sets up Svelte/Tailwind integrations:
   ```bash
   npm run init
   ```
   *Note: This command runs the local `create-renderer` utility to ensure all packages are fully wired together before running dependencies installations.*

---

## 🚀 Running & Developing

### Development Mode

Start the Vite development server for Svelte and launch the Electron application concurrently with hot-module reloading enabled:
```bash
npm start
```
*Behind the scenes, this runs `packages/dev-mode.js` which spins up Svelte first, maps its localhost port to `VITE_DEV_SERVER_URL`, and starts main/preload processes with watch-mode active.*

### Typechecking

Verify type definitions across all packages simultaneously:
```bash
npm run typecheck
```

### Packaging & Compiling

Build production-ready code bundles for all workspaces and package the application into a distribution installer via `electron-builder`:
```bash
npm run compile
```
- Built outputs will be placed in the `dist/` directory.
- Workspaces specify what gets bundled using the standard `files` array inside their respective `package.json` configurations.

---

## 🔒 Security & Privacy

Tutti enforces several layers of security to keep user credentials safe:
1. **Host Origin Isolation**: Restricts API calls to verified YouTube and Google login endpoints.
2. **Encrypted Cookies**: YouTube Music session state details are encrypted using OS-level keys (`safeStorage`), meaning session information cannot be easily accessed outside of the application instance.
3. **Context Isolation**: Frontend code is decoupled from Node APIs; it can only invoke sandboxed functions provided by `@app/preload`.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).