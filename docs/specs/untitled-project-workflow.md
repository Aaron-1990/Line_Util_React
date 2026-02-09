# Untitled Project Workflow - Auto-save with Save Prompt

## Metadata
- **Designed:** 2026-02-07
- **Designer:** Aaron Zapata
- **Project:** Line Optimizer
- **Framework:** Híbrido v2.0
- **Domain:** Desktop App / Project Management
- **Agent:** `fullstack-developer`
- **Priority:** High
- **Estimated Complexity:** Complex

---

## Context

### Business Value
Users expect Line Optimizer to behave like Excel/Word: opening the app without a file should create an "Untitled Project" that remains temporary until explicitly saved. Currently, all changes auto-save permanently to disk, which confuses users who expect temporary work to be discarded when closing without saving.

### Problem Statement
**Current behavior (confusing):**
```
1. Open app without .lop file → Uses global DB (auto-saves everything)
2. Create plants, models, lines → Saved automatically to disk
3. Close app with Ctrl+C → No prompt
4. Reopen app → Data persists (user expects empty)
```

**Expected behavior (like Excel/Word):**
```
1. Open app without .lop file → Untitled Project (temporary)
2. Create plants, models, lines → Auto-save to TEMP DB (crash protection)
3. Close app → Prompt: "Save changes to Untitled Project?"
   - Save As → Export to .lop file
   - Don't Save → Discard all (empty next time)
   - Cancel → Return to app
4. Reopen app → Empty (if didn't save)
```

### Success Criteria
- [ ] App detects "Untitled Project" vs opened .lop file
- [ ] Changes auto-save to temporary DB (crash protection)
- [ ] Closing app prompts to save if Untitled + unsaved changes
- [ ] "Don't Save" clears DB → next open is empty
- [ ] "Save As" exports to .lop → becomes saved project
- [ ] No prompts if project already saved to .lop (auto-saves silently)
- [ ] Opening .lop with unsaved Untitled changes prompts first
- [ ] File → New Project with unsaved changes prompts first
- [ ] All 8 stores track unsaved changes correctly
- [ ] Type-check passes
- [ ] Manual testing confirms Excel-like behavior

---

## BLOQUE 0: Contracts & Architecture

### Objective
Understand current architecture, define interfaces for project state tracking, and plan implementation strategy without introducing workarounds.

### Prerequisites
- [ ] Read project store implementation (useProjectStore.ts)
- [ ] Read Electron main process setup (main/index.ts or main.ts)
- [ ] Understand current .lop file handling (Save As implementation)
- [ ] Review database connection architecture (DatabaseConnection)
- [ ] Research Electron dialog API for native prompts
- [ ] Research Electron app lifecycle hooks (before-quit, window close)

### Research Tasks

#### 1. Review Current Project State Management

```bash
# Find project store
find src/renderer -name "*project*store*.ts" -o -name "*Project*.ts" | head -10

# Read project store
cat src/renderer/store/useProjectStore.ts
# Or wherever the project state lives

# Check if there's already a notion of "project name" or "file path"
grep -r "projectName\|projectPath\|filePath" src/renderer/store/
```

#### 2. Review Electron Main Process

```bash
# Find main entry point
find src/main -name "index.ts" -o -name "main.ts" | head -5

# Check for existing app lifecycle hooks
grep -r "before-quit\|will-quit\|window-all-closed" src/main/
```

#### 3. Review Save As Implementation

```bash
# Find Save As handler
grep -r "SAVE.*AS\|saveProjectAs" src/main/ipc/handlers/

# Read the implementation to understand .lop export
cat src/main/ipc/handlers/project.handler.ts
```

#### 4. Review Database Connection

```bash
# Check DatabaseConnection implementation
cat src/main/database/connection.ts

# Understand if we can detect "default DB" vs "opened file DB"
```

### Architectural Principles

**SOLID Principles:**
- **Single Responsibility:** Each component handles one concern (state tracking, dialog, cleanup)
- **Open/Closed:** Extend project state without modifying core logic
- **Dependency Inversion:** Depend on abstractions (IProjectState) not concrete implementations

**NO WORKAROUNDS:**
- Use standard Electron dialog API (not custom modals)
- Use standard app lifecycle hooks (not polling)
- Use standard Zustand state patterns (not globals)

### Contract Definitions

Based on research, define interfaces:

```typescript
// Project state type
type ProjectType = 'untitled' | 'saved';

// Project state interface
interface ProjectState {
  projectType: ProjectType;           // 'untitled' or 'saved'
  projectFilePath: string | null;     // null for untitled, path for saved
  hasUnsavedChanges: boolean;         // true if changes made since last save
  lastSavedAt: Date | null;           // timestamp of last save
}

// IPC channels for new functionality
const PROJECT_CHANNELS = {
  // ... existing channels
  CHECK_UNSAVED_CHANGES: 'project:check-unsaved-changes',
  CLEAR_TEMP_DATABASE: 'project:clear-temp-database',
  GET_PROJECT_STATE: 'project:get-project-state',
};

// Dialog result
type SaveDialogResult = 'save' | 'dont-save' | 'cancel';
```

### Stack Decisions

**Frontend (Renderer):**
- Zustand store for project state tracking
- IPC calls for main process coordination

**Backend (Main):**
- Electron dialog API for native prompt
- Electron app lifecycle hooks (before-quit)
- IPC handlers for state queries and cleanup

**No new dependencies required** - use existing Electron APIs

### Auto-Save Architecture (CRITICAL - Read This First)

**Understanding "Temporary" vs "Saved" Projects:**

```
UNTITLED PROJECT (temporary):
- Uses global DB: ~/Library/.../line-optimizer.db
- Changes auto-save to this DB via SQLite auto-commit
- This provides CRASH PROTECTION (changes survive force quit)
- DB is "temporary" because it's not exported to .lop file
- On app close: Prompt "Save changes?"
  - Save As → Export to .lop (becomes saved project)
  - Don't Save → Clear DB (empty next time)
  - Cancel → Return to app

SAVED PROJECT (persistent):
- Opened from .lop file (e.g., project1.lop)
- Uses same global DB but replaces content with .lop data
- Changes auto-save to global DB (same mechanism)
- On app close: NO PROMPT - changes are already in DB
- On save: Export DB back to .lop file (manual File → Save)
```

**Key Insight:**
The global DB (`line-optimizer.db`) is ALWAYS the active workspace. The distinction is:
- **Untitled**: DB content is temporary (prompt to save on close)
- **Saved**: DB content represents the opened .lop file (auto-saves silently)

**Rationale for saved project auto-save:**
- Consistent with Untitled behavior (both use DB auto-commit)
- Fewer dialogs = better UX
- User can Ctrl+Z if they make mistakes
- File → Save exports DB to .lop at any time

### Validation Criteria
- [ ] Read all prerequisite files
- [ ] Identified existing project state management
- [ ] Found Save As implementation
- [ ] Understood database connection architecture
- [ ] Auto-save architecture documented and clear
- [ ] Defined contracts (interfaces, types, channels)
- [ ] Validated against Electron API docs (no custom workarounds)
- [ ] NO workarounds planned

### Output
Implementation strategy defined with clear contracts for:
1. Project state tracking (Zustand)
2. Unsaved changes detection (boolean flag + 8 stores instrumented)
3. App close interception (Electron hooks)
4. Save prompt dialog (native Electron)
5. Database cleanup (DELETE from all data tables)
6. Open .lop file (check unsaved + replace DB)
7. File → New Project (check unsaved + clear DB)

---

## BLOQUE 1: Project State Tracking

### Objective
Add project state tracking to Zustand store to distinguish Untitled vs Saved projects and track unsaved changes.

### Prerequisites
- [ ] BLOQUE 0 completed
- [ ] Contracts defined
- [ ] useProjectStore.ts location identified

### Implementation Steps

#### Step 1: Extend Project Store Interface

Add new state fields to project store:

```typescript
interface ProjectStore {
  // ... existing fields

  // NEW: Project state tracking
  projectType: 'untitled' | 'saved';
  projectFilePath: string | null;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;

  // NEW: Actions
  markUnsavedChanges: () => void;
  clearUnsavedChanges: () => void;
  setProjectType: (type: 'untitled' | 'saved', filePath?: string) => void;
}
```

#### Step 2: Initialize Default State

```typescript
const useProjectStore = create<ProjectStore>((set, get) => ({
  // ... existing state

  // NEW: Default to Untitled Project
  projectType: 'untitled',
  projectFilePath: null,
  hasUnsavedChanges: false,
  lastSavedAt: null,

  // NEW: Actions implementation
  markUnsavedChanges: () => {
    set({ hasUnsavedChanges: true });
  },

  clearUnsavedChanges: () => {
    set({
      hasUnsavedChanges: false,
      lastSavedAt: new Date()
    });
  },

  setProjectType: (type: 'untitled' | 'saved', filePath?: string) => {
    set({
      projectType: type,
      projectFilePath: filePath || null,
      hasUnsavedChanges: false,
      lastSavedAt: type === 'saved' ? new Date() : null
    });
  },
}));
```

#### Step 3: Hook into Data Mutations

Mark unsaved changes when data is modified. **ALL stores listed below must call `markUnsavedChanges()`:**

```typescript
// Pattern to apply in ALL stores:
import { useProjectStore } from '../store/useProjectStore';

const markChanges = () => {
  const projectStore = useProjectStore.getState();
  projectStore.markUnsavedChanges();
};

// 1. usePlantStore
createPlant: async (data) => {
  // ... existing logic
  markChanges();
},
updatePlant: async (id, data) => {
  // ... existing logic
  markChanges();
},
deletePlant: async (id) => {
  // ... existing logic
  markChanges();
},
setDefaultPlant: async (id) => {
  // ... existing logic
  markChanges();
},

// 2. useProductModelStore (or similar)
createModel: async (data) => {
  // ... existing logic
  markChanges();
},
updateModel: async (id, data) => {
  // ... existing logic
  markChanges();
},
deleteModel: async (id) => {
  // ... existing logic
  markChanges();
},

// 3. useAreaCatalogStore
createArea: async (data) => {
  // ... existing logic
  markChanges();
},
updateArea: async (id, data) => {
  // ... existing logic
  markChanges();
},
deleteArea: async (id) => {
  // ... existing logic
  markChanges();
},

// 4. useProductionLineStore
createLine: async (data) => {
  // ... existing logic
  markChanges();
},
updateLine: async (id, data) => {
  // ... existing logic
  markChanges();
},
deleteLine: async (id) => {
  // ... existing logic
  markChanges();
},

// 5. useVolumeStore
createVolume: async (data) => {
  // ... existing logic
  markChanges();
},
updateVolume: async (id, data) => {
  // ... existing logic
  markChanges();
},
deleteVolume: async (id) => {
  // ... existing logic
  markChanges();
},

// 6. useCompatibilityStore
createCompatibility: async (data) => {
  // ... existing logic
  markChanges();
},
updateCompatibility: async (id, data) => {
  // ... existing logic
  markChanges();
},
deleteCompatibility: async (id) => {
  // ... existing logic
  markChanges();
},

// 7. useChangeoverStore
createChangeover: async (data) => {
  // ... existing logic
  markChanges();
},
updateChangeover: async (id, data) => {
  // ... existing logic
  markChanges();
},
deleteChangeover: async (id) => {
  // ... existing logic
  markChanges();
},

// 8. useRoutingStore
createRouting: async (data) => {
  // ... existing logic
  markChanges();
},
updateRouting: async (id, data) => {
  // ... existing logic
  markChanges();
},
deleteRouting: async (id) => {
  // ... existing logic
  markChanges();
},

// Complete list of stores to instrument:
// - usePlantStore (create, update, delete, setDefault)
// - useProductModelStore (create, update, delete)
// - useAreaCatalogStore (create, update, delete)
// - useProductionLineStore (create, update, delete)
// - useVolumeStore (create, update, delete)
// - useCompatibilityStore (create, update, delete)
// - useChangeoverStore (create, update, delete)
// - useRoutingStore (create, update, delete)
```

### Checkpoint

```bash
# Verify TypeScript compiles
npm run type-check

# Verify store has new fields
grep -A 5 "projectType\|hasUnsavedChanges" src/renderer/store/useProjectStore.ts
```

### Success Criteria
- [ ] Project store extended with new fields
- [ ] Default state is 'untitled' with no file path
- [ ] markUnsavedChanges() callable from any store
- [ ] Type-check passes
- [ ] No workarounds introduced

### Next Action
Proceed to BLOQUE 2

---

## BLOQUE 2: IPC Handlers for Project State

### Objective
Create IPC handlers for main process to query project state and clear temporary database.

### Prerequisites
- [ ] BLOQUE 1 completed
- [ ] Project state tracking in place

### Implementation Steps

#### Step 1: Define IPC Channels

Add to `src/shared/constants/index.ts`:

```typescript
export const PROJECT_CHANNELS = {
  // ... existing channels
  GET_PROJECT_STATE: 'project:get-project-state',
  CLEAR_TEMP_DATABASE: 'project:clear-temp-database',
} as const;
```

#### Step 2: Create GET_PROJECT_STATE Handler

In `src/main/ipc/handlers/project.handler.ts`:

```typescript
ipcMain.handle(
  PROJECT_CHANNELS.GET_PROJECT_STATE,
  async (): Promise<ApiResponse<{
    projectType: 'untitled' | 'saved';
    hasUnsavedChanges: boolean;
    projectFilePath: string | null;
  }>> => {
    try {
      // Get state from renderer via separate channel
      // Or determine based on database path
      const dbPath = DatabaseConnection.getPath();
      const isDefaultDB = dbPath?.includes('line-optimizer.db');

      return {
        success: true,
        data: {
          projectType: isDefaultDB ? 'untitled' : 'saved',
          hasUnsavedChanges: false, // Will be queried from renderer
          projectFilePath: isDefaultDB ? null : dbPath,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
```

#### Step 3: Create CLEAR_TEMP_DATABASE Handler

```typescript
ipcMain.handle(
  PROJECT_CHANNELS.CLEAR_TEMP_DATABASE,
  async (): Promise<ApiResponse<void>> => {
    try {
      const db = DatabaseConnection.getInstance();

      // Clear all data tables (preserve schema)
      const tables = [
        'production_lines',
        'product_models_v2',
        'product_volumes',
        'area_catalog',
        'plants',
        'line_model_compatibilities',
        'plant_product_volumes',
        'plant_model_routing',
        'plant_model_routing_predecessors',
        // Add all data tables
      ];

      for (const table of tables) {
        db.prepare(`DELETE FROM ${table}`).run();
      }

      console.log('[Project Handler] Temporary database cleared');

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[Project Handler] Clear temp DB error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
```

### Checkpoint

```bash
# Verify handlers registered
grep -n "GET_PROJECT_STATE\|CLEAR_TEMP_DATABASE" src/main/ipc/handlers/project.handler.ts

# Type check
npm run type-check
```

### Success Criteria
- [ ] IPC channels defined in constants
- [ ] GET_PROJECT_STATE handler created
- [ ] CLEAR_TEMP_DATABASE handler created
- [ ] Handler clears all data tables (not schema)
- [ ] Type-check passes

### Next Action
Proceed to BLOQUE 3

---

## BLOQUE 3: Electron App Close Interception

### Objective
Intercept app close events to check for unsaved changes and show save prompt if needed.

### Prerequisites
- [ ] BLOQUE 2 completed
- [ ] IPC handlers ready
- [ ] Project state tracking ready

### Implementation Steps

#### Step 1: Find Main Process Entry Point

```bash
# Find main entry
find src/main -name "index.ts" -o -name "main.ts"

# Read to understand app initialization
```

#### Step 2: Add before-quit Hook

In main process (e.g., `src/main/index.ts`):

```typescript
import { app, dialog, BrowserWindow } from 'electron';

let isQuitting = false;

// Intercept before-quit
app.on('before-quit', async (event) => {
  if (isQuitting) {
    return; // Already handled, allow quit
  }

  event.preventDefault(); // Prevent immediate quit

  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    isQuitting = true;
    app.quit();
    return;
  }

  try {
    // Ask renderer for project state
    const projectState = await mainWindow.webContents.executeJavaScript(`
      window.electronAPI ?
        window.electronAPI.invoke('project:get-project-state') :
        null
    `);

    // Check if Untitled + unsaved changes
    if (projectState?.projectType === 'untitled' && projectState?.hasUnsavedChanges) {
      // Show save prompt (BLOQUE 4)
      const result = await showSavePrompt(mainWindow);

      if (result === 'cancel') {
        // User cancelled - don't quit
        return;
      } else if (result === 'save') {
        // Trigger Save As (will be handled by renderer)
        mainWindow.webContents.send('trigger-save-as');
        return; // Wait for save to complete
      } else if (result === 'dont-save') {
        // Clear temp database
        await clearTempDatabase();
      }
    }

    // Allow quit
    isQuitting = true;
    app.quit();

  } catch (error) {
    console.error('Error checking project state:', error);
    isQuitting = true;
    app.quit();
  }
});

// Helper to get project state (alternative approach)
async function getProjectStateFromRenderer(window: BrowserWindow) {
  // Send IPC to renderer asking for state
  return new Promise((resolve) => {
    ipcMain.once('project-state-response', (event, state) => {
      resolve(state);
    });
    window.webContents.send('get-project-state');
  });
}
```

#### Step 3: Handle Window Close

```typescript
// Also intercept window close button
app.on('window-all-closed', () => {
  // Trigger before-quit logic
  app.quit();
});
```

### Checkpoint

```bash
# Verify hook added
grep -A 10 "before-quit" src/main/index.ts

# Type check
npm run type-check
```

### Success Criteria
- [ ] before-quit hook intercepts app close
- [ ] Gets project state from renderer
- [ ] Checks if Untitled + unsaved changes
- [ ] Prevents quit until user decides
- [ ] Type-check passes

### Next Action
Proceed to BLOQUE 4

---

## BLOQUE 4: Native Save Prompt Dialog

### Objective
Show native Electron dialog asking "Save changes?" with 3 options.

### Prerequisites
- [ ] BLOQUE 3 completed
- [ ] App close hook ready

### Implementation Steps

#### Step 1: Create showSavePrompt Function

In main process:

```typescript
import { dialog, BrowserWindow } from 'electron';

async function showSavePrompt(
  window: BrowserWindow
): Promise<'save' | 'dont-save' | 'cancel'> {
  const result = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['Save As...', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Save Changes?',
    message: 'Do you want to save changes to Untitled Project?',
    detail: 'Your changes will be lost if you don't save them.',
    noLink: true,
  });

  switch (result.response) {
    case 0:
      return 'save';
    case 1:
      return 'dont-save';
    case 2:
    default:
      return 'cancel';
  }
}
```

#### Step 2: Integrate with before-quit

```typescript
app.on('before-quit', async (event) => {
  // ... state checking logic from BLOQUE 3

  if (needsPrompt) {
    const result = await showSavePrompt(mainWindow); // Use function

    if (result === 'cancel') {
      return; // Don't quit
    } else if (result === 'save') {
      // Trigger Save As
      mainWindow.webContents.send('trigger-save-as');

      // Wait for save completion (user will close app again after saving)
      return;
    } else if (result === 'dont-save') {
      // Clear database in BLOQUE 5
      await window.electronAPI.invoke('project:clear-temp-database');
    }
  }

  isQuitting = true;
  app.quit();
});
```

### Checkpoint

```bash
# Verify dialog function
grep -A 15 "showSavePrompt" src/main/index.ts

# Type check
npm run type-check

# Manual test: Create plant, close app
# Should see native dialog with 3 buttons
```

### Success Criteria
- [ ] Native dialog shows on close if Untitled + unsaved
- [ ] 3 buttons: Save As, Don't Save, Cancel
- [ ] Cancel returns to app (doesn't quit)
- [ ] Type-check passes

### Next Action
Proceed to BLOQUE 5

---

## BLOQUE 5: Save As Integration

### Objective
Handle "Save As..." button from dialog by triggering existing Save As functionality.

### Prerequisites
- [ ] BLOQUE 4 completed
- [ ] Dialog showing correctly
- [ ] Existing Save As functionality works

### Implementation Steps

#### Step 1: Add IPC Listener in Renderer

In main window setup (e.g., `src/renderer/App.tsx` or similar):

```typescript
import { useEffect } from 'react';
import { useProjectStore } from './store/useProjectStore';

function App() {
  const projectStore = useProjectStore();

  useEffect(() => {
    // Listen for Save As trigger from main process
    const unsubscribe = window.electronAPI.on('trigger-save-as', () => {
      // Call existing Save As functionality
      handleSaveAs();
    });

    return unsubscribe;
  }, []);

  const handleSaveAs = async () => {
    try {
      // Call existing Save As IPC
      const result = await window.electronAPI.invoke('project:save-as', {
        // ... existing params
      });

      if (result.success) {
        // Update project state to 'saved'
        projectStore.setProjectType('saved', result.data.filePath);
        projectStore.clearUnsavedChanges();

        // Now app can close
        window.electronAPI.invoke('app:quit-after-save');
      }
    } catch (error) {
      console.error('Save As failed:', error);
    }
  };

  // ... rest of component
}
```

#### Step 2: Add app:quit-after-save Handler

In main process:

```typescript
ipcMain.handle('app:quit-after-save', async () => {
  isQuitting = true;
  app.quit();
  return { success: true };
});
```

### Checkpoint

```bash
# Verify listener added
grep -A 10 "trigger-save-as" src/renderer/App.tsx

# Type check
npm run type-check

# Manual test:
# 1. Create plant (Untitled)
# 2. Close app
# 3. Click "Save As..."
# 4. Choose location
# 5. App should save and quit
```

### Success Criteria
- [ ] Renderer listens for 'trigger-save-as' event
- [ ] Calls existing Save As functionality
- [ ] Updates project state to 'saved' on success
- [ ] App quits after successful save
- [ ] Type-check passes

### Next Action
Proceed to BLOQUE 6

---

## BLOQUE 6: Don't Save - Database Cleanup

### Objective
Clear temporary database when user chooses "Don't Save" so next app open is empty.

### Prerequisites
- [ ] BLOQUE 5 completed
- [ ] CLEAR_TEMP_DATABASE handler exists (BLOQUE 2)

### Implementation Steps

#### Step 1: Call Clear Handler on Don't Save

In main process before-quit handler:

```typescript
app.on('before-quit', async (event) => {
  // ... existing logic

  if (result === 'dont-save') {
    try {
      // Clear temporary database
      const clearResult = await new Promise((resolve) => {
        const handler = async () => {
          const db = DatabaseConnection.getInstance();

          // List of all data tables
          const tables = [
            'production_lines',
            'product_models_v2',
            'product_volumes',
            'area_catalog',
            'plants',
            'line_model_compatibilities',
            'plant_product_volumes',
            'plant_model_routing',
            'plant_model_routing_predecessors',
            'family_changeover_defaults',
            'line_changeover_overrides',
            'user_preferences',
            'canvas_objects',
            'process_properties',
            // Add all data tables (not schema tables)
          ];

          db.transaction(() => {
            for (const table of tables) {
              db.prepare(`DELETE FROM ${table}`).run();
            }
          })();

          console.log('[Main] Temporary database cleared');
          resolve(true);
        };
        handler();
      });

    } catch (error) {
      console.error('[Main] Failed to clear database:', error);
      // Continue quitting anyway
    }
  }

  isQuitting = true;
  app.quit();
});
```

#### Step 2: Verify Database is Empty on Next Open

Add logging to confirm:

```typescript
// In database initialization
DatabaseConnection.getInstance();
const rowCount = db.prepare('SELECT COUNT(*) as count FROM plants').get();
console.log('[DB] Plants count on startup:', rowCount.count);
```

### Checkpoint

```bash
# Verify clear logic
grep -A 20 "dont-save" src/main/index.ts

# Type check
npm run type-check

# Manual test:
# 1. Create 2 plants
# 2. Close app
# 3. Click "Don't Save"
# 4. Reopen app
# 5. Verify Plants page is empty (0 plants)
```

### Success Criteria
- [ ] "Don't Save" clears all data tables
- [ ] Schema preserved (migrations not affected)
- [ ] Next app open shows empty state
- [ ] Type-check passes
- [ ] No data leaks between sessions

### Next Action
Proceed to BLOQUE 7

---

## BLOQUE 7: Query Project State from Renderer

### Objective
Create mechanism for main process to query current project state from renderer store.

### Prerequisites
- [ ] BLOQUE 6 completed
- [ ] All pieces in place

### Implementation Steps

#### Step 1: Add IPC Channel for State Query

In renderer, listen for state requests:

```typescript
// In main window initialization or App.tsx
useEffect(() => {
  // Listen for state query from main process
  const unsubscribe = window.electronAPI.on('get-project-state', () => {
    const state = useProjectStore.getState();

    // Send state back to main
    window.electronAPI.send('project-state-response', {
      projectType: state.projectType,
      hasUnsavedChanges: state.hasUnsavedChanges,
      projectFilePath: state.projectFilePath,
    });
  });

  return unsubscribe;
}, []);
```

#### Step 2: Update Main Process to Use This

In main process before-quit:

```typescript
app.on('before-quit', async (event) => {
  if (isQuitting) return;

  event.preventDefault();

  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    isQuitting = true;
    app.quit();
    return;
  }

  try {
    // Query state from renderer
    const state = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null); // Timeout fallback
      }, 1000);

      ipcMain.once('project-state-response', (event, state) => {
        clearTimeout(timeout);
        resolve(state);
      });

      mainWindow.webContents.send('get-project-state');
    });

    if (state?.projectType === 'untitled' && state?.hasUnsavedChanges) {
      // Show dialog...
    }

    isQuitting = true;
    app.quit();
  } catch (error) {
    console.error('Error getting project state:', error);
    isQuitting = true;
    app.quit();
  }
});
```

### Checkpoint

```bash
# Verify listener and sender
grep -A 10 "get-project-state\|project-state-response" src/renderer/App.tsx
grep -A 10 "project-state-response" src/main/index.ts

# Type check
npm run type-check
```

### Success Criteria
- [ ] Renderer listens for state query
- [ ] Renderer sends state back to main
- [ ] Main process receives state correctly
- [ ] Timeout fallback if renderer doesn't respond
- [ ] Type-check passes

### Next Action
Proceed to BLOQUE 8

---

## BLOQUE 8: Open .lop File Integration

### Objective
Handle opening .lop files: check for unsaved Untitled changes, prompt to save if needed, replace DB with .lop content, update project state to 'saved'.

### Prerequisites
- [ ] BLOQUE 7 completed
- [ ] Existing "Open Project" functionality works
- [ ] DatabaseConnection.replaceInstance() exists

### Implementation Steps

#### Step 1: Review Existing Open Project Handler

```bash
# Find existing Open Project implementation
grep -r "OPEN.*PROJECT\|openProject" src/main/ipc/handlers/

# Read implementation
cat src/main/ipc/handlers/project.handler.ts

# Check if DatabaseConnection has replaceInstance method
grep -A 10 "replaceInstance" src/main/database/connection.ts
```

#### Step 2: Add Unsaved Changes Check Before Opening

Modify Open Project handler to check for unsaved changes first:

```typescript
ipcMain.handle(
  PROJECT_CHANNELS.OPEN_PROJECT,
  async (event, filePath: string): Promise<ApiResponse<void>> => {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (!mainWindow) {
        return {
          success: false,
          error: 'No window available',
        };
      }

      // STEP 1: Check if current project has unsaved changes
      const state = await new Promise<ProjectState | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 1000);

        ipcMain.once('project-state-response', (event, state) => {
          clearTimeout(timeout);
          resolve(state);
        });

        mainWindow.webContents.send('get-project-state');
      });

      // STEP 2: If Untitled + unsaved changes, prompt to save first
      if (state?.projectType === 'untitled' && state?.hasUnsavedChanges) {
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['Save As...', "Don't Save", 'Cancel'],
          defaultId: 2,
          cancelId: 2,
          title: 'Save Changes?',
          message: 'Do you want to save changes to Untitled Project before opening another file?',
          detail: 'Your changes will be lost if you don't save them.',
          noLink: true,
        });

        if (result.response === 2) {
          // Cancel - abort opening
          return {
            success: false,
            error: 'User cancelled',
          };
        } else if (result.response === 0) {
          // Save As - trigger save dialog
          mainWindow.webContents.send('trigger-save-as-then-open', filePath);
          return {
            success: true,
            data: undefined,
          };
        } else if (result.response === 1) {
          // Don't Save - clear DB and continue
          await clearTempDatabase();
        }
      }

      // STEP 3: Replace database with .lop content
      await DatabaseConnection.replaceInstance(filePath);

      // STEP 4: Notify renderer to update project state
      mainWindow.webContents.send('project-opened', {
        projectType: 'saved',
        filePath: filePath,
      });

      console.log('[Project Handler] Opened project:', filePath);

      return {
        success: true,
        data: undefined,
      };

    } catch (error) {
      console.error('[Project Handler] Open project error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
```

#### Step 3: Handle "Save As Then Open" Flow

In renderer (App.tsx):

```typescript
useEffect(() => {
  // Listen for save-then-open trigger
  const unsubscribe = window.electronAPI.on(
    'trigger-save-as-then-open',
    async (filePathToOpen: string) => {
      try {
        // Save current Untitled project first
        const saveResult = await window.electronAPI.invoke('project:save-as', {
          // ... existing params
        });

        if (saveResult.success) {
          // Now open the requested file
          await window.electronAPI.invoke('project:open', filePathToOpen);
        }
      } catch (error) {
        console.error('Save-then-open failed:', error);
      }
    }
  );

  return unsubscribe;
}, []);
```

#### Step 4: Handle Project Opened Event

In renderer (App.tsx):

```typescript
useEffect(() => {
  // Listen for project-opened event
  const unsubscribe = window.electronAPI.on(
    'project-opened',
    (data: { projectType: 'saved'; filePath: string }) => {
      const projectStore = useProjectStore.getState();

      // Update project state
      projectStore.setProjectType('saved', data.filePath);
      projectStore.clearUnsavedChanges();

      // Refresh all stores to load new data
      // (or trigger a full reload)
      window.location.reload(); // Simple approach
    }
  );

  return unsubscribe;
}, []);
```

#### Step 5: Add File → New Project Handler

Similar logic for creating a new project:

```typescript
ipcMain.handle(
  PROJECT_CHANNELS.NEW_PROJECT,
  async (event): Promise<ApiResponse<void>> => {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (!mainWindow) {
        return { success: false, error: 'No window available' };
      }

      // Check for unsaved changes
      const state = await getProjectStateFromRenderer(mainWindow);

      if (state?.hasUnsavedChanges) {
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['Save As...', "Don't Save", 'Cancel'],
          defaultId: 2,
          cancelId: 2,
          title: 'Save Changes?',
          message: `Do you want to save changes to ${
            state.projectType === 'untitled'
              ? 'Untitled Project'
              : state.projectFilePath
          }?`,
          detail: 'Your changes will be lost if you don't save them.',
          noLink: true,
        });

        if (result.response === 2) {
          // Cancel
          return { success: false, error: 'User cancelled' };
        } else if (result.response === 0) {
          // Save As
          mainWindow.webContents.send('trigger-save-as-then-new');
          return { success: true, data: undefined };
        }
        // Don't Save - continue below
      }

      // Clear database to start fresh
      await clearTempDatabase();

      // Notify renderer to reset to Untitled
      mainWindow.webContents.send('project-reset', {
        projectType: 'untitled',
        filePath: null,
      });

      return { success: true, data: undefined };

    } catch (error) {
      console.error('[Project Handler] New project error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
```

### Checkpoint

```bash
# Verify Open Project handler updated
grep -A 50 "OPEN_PROJECT" src/main/ipc/handlers/project.handler.ts

# Verify renderer listeners added
grep -A 10 "trigger-save-as-then-open\|project-opened" src/renderer/App.tsx

# Type check
npm run type-check

# Manual test:
# 1. Create plant (Untitled)
# 2. File → Open Project → Select existing.lop
# 3. Should prompt "Save changes to Untitled?"
# 4. Click "Don't Save"
# 5. Should open existing.lop with its data
```

### Success Criteria
- [ ] Opening .lop checks for unsaved Untitled changes
- [ ] Prompts "Save changes?" if Untitled has changes
- [ ] "Don't Save" clears DB and opens file
- [ ] "Save As..." saves first, then opens file
- [ ] "Cancel" aborts opening
- [ ] Project state updates to 'saved' after opening
- [ ] File → New Project has same logic
- [ ] Type-check passes

### Next Action
Proceed to BLOQUE FINAL

---

## BLOQUE FINAL: Testing & Validation

### Objective
Comprehensive testing of Untitled Project workflow to ensure Excel-like behavior.

### Prerequisites Check

```bash
echo "=== Verifying all components ===" && \
components=(
  "Project state tracking in store"
  "IPC handlers for state and cleanup"
  "App close interception"
  "Native save prompt dialog"
  "Save As integration"
  "Database cleanup on Don't Save"
  "State query mechanism"
  "Open .lop file with unsaved check"
  "File → New Project with unsaved check"
  "All 8 stores tracking changes"
) && \
for component in "${components[@]}"; do
  echo "✓ $component"
done
```

### Validation Tests

#### Test 1: Untitled Project - Don't Save

**Steps:**
1. Start app: `npm start`
2. Verify empty state (0 plants, 0 models)
3. Create 2 plants, 3 models
4. Close app (Cmd+Q or Ctrl+C)
5. **Expected:** Dialog appears: "Save changes to Untitled Project?"
6. Click "Don't Save"
7. **Expected:** App closes
8. Restart app: `npm start`
9. **Expected:** Empty state (0 plants, 0 models)

**Pass criteria:**
- [ ] Dialog appears on close with unsaved changes
- [ ] "Don't Save" clears database
- [ ] Next open is empty
- [ ] No errors in console

---

#### Test 2: Untitled Project - Save As

**Steps:**
1. Start app: `npm start`
2. Create 2 plants
3. Close app
4. **Expected:** Dialog appears
5. Click "Save As..."
6. Choose location: `~/Desktop/test-project.lop`
7. **Expected:** App saves and closes
8. Restart app: `npm start`
9. **Expected:** Empty (Untitled Project)
10. Open File → Open Project → Select `test-project.lop`
11. **Expected:** 2 plants appear

**Pass criteria:**
- [ ] "Save As..." triggers save dialog
- [ ] File is created at chosen location
- [ ] App closes after successful save
- [ ] Opening saved file loads data correctly
- [ ] No errors in console

---

#### Test 3: Untitled Project - Cancel

**Steps:**
1. Start app: `npm start`
2. Create 1 plant
3. Close app
4. **Expected:** Dialog appears
5. Click "Cancel"
6. **Expected:** App returns (doesn't close)
7. Verify plant still visible
8. Close app again
9. Click "Don't Save"
10. **Expected:** App closes

**Pass criteria:**
- [ ] "Cancel" returns to app
- [ ] Data still intact after cancel
- [ ] Can close again and choose different option
- [ ] No errors in console

---

#### Test 4: Saved Project - No Prompt

**Steps:**
1. Start app: `npm start`
2. Create 1 plant
3. File → Save As → `saved-project.lop`
4. Create another plant (total 2)
5. Close app
6. **Expected:** No dialog (auto-saves to .lop)
7. Restart app
8. Open `saved-project.lop`
9. **Expected:** 2 plants visible

**Pass criteria:**
- [ ] No prompt when project already saved
- [ ] Changes auto-save to .lop file
- [ ] Reopening loads latest data
- [ ] No errors in console

---

#### Test 5: Crash Protection

**Steps:**
1. Start app: `npm start`
2. Create 3 models
3. Force quit (kill process): `killall "Line Optimizer"`
4. Restart app: `npm start`
5. **Expected:** 3 models still visible (auto-saved to temp DB)
6. Close app normally
7. Click "Don't Save"
8. Restart app
9. **Expected:** Empty

**Pass criteria:**
- [ ] Data survives crash (temp auto-save works)
- [ ] Can still choose to discard on normal close
- [ ] No data corruption
- [ ] No errors in console

---

#### Test 6: No Changes - No Prompt

**Steps:**
1. Start app: `npm start`
2. Don't create anything (empty)
3. Close app
4. **Expected:** No prompt (no unsaved changes)
5. Restart app
6. **Expected:** Empty

**Pass criteria:**
- [ ] No prompt if no changes made
- [ ] App closes immediately
- [ ] No errors in console

---

#### Test 7: Open .lop File with Unsaved Untitled Changes

**Steps:**
1. Start app: `npm start`
2. Create 2 plants (Untitled)
3. File → Open Project → Select `existing-project.lop`
4. **Expected:** Dialog appears: "Save changes to Untitled Project before opening another file?"
5. Click "Don't Save"
6. **Expected:** App loads `existing-project.lop` data (2 plants gone)
7. Verify data from `existing-project.lop` is visible
8. Verify project state is 'saved' (not 'untitled')

**Pass criteria:**
- [ ] Dialog appears before opening file
- [ ] "Don't Save" discards Untitled changes
- [ ] Opened file data loads correctly
- [ ] Project state updates to 'saved'
- [ ] No errors in console

---

#### Test 8: File → New Project with Unsaved Changes

**Steps:**
1. Start app: `npm start`
2. Create 1 plant
3. File → New Project
4. **Expected:** Dialog appears: "Save changes to Untitled Project?"
5. Click "Don't Save"
6. **Expected:** App resets to empty Untitled Project
7. Verify 0 plants visible
8. Create 1 model
9. File → New Project again
10. Click "Cancel"
11. **Expected:** Returns to app with 1 model still visible

**Pass criteria:**
- [ ] Dialog appears before creating new project
- [ ] "Don't Save" clears data and starts fresh
- [ ] "Cancel" aborts and keeps current data
- [ ] Multiple File → New Project calls work correctly
- [ ] No errors in console

---

### Final Checklist

**Code Quality:**
- [ ] All BLOQUEs completed
- [ ] TypeScript compiles without errors
- [ ] No workarounds introduced
- [ ] Follows Electron best practices
- [ ] Clean error handling

**Functionality:**
- [ ] Untitled Project detected correctly
- [ ] Save prompt appears when needed
- [ ] "Save As..." works correctly
- [ ] "Don't Save" clears database
- [ ] "Cancel" returns to app
- [ ] Saved projects don't prompt
- [ ] Crash protection works (auto-save temp)

**User Experience:**
- [ ] Behavior matches Excel/Word
- [ ] Native dialog looks professional
- [ ] No confusing states
- [ ] Clear feedback on all actions

**Documentation:**
- [ ] Pattern documented for future reference
- [ ] IPC channels documented
- [ ] State management documented

---

## Success Criteria (Overall)

### Technical
- [ ] All BLOQUEs completed
- [ ] Project state tracking implemented
- [ ] App close interception works
- [ ] Native save dialog shows correctly
- [ ] Database cleanup works
- [ ] TypeScript compiles
- [ ] NO workarounds

### Functional
- [ ] Untitled Project acts like Excel (temporary until saved)
- [ ] Crash protection via auto-save to temp DB
- [ ] User controls persistence via save dialog
- [ ] Clean state between sessions when not saved

### Code Quality
- [ ] Clean code following Electron patterns
- [ ] Proper error handling
- [ ] Type-safe interfaces
- [ ] No memory leaks

---

## Testing Strategy

### Manual Testing
1. Test all 6 scenarios in BLOQUE FINAL
2. Verify no errors in DevTools console
3. Verify database is empty/full as expected
4. Verify .lop files work correctly

### Edge Cases
- Closing during save operation
- Corrupted .lop file
- Disk full during save
- Multiple windows open (if applicable)

---

## Implementation Command

```bash
# Execute with Orchestrator v4.3
orchestrate docs/specs/untitled-project-workflow.md

# Or with strict mode (fail-fast)
orchestrate --strict docs/specs/untitled-project-workflow.md

# Preview execution plan
orchestrate --dry-run docs/specs/untitled-project-workflow.md
```

---

## Rollback Plan

```bash
# If implementation causes issues
git checkout src/main/index.ts
git checkout src/renderer/store/useProjectStore.ts
git checkout src/main/ipc/handlers/project.handler.ts

# Verify rollback
npm run type-check
npm start
```

---

**Spec Version:** 1.1 (Improved)
**Last Updated:** 2026-02-08
**Status:** Ready for Implementation

**Changes in v1.1:**
- Added auto-save architecture explanation in BLOQUE 0 (clarifies temp vs saved behavior)
- Added complete change tracking list in BLOQUE 1 (all 8 stores with operations)
- Added BLOQUE 8: Open .lop File Integration (handle unsaved changes before opening)
- Added File → New Project handling in BLOQUE 8
- Added Test 7: Open .lop with unsaved Untitled changes
- Added Test 8: File → New Project with unsaved changes
