# Contributing to Tutti

Thank you for your interest in contributing to Tutti! We welcome contributions of all forms—bug fixes, features, documentation, and issues. Please review this guide to get started.

---

## 🤝 Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors. Please treat everyone with respect and empathy.

---

## 🐛 Submitting Issues

If you find a bug or have a suggestion for improvement:
1. **Search Existing Issues**: Ensure the issue hasn't been reported or discussed before.
2. **Be Descriptive**: Explain how to reproduce the bug, what you expected, and what actually occurred.
3. **Include Environment Details**: Share your Operating System, Node.js version, and Electron version.

---

## 🛠️ Local Development & Workflow

### 1. Setting Up the Project

Prerequisites: Node.js >= 23.0.0

```bash
git clone https://github.com/miukyo/tutti.git
cd tutti
npm install
```

### 2. Monorepo Workspace Operations

Tutti uses npm workspaces. The workspaces are defined inside `packages/`:

- **Install a dependency globally in the monorepo (as devDependency)**:
  ```bash
  npm install -D <package-name>
  ```
- **Install a dependency into a specific workspace** (e.g., `@app/renderer`):
  ```bash
  npm install <package-name> -w @app/renderer
  ```
- **Run a script in a specific workspace**:
  ```bash
  npm run build -w @app/main
  ```

---

## ✏️ Coding Standards & Conventions

### Frontend Development (`packages/renderer`)

- **Svelte 5**: Use **Svelte 5 Runes** (`$state`, `$derived`, `$effect`, `$props`) instead of Svelte 4 reactive declarations.
- **Styling**: Use **Tailwind CSS v4** utility classes and shadcn-svelte components.
- **Assets**: Keep local icons and assets inside the `packages/renderer/src/assets` directory.

### Backend Development (`packages/main`)

- **Modular Modules**: Do not place arbitrary logic directly inside the main `initApp` routine. Build features as modular `AppModule` objects inside `packages/main/src/modules/` and initialize them via `ModuleRunner`.
- **Module Interface**:
  ```typescript
  import type { AppModule } from '../AppModule.js';
  import type { ModuleContext } from '../ModuleContext.js';

  export function myCustomModule(): AppModule {
    return {
      async enable(context: ModuleContext) {
        // Module setup logic here (e.g. listening to IPC messages)
      }
    };
  }
  ```

### Preload & IPC APIs (`packages/preload` & `packages/api`)

- **Strict Context Isolation**: Do not expose raw Node/Electron modules (e.g., `fs`, `ipcRenderer`, `child_process`) directly to the window context.
- **Dynamic API Exposure**: Exposed methods in `packages/preload/src/index.ts` are automatically obfuscated using Base64 encoding. If you add a new IPC bridge function, export it from `packages/preload/src/index.ts` so it is automatically mounted in the main world.

### Security Guidelines

- **Origin Filtering**: Ensure any network endpoints or frame sources are explicitly allowed inside the `allowInternalOrigins` module lists.
- **Encryption**: Always use Electron's `safeStorage` API to store user secrets, login credentials, or session cookies on disk.

---

## 💬 Commit Message Guidelines

We follow **Conventional Commits** guidelines for clear project histories:

- `feat:` A new feature.
- `fix:` A bug fix.
- `docs:` Documentation-only changes.
- `style:` Formatting, missing semi-colons, etc. (no code changes).
- `refactor:` Refactoring application code (no new features/bug fixes).
- `test:` Adding or correcting tests.
- `chore:` Updating build tasks, dependencies, package configurations, etc.

*Example:* `feat: add playlist shuffle button to player bar`

---

## 🚀 Submitting a Pull Request

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-cool-feature
   ```
2. **Write clean code** adhering to our standards.
3. **Validate your changes**:
   - Run typechecks: `npm run typecheck`
   - Run build: `npm run build`
   - Run Playwright E2E tests: `npm run test`
4. **Push your branch** and submit a Pull Request.
5. **Describe your changes**: Explain what you did and why, and link any related issues.
