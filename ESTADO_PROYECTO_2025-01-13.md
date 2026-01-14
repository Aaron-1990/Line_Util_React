# LINE OPTIMIZER - ESTADO DEL PROYECTO
**Fecha:** 13 de Enero, 2025  
**Versión:** 0.1.1 (FASE 2 + Bug Fixes Completados)  
**Stack:** Electron 28 + React 18 + TypeScript + SQLite + ReactFlow  
**Estado:** ✅ FASE 2 Completamente Funcional - Listo para FASE 3

---

## RESUMEN EJECUTIVO

### Logros Desde Última Actualización (08 Ene → 13 Ene)
Se completó exitosamente la **FASE 2: CRUD Completo de Líneas** y se resolvieron 2 bugs críticos de persistencia que afectaban la experiencia de usuario:

- ✅ **FASE 2 CRUD:** 100% completado (Add, Edit, Delete líneas)
- ✅ **Bug Fix 1:** Líneas eliminadas que reaparecían después de reposo
- ✅ **Bug Fix 2:** Posiciones de nodos no persistían a base de datos
- ✅ **Arquitectura de persistencia:** Documentada y validada
- ✅ **State synchronization:** React ↔ Electron ↔ SQLite funcionando correctamente

### Estado del Desarrollo
**Progreso Global:** 30% del producto final  
**FASE 1 (Canvas):** 100% ✅  
**FASE 2 (CRUD Lines):** 100% ✅  
**FASE 3 (Excel Import/Export):** 0% - PRÓXIMA  

---

## BUGS CRÍTICOS RESUELTOS

### 🐛 BUG #1: Líneas Eliminadas Reaparecen Después de Reposo

**Síntoma:**
Usuario elimina líneas vía UI → Mac entra en reposo → Al despertar, líneas eliminadas reaparecen en canvas.

**Causa Raíz:**
```typescript
// src/main/ipc/handlers/production-lines.handler.ts - ANTES (INCORRECTO)
ipcMain.handle(IPC_CHANNELS.LINES_GET_ALL, async () => {
  const lines = await repository.findAll(); // ❌ Trae TODAS incluyendo active=0
  return { success: true, data: lines.map(line => line.toJSON()) };
});
```

**Flujo del Bug:**
```
1. Usuario elimina línea → soft delete (UPDATE active = 0)
2. Mac entra en reposo → Electron pausa
3. Mac despierta → React re-monta ProductionCanvas
4. useLoadLines ejecuta → Llama IPC LINES_GET_ALL
5. Handler trae TODAS las líneas (incluidas deleted)
6. Canvas muestra líneas eliminadas ❌
```

**Solución Implementada:**
```typescript
// src/main/ipc/handlers/production-lines.handler.ts - DESPUÉS (CORRECTO)
ipcMain.handle(IPC_CHANNELS.LINES_GET_ALL, async () => {
  const lines = await repository.findActive(); // ✅ Solo active = 1
  return { success: true, data: lines.map(line => line.toJSON()) };
});

// src/main/database/repositories/SQLiteProductionLineRepository.ts
async findActive(): Promise<ProductionLine[]> {
  const rows = this.db
    .prepare('SELECT * FROM production_lines WHERE active = 1 ORDER BY name')
    .all() as LineRow[];
  return rows.map(row => this.mapRowToEntity(row));
}
```

**Mejora Adicional:**
```typescript
// src/renderer/features/canvas/hooks/useLoadLines.ts
export function useLoadLines() {
  const { addNode, setNodes } = useCanvasStore();

  useEffect(() => {
    const loadLines = async () => {
      try {
        setNodes([]); // ✅ Limpiar estado previo antes de cargar
        
        const response = await window.electronAPI.invoke<ProductionLine[]>('lines:get-all');
        
        if (response.success && response.data) {
          response.data.forEach((line) => {
            addNode({
              id: line.id,
              type: 'productionLine',
              position: { x: line.xPosition, y: line.yPosition },
              data: { ...line }
            });
          });
        }
      } catch (error) {
        console.error('Error loading lines:', error);
      }
    };

    loadLines();
  }, [addNode, setNodes]);
}
```

**Validación:**
```bash
# Verificar que query filtra correctamente
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT name, active FROM production_lines ORDER BY name;"
```

**Estado:** ✅ RESUELTO - Validado en Mac sleep/wake cycles

---

### 🐛 BUG #2: Posiciones de Nodos No Persisten a Base de Datos

**Síntoma:**
Usuario arrastra línea a nueva posición → Cierra app → Reabre app → Línea vuelve a posición original.

**Causa Raíz:**
ReactFlow no incluye `position` en el objeto `change` cuando `dragging` termina (`false`):
```typescript
// ANTES (INCORRECTO)
const onNodesChange = useCallback((changes: NodeChange[]) => {
  const updatedNodes = applyNodeChanges(changes, nodes);
  setNodes(updatedNodes);

  changes.forEach((change) => {
    if (
      change.type === 'position' &&
      change.position &&  // ❌ undefined cuando dragging = false
      !change.dragging && 
      change.id
    ) {
      // Este bloque NUNCA se ejecutaba
      updateNodePosition(change.id, change.position.x, change.position.y);
    }
  });
}, [nodes, setNodes, updateNodePosition]);
```

**Flujo del Bug Detectado con Logging:**
```
[DEBUG] Processing change: position dragging: true   (mientras arrastra)
[DEBUG] Processing change: position dragging: true
[DEBUG] Processing change: position dragging: true
[DEBUG] Processing change: position dragging: false  (cuando suelta)
  ↑ change.position = undefined aquí ❌
```

**Arquitectura Electron: Por Qué el Bug Importa**
```
┌─────────────────────────────────────────────────────────┐
│              ELECTRON ARCHITECTURE                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  RENDERER PROCESS (Chrome/React)                        │
│  ┌────────────────────────────────────┐                │
│  │  - UI visible                      │                │
│  │  - JavaScript navegador            │                │
│  │  - NO acceso a Node.js/filesystem  │                │
│  │  - NO acceso a SQLite              │                │
│  │  - Zustand store (in-memory)       │                │
│  └────────────────────────────────────┘                │
│              ↕ IPC (Inter-Process Communication)        │
│  ┌────────────────────────────────────┐                │
│  │  MAIN PROCESS (Node.js)            │                │
│  │  - Backend invisible               │                │
│  │  - Acceso completo a sistema       │                │
│  │  - SQLite connection               │                │
│  │  - Filesystem, network, etc.       │                │
│  └────────────────────────────────────┘                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Flujo Correcto Requerido:**
```
1. Usuario arrastra nodo en canvas (Renderer)
   ↓
2. ReactFlow detecta cambios de posición
   ↓
3. onNodesChange callback ejecuta
   ↓
4. applyNodeChanges actualiza array de nodos
   ↓
5. setNodes actualiza Zustand store (UI actualizada ✅)
   ↓
6. Cuando dragging = false (suelta):
   - Leer posición del nodo actualizado
   - Llamar IPC: window.electronAPI.invoke('lines:update-position')
   ↓
7. Main Process recibe IPC call
   ↓
8. Ejecuta UPDATE SQL en SQLite
   ↓
9. Posición persistida ✅
```

**Solución Implementada:**
```typescript
// src/renderer/features/canvas/ProductionCanvas.tsx - DESPUÉS (CORRECTO)
const onNodesChange = useCallback(
  (changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes);
    setNodes(updatedNodes);

    changes.forEach((change) => {
      if (change.type === 'position' && !change.dragging && change.id) {
        // ✅ LEER posición del nodo actualizado (no del change)
        const updatedNode = updatedNodes.find(n => n.id === change.id);
        
        if (updatedNode) {
          // Actualizar store local (UI)
          updateNodePosition(change.id, updatedNode.position.x, updatedNode.position.y);

          // Persistir a DB vía IPC (Main Process → SQLite)
          window.electronAPI
            .invoke('lines:update-position', change.id, updatedNode.position.x, updatedNode.position.y)
            .catch((error) => {
              console.error('[ProductionCanvas] Error updating line position:', error);
            });
        }
      }
    });
  },
  [nodes, setNodes, updateNodePosition]
);
```

**Validación en Terminal (Development Mode):**
```bash
# Con verbose mode enabled en connection.ts, verás:
UPDATE production_lines SET x_position = 124.994, y_position = -2.059 WHERE id = 'UCDD8M-X0f...'
```

**Validación en Base de Datos:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT name, x_position, y_position FROM production_lines WHERE name = 'SMT Line 1';"

# Output ejemplo:
# SMT Line 1|124.994082840237|-2.05917159763315
```

**Estado:** ✅ RESUELTO - Validado con:
- App restart
- Mac sleep/wake
- Direct DB query verification

---

## ARQUITECTURA DE PERSISTENCIA

### Capas de State Management
```
┌──────────────────────────────────────────────────────┐
│                   USER INTERFACE                      │
│              (React Components + Canvas)              │
└──────────────────┬───────────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │  ZUSTAND STORE    │  ← In-Memory, Ephemeral
         │  (useCanvasStore) │  ← Fast, UI updates
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   IPC HANDLERS    │  ← Secure Bridge
         │  (preload.ts)     │  ← Type-safe
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │ DOMAIN ENTITIES   │  ← Business Logic
         │ (ProductionLine)  │  ← Validation
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   REPOSITORIES    │  ← Data Access Layer
         │ (SQLite impls)    │  ← SQL Queries
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   SQLITE DATABASE │  ← Persistent, Authoritative
         │   (WAL mode)      │  ← Single Source of Truth
         └───────────────────┘
```

### Flujo de Datos: Crear Línea
```
USER ACTION: Click "Add Line"
│
├─> [Renderer] Modal muestra formulario
│
├─> [Renderer] Usuario llena datos
│
├─> [Renderer] Click "Create"
│   │
│   ├─> Validación client-side
│   │
│   └─> window.electronAPI.invoke('lines:create', data)
│       │
│       └─> [IPC Bridge] Serializa y envía a Main Process
│           │
│           └─> [Main Process] production-lines.handler.ts recibe
│               │
│               ├─> Valida campos requeridos
│               │
│               ├─> Verifica nombre único (repository.existsByName)
│               │
│               ├─> ProductionLine.create() - Domain Entity
│               │   └─> Validación de negocio (efficiency 0-1, etc.)
│               │
│               ├─> repository.save(line)
│               │   └─> SQLite: INSERT INTO production_lines ...
│               │
│               └─> return { success: true, data: line.toJSON() }
│                   │
│                   └─> [IPC Bridge] Respuesta a Renderer
│                       │
│                       └─> [Renderer] useCanvasStore.addNode()
│                           └─> UI actualizada con nueva línea ✅
```

### Flujo de Datos: Arrastrar Línea
```
USER ACTION: Drag node on canvas
│
├─> [ReactFlow] onNodesChange fires (dragging: true)
│   └─> [Zustand] setNodes(updatedNodes) - UI actualizada
│
├─> [ReactFlow] onNodesChange fires (dragging: true)
│   └─> [Zustand] setNodes(updatedNodes) - UI actualizada
│
├─> ... (muchos eventos mientras arrastra)
│
└─> USER RELEASES: onNodesChange fires (dragging: false)
    │
    ├─> [Zustand] setNodes(updatedNodes) - UI con posición final
    │
    ├─> Leer updatedNode.position { x, y }
    │
    ├─> [Zustand] updateNodePosition(id, x, y) - Store local actualizado
    │
    └─> window.electronAPI.invoke('lines:update-position', id, x, y)
        │
        └─> [IPC Bridge] → Main Process
            │
            └─> [Main Process] production-lines.handler.ts
                │
                └─> repository.updatePosition(id, x, y)
                    │
                    └─> SQLite: UPDATE production_lines 
                              SET x_position = ?, y_position = ?
                              WHERE id = ?
                    │
                    └─> return { success: true }
                        │
                        └─> Posición persistida ✅
```

### Flujo de Datos: Eliminar Línea
```
USER ACTION: Click "Delete" en properties panel
│
├─> [Renderer] Confirmation dialog
│
├─> [Renderer] Usuario confirma
│   │
│   └─> window.electronAPI.invoke('lines:delete', id)
│       │
│       └─> [IPC Bridge] → Main Process
│           │
│           └─> [Main Process] production-lines.handler.ts
│               │
│               ├─> Verifica que línea existe
│               │
│               └─> repository.delete(id)
│                   │
│                   └─> SQLite: UPDATE production_lines 
│                             SET active = 0 
│                             WHERE id = ?
│                   │
│                   └─> return { success: true }
│                       │
│                       └─> [Renderer] useCanvasStore.deleteNode(id)
│                           └─> UI actualizada (línea removida) ✅
```

### Flujo de Datos: Cargar Líneas (App Start)
```
APP STARTS
│
├─> [Main Process] DatabaseConnection.getInstance()
│   ├─> Crea/abre SQLite DB
│   ├─> Ejecuta migrations
│   └─> Seed data (solo en development)
│
├─> [Main Process] registerAllHandlers()
│   └─> IPC handlers listos
│
├─> [Renderer] React app monta
│   │
│   └─> ProductionCanvas monta
│       │
│       └─> useLoadLines() hook ejecuta
│           │
│           ├─> useCanvasStore.setNodes([]) - Limpiar estado previo
│           │
│           └─> window.electronAPI.invoke('lines:get-all')
│               │
│               └─> [IPC Bridge] → Main Process
│                   │
│                   └─> [Main Process] LINES_GET_ALL handler
│                       │
│                       └─> repository.findActive()
│                           │
│                           └─> SQLite: SELECT * FROM production_lines 
│                                     WHERE active = 1 
│                                     ORDER BY name
│                           │
│                           └─> return { success: true, data: lines[] }
│                               │
│                               └─> [Renderer] lines.forEach(addNode)
│                                   └─> Canvas renderiza todas las líneas ✅
```

### Principios Arquitectónicos Aplicados

**1. Single Source of Truth**
- SQLite DB es la fuente autoritativa
- Zustand store es cache efímero para UI
- Al recargar app, siempre se lee de DB

**2. Separation of Concerns**
- Renderer: Solo UI y presentación
- Main Process: Lógica de negocio y persistencia
- IPC: Barrera de seguridad bien definida

**3. Optimistic Updates**
- UI actualiza inmediatamente (Zustand)
- DB persiste asíncronamente (IPC)
- Si falla IPC, usuario ve error pero UI ya cambió

**4. Domain-Driven Design**
- Entities con validación de negocio
- Repositories abstraen acceso a datos
- Handlers orquestan flujo

**5. Type Safety**
- TypeScript end-to-end
- Shared types entre Main y Renderer
- IPC channels como constantes tipadas

---

## ARCHIVOS MODIFICADOS (13 Enero 2025)

### Bug Fix #1: Líneas Eliminadas
```
src/main/ipc/handlers/production-lines.handler.ts
  - Línea 23: repository.findAll() → repository.findActive()

src/renderer/features/canvas/hooks/useLoadLines.ts
  - Línea 14: Agregado setNodes([]) para limpiar store
```

### Bug Fix #2: Posiciones No Persisten
```
src/renderer/features/canvas/ProductionCanvas.tsx
  - Líneas 45-62: Refactorizado onNodesChange
  - Agregado: Leer posición de updatedNodes
  - Agregado: IPC call a lines:update-position
```

### Mejora: Logging SQL (Opcional)
```
src/main/database/connection.ts
  - Línea 28: verbose mode comentado por defecto
  - Descomentar para ver queries SQL en terminal
```

---

## TESTING REALIZADO

### ✅ Test 1: Position Persistence - App Restart
```bash
SETUP:
1. npm start
2. Arrastrar "SMT Line 1" a posición (125, -2)
3. Cerrar app (Cmd+Q)
4. npm start

EXPECTED: Línea en posición (125, -2)
RESULT: ✅ PASS

VERIFICATION:
sqlite3 ~/Library/.../line-optimizer.db \
  "SELECT x_position, y_position FROM production_lines WHERE name = 'SMT Line 1';"
OUTPUT: 124.994082840237|-2.05917159763315
```

### ✅ Test 2: Position Persistence - Mac Sleep/Wake
```bash
SETUP:
1. App abierta con líneas en canvas
2. Mover múltiples líneas a nuevas posiciones
3. Poner Mac en reposo (30 segundos)
4. Despertar Mac

EXPECTED: Todas las posiciones mantenidas
RESULT: ✅ PASS
```

### ✅ Test 3: Deleted Lines Don't Reappear
```bash
SETUP:
1. Crear línea "Test Delete"
2. Eliminar vía UI
3. Verificar DB: active = 0
4. Cerrar app
5. Reabrir app

EXPECTED: Línea NO aparece en canvas
RESULT: ✅ PASS

VERIFICATION:
sqlite3 ~/Library/.../line-optimizer.db \
  "SELECT name, active FROM production_lines WHERE name = 'Test Delete';"
OUTPUT: Test Delete|0
```

### ✅ Test 4: Deleted Lines After Sleep
```bash
SETUP:
1. Eliminar 2 líneas
2. Poner Mac en reposo (1 minuto)
3. Despertar Mac
4. Verificar canvas

EXPECTED: Líneas eliminadas NO reaparecen
RESULT: ✅ PASS
```

### ✅ Test 5: IPC Response Validation
```bash
SETUP:
1. DevTools abierto (Cmd+Option+I)
2. Console limpia (Cmd+K)
3. Arrastrar línea

EXPECTED LOGS:
[ProductionCanvas] Position change detected: {id: "...", x: 124.99, y: -2.05}
[ProductionCanvas] Calling IPC lines:update-position...
[ProductionCanvas] IPC response: {success: true, message: "Position updated successfully"}

RESULT: ✅ PASS
```

---

## COMANDOS ÚTILES PARA DEBUGGING

### Verificar Estado de Base de Datos
```bash
# Ver todas las líneas y su estado
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT name, active, x_position, y_position FROM production_lines ORDER BY name;"

# Solo líneas activas
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT name, x_position, y_position FROM production_lines WHERE active = 1;"

# Contar líneas por estado
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
  "SELECT active, COUNT(*) FROM production_lines GROUP BY active;"
```

### Resetear Base de Datos
```bash
# Borrar DB y forzar re-seed
rm -f ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db*

# Reiniciar app
npm start
```

### Verificar Logs SQL
```bash
# En connection.ts, descomentar línea 28:
# verbose: console.log,

# Luego en terminal verás:
# UPDATE production_lines SET x_position = ..., y_position = ... WHERE id = '...'
```

---

## PRÓXIMOS PASOS: FASE 3

### FASE 3: Import/Export Excel (2-3 semanas estimadas)

**Objetivo:** Cargar datos masivos desde Excel y exportar resultados

**Bloques Principales:**

**BLOQUE 1: Excel Import Infrastructure**
```
src/main/services/excel/
├── ExcelImporter.ts          - Parser de archivos .xlsx
├── ExcelValidator.ts          - Validación de estructura
└── ExcelMapper.ts             - Mapeo de columnas → Entities

Librerías:
npm install xlsx
npm install --save-dev @types/xlsx

Features:
- Detectar columnas automáticamente
- Validar tipos de datos
- Reportar errores por fila
- Progress tracking
```

**BLOQUE 2: Import UI Flow**
```
src/renderer/features/excel/
├── components/
│   ├── ImportWizard.tsx       - Wizard multi-step
│   ├── FileSelector.tsx       - Drag & drop + file picker
│   ├── ColumnMapper.tsx       - Mapeo manual de columnas
│   └── ImportProgress.tsx     - Progress bar + logs
└── hooks/
    └── useExcelImport.ts      - State management

Features:
- Step 1: Select file
- Step 2: Preview data (primeras 5 filas)
- Step 3: Map columns (si no detectó automático)
- Step 4: Validate + Import
- Step 5: Results summary
```

**BLOQUE 3: Excel Export**
```
src/main/services/excel/
└── ExcelExporter.ts           - Generador de .xlsx

Features:
- Export todas las líneas
- Export líneas por área
- Export resultados de análisis
- Formateo (headers bold, borders, colors)
- Multiple sheets en un archivo
```

**BLOQUE 4: Export UI**
```
src/renderer/features/excel/
└── components/
    ├── ExportDialog.tsx       - Opciones de export
    └── ExportButton.tsx       - Botón en toolbar

Features:
- Selector: Lines, Models, Volumes, All
- Formato: Excel (.xlsx) o CSV
- Abrir archivo después de exportar
```

**Formato Excel Esperado (Import Lines):**
```
| Name         | Area | Time Available (h) | Efficiency (%) |
|--------------|------|-------------------|----------------|
| SMT Line 1   | SMT  | 23                | 85             |
| ICT Line 1   | ICT  | 23                | 90             |
| ...          | ...  | ...               | ...            |
```

**Challenges Anticipados:**
- Manejo de errores de formato
- Validación de nombres duplicados
- Progress en archivos grandes (1000+ rows)
- Rollback si falla import a mitad

---

## MEJORAS FUTURAS (BACKLOG)

### Performance
- [ ] Batch updates para arrastrar múltiples nodos
- [ ] Debounce IPC calls (solo persistir 500ms después de soltar)
- [ ] Virtual scrolling para listas grandes

### UX
- [ ] Undo/Redo (Ctrl+Z / Cmd+Z)
- [ ] Grid snap (opcional, toggle)
- [ ] Keyboard shortcuts (Delete, Escape, etc.)
- [ ] Tooltips en hover
- [ ] Mini-tutorial en primer uso

### Arquitectura
- [ ] Error boundaries en componentes críticos
- [ ] Retry logic para IPC calls fallidos
- [ ] Offline mode con queue de cambios
- [ ] Migration system completo (versioning)

### Features Avanzadas
- [ ] Multi-plant support
- [ ] Real-time collaboration (WebSockets)
- [ ] Import desde otros formatos (CSV, JSON)
- [ ] Export a PDF con gráficas

---

## CONFIGURACIÓN DEL PROYECTO

### Información del Ambiente
**Developer:** Aaron Zapata Trejo  
**Empresa:** BorgWarner  
**Ubicación:** `~/Developer/work/Line_Utilization_Desktop_App`  
**Sistema:** macOS Sequoia (Apple Silicon - ARM64)  
**Node.js:** v24.11.1 (usando nvm)  
**npm:** 11.6.2

### Dependencias Clave
```json
{
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "electron": "^28.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "reactflow": "^11.10.4",
    "zustand": "^4.4.7",
    "nanoid": "^5.0.4"
  }
}
```

### Scripts
```bash
npm start              # Desarrollo con HMR
npm run type-check     # Verificar TypeScript
npm run lint           # ESLint
npm run lint:fix       # Auto-fix linting
npm run format         # Prettier
npm run package        # Build para distribución
npm run make           # Crear instaladores
```

---

## LECCIONES APRENDIDAS

### 1. Debugging Sistemático
**Problema:** Bug difícil de reproducir (solo después de sleep)  
**Solución:** Logging estratégico en puntos clave del flujo  
**Aprendizaje:** Console logs bien ubicados son invaluables

### 2. ReactFlow Quirks
**Problema:** `change.position` undefined en `dragging: false`  
**Solución:** Leer de `updatedNodes` array  
**Aprendizaje:** Documentación de librerías puede ser incompleta

### 3. Electron IPC Patterns
**Problema:** Confusión sobre cuándo usar IPC  
**Solución:** Regla clara: UI → Zustand (rápido), DB → IPC (asíncrono)  
**Aprendizaje:** Separation of concerns evita bugs sutiles

### 4. Soft Deletes
**Problema:** Queries traían registros eliminados  
**Solución:** Filtrar en SQL, no en JavaScript  
**Aprendizaje:** Filter at source es más eficiente y menos propenso a errores

### 5. State Synchronization
**Problema:** Store React y DB SQLite fuera de sync  
**Solución:** DB es single source of truth, siempre leer al cargar  
**Aprendizaje:** Limpiar store (`setNodes([])`) antes de popular evita estados mezclados

---

## RECURSOS Y REFERENCIAS

### Documentación Oficial
- **Electron IPC:** https://www.electronjs.org/docs/latest/tutorial/ipc
- **ReactFlow:** https://reactflow.dev/docs/guides/custom-nodes
- **Zustand:** https://docs.pmnd.rs/zustand/getting-started/introduction
- **better-sqlite3:** https://github.com/WiseLibs/better-sqlite3

### Patrones Arquitectónicos
- **Clean Architecture:** Entities → Repositories → Handlers → UI
- **SOLID Principles:** Especialmente Dependency Inversion
- **Event-Driven:** ReactFlow events → Callbacks → State updates

---

## CHECKLIST PARA PRÓXIMA SESIÓN (FASE 3)

### Antes de Comenzar:
- [ ] Leer este documento completo
- [ ] Verificar app funciona: `npm start`
- [ ] Confirmar bugs resueltos: arrastrar línea + restart
- [ ] Git status limpio: `git status`

### Durante FASE 3:
- [ ] Instalar librerías: `npm install xlsx @types/xlsx`
- [ ] Crear estructura de carpetas para Excel feature
- [ ] Implementar en bloques discretos (1-2-3-4)
- [ ] Validar cada bloque antes de continuar

### Al Finalizar Sesión:
- [ ] Commit cambios descriptivos
- [ ] Actualizar este documento si hay cambios arquitectónicos
- [ ] Documentar cualquier issue encontrado

---

## CONCLUSIÓN

El proyecto Line Optimizer ha superado exitosamente desafíos críticos de persistencia y sincronización de estado. La arquitectura Electron + React + SQLite está funcionando de manera robusta y confiable.

**Métricas de Calidad:**
- ✅ Zero known bugs en FASE 1 y 2
- ✅ Type safety completo (TypeScript)
- ✅ Clean Architecture implementada
- ✅ State synchronization validada
- ✅ Testing manual exhaustivo completado

**Deuda Técnica:** Mínima
- Logging SQL puede silenciarse en producción
- Test automation pendiente (no crítico para MVP)

**Listo para:** FASE 3 - Excel Import/Export

---

**Documento generado:** 13 de Enero, 2025  
**Última actualización:** 13 de Enero, 2025 04:15 CST  
**Versión del documento:** 2.0  
**Próxima actualización:** Post FASE 3 completion
