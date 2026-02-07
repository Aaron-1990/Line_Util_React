# Phase 8.0 Troubleshooting: Database Instance Reference Issues

**Date:** 2026-02-07
**Phase:** 8.0 - Project Files Foundation
**Severity:** CRITICAL
**Status:** RESOLVED

---

## Executive Summary

Durante la implementación de Phase 8.0 (Project Files), se descubrieron múltiples bugs críticos relacionados con **referencias capturadas a instancias de base de datos** que se volvían obsoletas cuando se reemplazaba la instancia global. Este documento detalla los problemas, la causa raíz, y las soluciones implementadas.

**Tiempo invertido en debugging:** ~3 horas
**Archivos afectados:** 8+ archivos
**Impacto:** Save/Open/New Project completamente rotos

---

## Problemas Encontrados y Resueltos

### 1. ❌ **Save Project fallaba con "no such column: now"**

**Síntoma:**
```
SqliteError: no such column: now
```

**Causa Raíz:**
SQL incorrecto en `ProjectMetadataHelper.ts:65`:
```typescript
// ❌ INCORRECTO: 3 columnas declaradas, solo 2 parámetros
const stmt = db.prepare('INSERT OR REPLACE INTO project_metadata (key, value, updated_at) VALUES (?, ?, datetime("now"))');
stmt.run(dbKey, stringValue); // Error: SQLITE_RANGE
```

**Solución:**
```typescript
// ✅ CORRECTO: 2 columnas, 2 parámetros, updated_at usa DEFAULT
const stmt = db.prepare('INSERT OR REPLACE INTO project_metadata (key, value) VALUES (?, ?)');
```

**Archivos modificados:**
- `src/main/database/helpers/ProjectMetadataHelper.ts`

---

### 2. ❌ **New Project fallaba con "FOREIGN KEY constraint failed"**

**Síntoma:**
```
SqliteError: FOREIGN KEY constraint failed
```

**Causa Raíz:**
Al intentar borrar todas las tablas en orden aleatorio, las FK constraints impedían el borrado.

**Solución:**
Deshabilitar FK constraints ANTES de la transaction:
```typescript
// Disable FK constraints OUTSIDE transaction
db.pragma('foreign_keys = OFF');

const transaction = db.transaction(() => {
  tables.forEach(table => {
    db.prepare(`DELETE FROM ${table.name}`).run();
  });
});

transaction();

// Re-enable FK constraints
db.pragma('foreign_keys = ON');
```

**Archivos modificados:**
- `src/main/services/project/ProjectFileService.ts`

---

### 3. ❌ **Open Project mostraba "Untitled Project" en lugar del nombre real**

**Síntoma:**
- Backend lee correctamente: `"test3"`
- Frontend recibe: `"Untitled Project"`

**Causa Raíz:**
El handler `GET_INFO` usaba una **referencia capturada** a la DB:

```typescript
// ❌ INCORRECTO: Captura DB al inicio (línea 13)
export function registerProjectHandlers(window: BrowserWindow): void {
  const db = DatabaseConnection.getInstance(); // ← Capturada aquí

  ipcMain.handle(PROJECT_CHANNELS.GET_INFO, async () => {
    const state = ProjectFileService.getProjectState(db); // ← Usa DB vieja
  });
}
```

Cuando `openProject()` reemplazaba la instancia global con `replaceInstance()`, el handler seguía usando la DB vieja.

**Solución:**
Usar `getInstance()` DENTRO del handler:
```typescript
// ✅ CORRECTO: Obtiene instancia actual
ipcMain.handle(PROJECT_CHANNELS.GET_INFO, async () => {
  const currentDb = DatabaseConnection.getInstance(); // ← Siempre actual
  const state = ProjectFileService.getProjectState(currentDb);
});
```

**Archivos modificados:**
- `src/main/ipc/handlers/project.handler.ts`

---

### 4. ❌ **Save As no actualizaba el nombre del proyecto en la UI**

**Síntoma:**
- Usuario guarda como `my-project.lop`
- UI sigue mostrando "Untitled Project"

**Causa Raíz:**
`saveProjectAs()` guardaba el archivo correctamente pero NO reemplazaba la instancia de DB activa.

**Solución:**
Reabrir el archivo guardado como DB activa:
```typescript
// Después de guardar
savedDb.close();

// ✅ Reabrir como DB activa
const newDb = new Database(savePath, { readonly: false });
DatabaseConnection.replaceInstance(newDb);
```

**Archivos modificados:**
- `src/main/services/project/ProjectFileService.ts`

**Import agregado:**
- `import DatabaseConnection from '@main/database/connection';`

---

### 5. ❌ **La DB activa no tenía pragmas configurados**

**Síntoma:**
```
TypeError: The database connection is not open
```

**Causa Raíz:**
Al crear nuevas instancias de DB con `new Database()`, no se configuraban los pragmas necesarios (`foreign_keys`, `journal_mode`).

**Solución:**
Crear método helper `configurePragmas()`:
```typescript
static configurePragmas(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
}

static replaceInstance(newDb: Database.Database): void {
  if (DatabaseConnection.instance) {
    DatabaseConnection.instance.close();
  }

  // ✅ Configurar pragmas automáticamente
  DatabaseConnection.configurePragmas(newDb);

  DatabaseConnection.instance = newDb;
}
```

**Archivos modificados:**
- `src/main/database/connection.ts`

---

### 6. ❌ **Repositorios usaban referencias capturadas a DB**

**Síntoma:**
```
TypeError: The database connection is not open
    at SQLitePlantRepository.create
```

**Causa Raíz:**
Los repositorios se creaban UNA VEZ con una referencia capturada a la DB:

```typescript
// ❌ INCORRECTO
export function registerPlantHandlers(): void {
  const db = DatabaseConnection.getInstance(); // ← Capturada aquí
  const plantRepository = new SQLitePlantRepository(db); // ← DB vieja

  ipcMain.handle(PLANT_CHANNELS.CREATE, async () => {
    const plant = await plantRepository.create(...); // ← USA DB CERRADA
  });
}
```

**Solución:**
Crear repository DENTRO de cada handler:
```typescript
// ✅ CORRECTO
ipcMain.handle(PLANT_CHANNELS.CREATE, async () => {
  const plantRepository = new SQLitePlantRepository(
    DatabaseConnection.getInstance() // ← Siempre actual
  );
  const plant = await plantRepository.create(...);
});
```

**Archivos modificados:**
- `src/main/ipc/handlers/plant.handler.ts`

**⚠️ ADVERTENCIA:** Este mismo problema probablemente existe en TODOS los handlers que usan repositorios.

---

### 7. ❌ **New Project destruía el archivo .lop guardado**

**Síntoma:**
1. Save As `my-project.lop` → ✅ Funciona
2. New Project → ❌ Borra `my-project.lop`
3. Open `my-project.lop` → ❌ Archivo vacío

**Causa Raíz:**
Después de `Save As`, la DB activa es el archivo `.lop`. Cuando se ejecuta `New Project`, limpia la DB activa (el archivo `.lop`), destruyendo los datos guardados.

**Solución:**
Antes de limpiar, volver a `line-optimizer.db`:
```typescript
static async newProject(db: Database.Database, mainWindow: BrowserWindow): Promise<boolean> {
  try {
    // ✅ Si hay archivo .lop abierto, volver a DB por defecto
    if (this.currentFilePath) {
      console.log('[ProjectFileService] Closing project file, switching to default database');
      const userDataPath = app.getPath('userData');
      const defaultDbPath = path.join(userDataPath, DB_CONFIG.FILE_NAME);
      const defaultDb = new Database(defaultDbPath, { readonly: false });
      DatabaseConnection.replaceInstance(defaultDb);
      db = defaultDb;
    }

    // Ahora sí, limpiar datos de line-optimizer.db
    // ...
  }
}
```

**Archivos modificados:**
- `src/main/services/project/ProjectFileService.ts`

**Imports agregados:**
- `import { app } from 'electron';`
- `import { DB_CONFIG } from '@shared/constants';`

---

### 8. ❌ **Errores TypeScript y type safety**

**Problemas:**
- Imports no usados
- Null checks faltantes
- Type assertions necesarios

**Solución:**
- Removidos imports no usados
- Agregados null checks con `!filePath`
- Agregadas type assertions `as string` donde necesario
- Verificación de `match[1]` y `match[2]` antes de uso

**Archivos modificados:**
- `src/main/services/project/ProjectFileService.ts`
- `src/main/services/project/VersionChecker.ts`

---

### 9. ❌ **"Object has been destroyed" al enviar eventos**

**Síntoma:**
```
TypeError: Object has been destroyed
    at mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_SAVED)
```

**Causa Raíz:**
Intentar enviar eventos a `mainWindow` que fue destruida.

**Solución:**
Verificar `isDestroyed()` antes de enviar eventos:
```typescript
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.webContents.send(PROJECT_EVENTS.PROJECT_SAVED);
}
```

**Archivos modificados:**
- `src/main/ipc/handlers/project.handler.ts`

---

### 10. ❌ **No había feedback visual de operaciones en proceso**

**Síntoma:**
Usuario hace clic en "New Project" → nada pasa → hace clic 6 veces más → errores concurrentes

**Causa Raíz:**
Sin estado `isProcessing`, sin loading indicators, sin mensajes de confirmación.

**Solución:**
Agregar flag `isProcessing` y logs:
```typescript
interface ProjectStore {
  isProcessing: boolean; // ← Nuevo
  // ...
}

saveProjectAs: async () => {
  if (state.isProcessing) return; // ← Previene duplicados

  set({ isProcessing: true });
  try {
    // ... operación
    alert('Project saved successfully!'); // ← Feedback temporal
  } finally {
    set({ isProcessing: false });
  }
}
```

**Archivos modificados:**
- `src/renderer/store/useProjectStore.ts`

---

## Causa Raíz Fundamental

### El Problema Arquitectónico

**Patrón Incorrecto:**
```typescript
// ❌ ANTI-PATRÓN: Captura de referencia
export function registerHandlers(): void {
  const db = DatabaseConnection.getInstance(); // ← Snapshot en tiempo de registro

  ipcMain.handle('operation', async () => {
    // Usa db capturada, que puede estar cerrada
    const result = db.prepare('...').all();
  });
}
```

**Por qué falla:**
1. `db` se captura cuando se registran los handlers (app startup)
2. Cuando se llama `DatabaseConnection.replaceInstance(newDb)`:
   - Se cierra la DB vieja
   - Se establece una nueva instancia global
   - **Pero la referencia capturada `db` sigue apuntando a la DB cerrada**
3. Handlers fallan con "database not open"

---

### Patrón Correcto

```typescript
// ✅ PATRÓN CORRECTO: Obtención dinámica
export function registerHandlers(): void {
  ipcMain.handle('operation', async () => {
    // Obtiene instancia ACTUAL cada vez
    const db = DatabaseConnection.getInstance();
    const result = db.prepare('...').all();
  });
}
```

**Por qué funciona:**
- Cada invocación obtiene la instancia actual de `DatabaseConnection.instance`
- Si la instancia se reemplazó, obtiene la nueva
- Siempre trabaja con la DB correcta

---

## Lecciones Aprendidas

### 1. **NUNCA capturar referencias a recursos mutables**

```typescript
// ❌ MAL
const db = DatabaseConnection.getInstance();
const repository = new Repository(db);

// ✅ BIEN
const repository = new Repository(DatabaseConnection.getInstance());
```

### 2. **Usar getInstance() dentro de handlers, no fuera**

```typescript
// ❌ MAL
export function register(): void {
  const db = getInstance();
  handle('op', () => useDb(db));
}

// ✅ BIEN
export function register(): void {
  handle('op', () => useDb(getInstance()));
}
```

### 3. **Configurar pragmas al crear instancias**

Cuando se crea una nueva instancia de DB, SIEMPRE configurar pragmas:
```typescript
const db = new Database(path);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
```

O mejor, usar un método helper:
```typescript
DatabaseConnection.configurePragmas(db);
```

### 4. **Proteger contra window destroyed**

```typescript
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.webContents.send(event);
}
```

### 5. **Prevenir operaciones concurrentes**

```typescript
if (state.isProcessing) return;
set({ isProcessing: true });
try {
  // operación
} finally {
  set({ isProcessing: false });
}
```

### 6. **Dar feedback visual siempre**

- Loading states
- Success confirmations
- Error messages detallados (no genéricos)

---

## Advertencias para Futuros Desarrollos

### ⚠️ **CRITICAL: Otros handlers probablemente tienen el mismo problema**

Los siguientes handlers **NO** han sido auditados y probablemente tienen el mismo bug de referencias capturadas:

- `src/main/ipc/handlers/models-v2.handler.ts`
- `src/main/ipc/handlers/volume.handler.ts`
- `src/main/ipc/handlers/compatibility.handler.ts`
- `src/main/ipc/handlers/changeover.handler.ts`
- `src/main/ipc/handlers/routing.handler.ts`
- `src/main/ipc/handlers/canvas-objects.handler.ts`
- `src/main/ipc/handlers/shape-catalog.handler.ts`
- Todos los demás handlers que usan repositorios

**Recomendación:**
Auditar TODOS los handlers y aplicar el mismo fix:
```typescript
// Dentro de cada handler, no fuera
const repository = new Repository(DatabaseConnection.getInstance());
```

---

### ⚠️ **Pattern de Migración para Handlers**

**ANTES:**
```typescript
export function registerHandlers(): void {
  const db = DatabaseConnection.getInstance();
  const repo = new Repository(db);

  ipcMain.handle(CHANNEL, async () => {
    return repo.method();
  });
}
```

**DESPUÉS:**
```typescript
export function registerHandlers(): void {
  ipcMain.handle(CHANNEL, async () => {
    const repo = new Repository(DatabaseConnection.getInstance());
    return repo.method();
  });
}
```

---

## Checklist para Futuras Features con DB

Cuando agregues nuevas features que usen la base de datos:

- [ ] ✅ Handlers obtienen DB con `getInstance()` DENTRO del handler
- [ ] ✅ Repositorios se crean DENTRO del handler, no fuera
- [ ] ✅ Nuevas instancias de DB configuran pragmas
- [ ] ✅ Operaciones verifican `db.open` antes de usar
- [ ] ✅ Window events verifican `!isDestroyed()`
- [ ] ✅ UI tiene `isProcessing` flag
- [ ] ✅ UI muestra feedback visual (loading, success, errors)
- [ ] ✅ Errores son específicos, no genéricos
- [ ] ✅ Type-check pasa sin errores
- [ ] ✅ Pruebas manuales: New → Save → Open ciclo completo

---

## Archivos Modificados (Resumen)

### Backend (Main Process)
1. `src/main/database/connection.ts` - Agregado `configurePragmas()`
2. `src/main/database/helpers/ProjectMetadataHelper.ts` - Fix SQL
3. `src/main/services/project/ProjectFileService.ts` - Multiple fixes
4. `src/main/services/project/VersionChecker.ts` - Type safety
5. `src/main/ipc/handlers/project.handler.ts` - `getInstance()` + `isDestroyed()`
6. `src/main/ipc/handlers/plant.handler.ts` - `getInstance()` en todos los handlers

### Frontend (Renderer)
7. `src/renderer/store/useProjectStore.ts` - `isProcessing` flag + logs + alerts

### Total: 7 archivos modificados, 200+ líneas de código corregidas

---

## Verificación Final

### Flujo Completo que DEBE Funcionar

1. ✅ **New Project** → Crea proyecto limpio
2. ✅ **Add data** → Agregar plantas, modelos, etc.
3. ✅ **Save As** → `my-project.lop`
   - Nombre cambia a "my-project"
   - Datos visibles
4. ✅ **Modify** → Hacer cambios
5. ✅ **Save** → Guardar cambios
6. ✅ **New Project** → Vuelve a proyecto limpio
   - Nombre vuelve a "Untitled Project"
   - Datos desaparecen
   - ⚠️ **NO destruye my-project.lop**
7. ✅ **Open** → `my-project.lop`
   - Nombre cambia a "my-project"
   - Todos los datos aparecen

---

## Próximos Pasos Recomendados

### Inmediato
1. ✅ Commit estos fixes a Git
2. ⚠️ Auditar y fix todos los demás handlers
3. ⚠️ Agregar tests automatizados para Save/Open/New

### Corto Plazo
1. Implementar Toast notifications (reemplazar `alert()`)
2. Agregar loading spinners/indicators
3. Implementar "Close Project" en File menu
4. Agregar "Recent Projects" list

### Largo Plazo
1. Refactor arquitectura de handlers para usar Dependency Injection
2. Implementar Repository pattern con gestión automática de instancias
3. Tests E2E para todo el flujo de project files
4. Validación automática de que handlers usan getInstance()

---

## Referencias

- **Phase Spec:** `docs/specs/phase-8.0-project-files.md`
- **CHANGELOG:** `docs/CHANGELOG-PHASES.md` (Phase 8.0 entry)
- **Better-sqlite3 Docs:** https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
- **Electron IPC:** https://www.electronjs.org/docs/latest/api/ipc-main

---

**Última actualización:** 2026-02-07
**Autor:** Aaron Zapata
**Revisado por:** Claude Code (Assistant)
