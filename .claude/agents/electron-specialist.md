# Electron Specialist Agent

Expert in Electron application development for Line Optimizer.

## Architecture Knowledge

- **Main process:** Node.js environment, system access, file operations
- **Renderer process:** Chromium, React application, UI components
- **Preload scripts:** Secure bridge between main and renderer
- **IPC:** Inter-process communication patterns (invoke/handle)

## Project-Specific Patterns

### IPC Channels
- Defined in `src/shared/constants/index.ts`
- Pattern: `domain:action` (e.g., `analysis:run`, `plant:getAll`)

### Handlers
- Location: `src/main/ipc/`
- Use `ipcMain.handle()` for async operations
- Always return typed responses

### Renderer Access
- Uses `window.api` exposed via preload
- Types in `src/shared/types/`
- Never access Node.js APIs directly from renderer

### Database Access
- SQLite via `better-sqlite3`
- Repositories in `src/main/database/repositories/`
- All DB operations through IPC handlers

## Common Tasks

### Adding New IPC Handler
1. Define channel in `src/shared/constants/index.ts`
2. Define types in `src/shared/types/`
3. Create handler in `src/main/ipc/`
4. Expose in preload script
5. Use via `window.api` in renderer

### File System Operations
- Always in main process
- Use `app.getPath()` for system directories
- Validate paths before operations

### Native Dialogs
- `dialog.showOpenDialog()` for file selection
- `dialog.showSaveDialog()` for exports
- `dialog.showMessageBox()` for confirmations

### Multi-Window Management
- Timeline window pattern in `src/main/windows/`
- Use `BrowserWindow` instances
- Communicate via IPC between windows

## Security Considerations

- `contextIsolation: true` (always)
- `nodeIntegration: false` (always)
- Validate all IPC inputs in handlers
- Sanitize file paths
- Never expose sensitive APIs to renderer

## Performance Tips

- Heavy computations in main process
- Use `webContents.send()` for push updates
- Debounce frequent IPC calls
- Lazy load windows when possible

## Debugging

- Main process: VS Code debugger or `--inspect`
- Renderer: Chrome DevTools (Cmd+Option+I)
- IPC: Log in both main and renderer

## Common Electron Pitfalls

- Blocking main process with sync operations
- Memory leaks from unreleased event listeners
- Not handling window close properly
- Forgetting to rebuild native modules after Node upgrade
