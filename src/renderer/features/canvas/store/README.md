# Canvas Stores - Phase 7.5

Three Zustand stores for managing canvas tool state, shape catalog, and canvas objects.

## Files Created

1. **useToolStore.ts** - Canvas tool interaction state (select, pan, connect, place)
2. **useShapeCatalogStore.ts** - Shape catalog management with IPC calls
3. **useCanvasObjectStore.ts** - Canvas objects and connections with IPC calls

---

## 1. useToolStore

Manages active canvas tool, ghost position, selection, and connection state.

### Usage Examples

```typescript
import { useToolStore } from './store/useToolStore';

// In a toolbar component
function CanvasToolbar() {
  const { activeTool, setSelectTool, setPanTool, setPlaceTool } = useToolStore();
  const isSelectActive = activeTool === 'select';

  return (
    <div>
      <button onClick={setSelectTool} disabled={isSelectActive}>
        Select (V)
      </button>
      <button onClick={setPanTool}>Pan (H)</button>
      <button onClick={() => setPlaceTool('rect-basic')}>
        Place Rectangle
      </button>
    </div>
  );
}

// In a canvas component for keyboard shortcuts
function Canvas() {
  const { setSelectTool, setPanTool, setConnectTool } = useToolStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') setSelectTool();
      if (e.key === 'h' || e.key === 'H') setPanTool();
      if (e.key === 'c' || e.key === 'C') setConnectTool();
      if (e.key === 'Escape') setSelectTool();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ...
}

// Selection management
function ObjectNode({ id }: { id: string }) {
  const { isSelected, toggleSelection, addToSelection } = useToolStore();

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      addToSelection(id);
    } else if (e.metaKey || e.ctrlKey) {
      toggleSelection(id);
    } else {
      setSelectedObjects([id]);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={isSelected(id) ? 'selected' : ''}
    >
      {/* Node content */}
    </div>
  );
}

// Ghost position for place preview
function GhostPreview() {
  const { isPlacing, ghostPosition, getPlacingShapeId } = useToolStore();
  const { getShapeById } = useShapeCatalogStore();

  if (!isPlacing() || !ghostPosition) return null;

  const shapeId = getPlacingShapeId();
  const shape = shapeId ? getShapeById(shapeId) : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: ghostPosition.x,
        top: ghostPosition.y,
        opacity: 0.5,
      }}
    >
      {shape && <ShapePreview shape={shape} />}
    </div>
  );
}

// Connection creation
function ConnectMode() {
  const { connectionSource, setConnectionSource, clearConnectionSource } = useToolStore();
  const { createConnection } = useCanvasObjectStore();

  const handleAnchorClick = async (objectId: string, anchor: string) => {
    if (!connectionSource) {
      // First click - set source
      setConnectionSource({ objectId, anchor });
    } else {
      // Second click - create connection
      await createConnection(
        connectionSource.objectId,
        objectId,
        connectionSource.anchor,
        anchor
      );
      clearConnectionSource();
    }
  };

  // ...
}
```

---

## 2. useShapeCatalogStore

Manages shape catalog with categories, shapes, favorites, and usage tracking.

### Usage Examples

```typescript
import { useShapeCatalogStore } from './store/useShapeCatalogStore';

// Initialize on app startup
function App() {
  const { initialize, isInitialized } = useShapeCatalogStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, []);

  // ...
}

// Display shapes by category
function ShapePalette() {
  const { categories, getShapesByCategory } = useShapeCatalogStore();
  const [selectedCategory, setSelectedCategory] = useState('basic');

  const shapes = getShapesByCategory(selectedCategory);

  return (
    <div>
      <CategoryTabs
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <ShapeGrid shapes={shapes} />
    </div>
  );
}

// Favorite shapes quick access
function FavoritesPanel() {
  const { getFavoriteShapes, toggleFavorite } = useShapeCatalogStore();
  const favorites = getFavoriteShapes();

  return (
    <div>
      <h3>Favorites</h3>
      {favorites.map((shape) => (
        <ShapeButton
          key={shape.id}
          shape={shape}
          onFavoriteToggle={() => toggleFavorite(shape.id)}
        />
      ))}
    </div>
  );
}

// Most used shapes
function QuickAccessPanel() {
  const { getMostUsedShapes } = useShapeCatalogStore();
  const topShapes = getMostUsedShapes(5);

  return (
    <div>
      <h3>Recently Used</h3>
      {topShapes.map((shape) => (
        <ShapeButton key={shape.id} shape={shape} />
      ))}
    </div>
  );
}

// Increment usage when placing shape
function PlaceShapeHandler() {
  const { incrementUsage } = useShapeCatalogStore();
  const { createObject } = useCanvasObjectStore();

  const placeShape = async (shapeId: string, x: number, y: number) => {
    await createObject({
      plantId: currentPlantId,
      shapeId,
      name: 'New Object',
      xPosition: x,
      yPosition: y,
    });

    // Track usage (fire-and-forget)
    incrementUsage(shapeId);
  };

  // ...
}
```

---

## 3. useCanvasObjectStore

Manages canvas objects, connections, and object properties with plant scoping.

### Usage Examples

```typescript
import { useCanvasObjectStore } from './store/useCanvasObjectStore';

// Initialize for current plant
function Canvas() {
  const { currentPlantId } = usePlantStore();
  const { setCurrentPlant, objects, connections, isLoading } = useCanvasObjectStore();

  useEffect(() => {
    if (currentPlantId) {
      setCurrentPlant(currentPlantId);
    }
  }, [currentPlantId]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <ReactFlow>
      {objects.map((obj) => (
        <ObjectNode key={obj.id} object={obj} />
      ))}
      {connections.map((conn) => (
        <ConnectionEdge key={conn.id} connection={conn} />
      ))}
    </ReactFlow>
  );
}

// Create object on canvas click
function CanvasClickHandler() {
  const { isPlacing, getPlacingShapeId } = useToolStore();
  const { createObject } = useCanvasObjectStore();
  const { currentPlantId } = usePlantStore();

  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (!isPlacing()) return;

    const shapeId = getPlacingShapeId();
    if (!shapeId || !currentPlantId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    await createObject({
      plantId: currentPlantId,
      shapeId,
      name: 'New Object',
      xPosition: x,
      yPosition: y,
    });
  };

  return <div onClick={handleCanvasClick}>{/* Canvas */}</div>;
}

// Update object position (drag)
function DraggableNode({ object }: { object: CanvasObjectWithDetails }) {
  const { updatePosition } = useCanvasObjectStore();

  const handleDragEnd = (e: DragEvent, position: { x: number; y: number }) => {
    updatePosition(object.id, position.x, position.y);
  };

  // ...
}

// Batch position update (multi-select drag)
function MultiSelectDrag() {
  const { selectedObjectIds } = useToolStore();
  const { updatePositionsBatch } = useCanvasObjectStore();

  const handleDragEnd = (delta: { x: number; y: number }) => {
    const positions = selectedObjectIds.map((id) => ({
      id,
      x: object.xPosition + delta.x,
      y: object.yPosition + delta.y,
    }));

    updatePositionsBatch(positions);
  };

  // ...
}

// Context menu - Convert type
function ContextMenu({ objectId }: { objectId: string }) {
  const { convertType } = useCanvasObjectStore();

  return (
    <div>
      <MenuItem onClick={() => convertType(objectId, 'process')}>
        Convert to Process
      </MenuItem>
      <MenuItem onClick={() => convertType(objectId, 'buffer')}>
        Convert to Buffer
      </MenuItem>
    </div>
  );
}

// Buffer properties panel
function BufferPropertiesPanel({ objectId }: { objectId: string }) {
  const { getObjectById, setBufferProps } = useCanvasObjectStore();
  const object = getObjectById(objectId);

  if (object?.objectType !== 'buffer' || !object.bufferProperties) {
    return null;
  }

  const handleUpdate = async (props: UpdateBufferPropertiesInput) => {
    await setBufferProps(objectId, props);
  };

  return (
    <div>
      <h3>Buffer Properties</h3>
      <input
        type="number"
        value={object.bufferProperties.maxCapacity}
        onChange={(e) => handleUpdate({ maxCapacity: +e.target.value })}
      />
      <input
        type="number"
        value={object.bufferProperties.bufferTimeHours}
        onChange={(e) => handleUpdate({ bufferTimeHours: +e.target.value })}
      />
    </div>
  );
}

// Process line linking
function ProcessLinkModal({ objectId }: { objectId: string }) {
  const { linkToLine, getObjectById } = useCanvasObjectStore();
  const { lines } = useLineStore();
  const object = getObjectById(objectId);

  const handleLink = async (lineId: string) => {
    await linkToLine(objectId, lineId);
  };

  return (
    <Modal>
      <h3>Link to Production Line</h3>
      <select onChange={(e) => handleLink(e.target.value)}>
        <option value="">Select line...</option>
        {lines.map((line) => (
          <option key={line.id} value={line.id}>
            {line.name}
          </option>
        ))}
      </select>
      {object?.linkedLine && <p>Linked: {object.linkedLine.name}</p>}
    </Modal>
  );
}

// Connection creation
function ConnectTool() {
  const { connectionSource, setConnectionSource, clearConnectionSource } = useToolStore();
  const { createConnection } = useCanvasObjectStore();

  const handleAnchorClick = async (
    objectId: string,
    anchor: string
  ) => {
    if (!connectionSource) {
      setConnectionSource({ objectId, anchor });
    } else {
      await createConnection(
        connectionSource.objectId,
        objectId,
        connectionSource.anchor,
        anchor
      );
      clearConnectionSource();
    }
  };

  // ...
}

// Get connected objects
function ObjectInspector({ objectId }: { objectId: string }) {
  const { getConnectedObjects, getObjectById } = useCanvasObjectStore();
  const connections = getConnectedObjects(objectId);

  return (
    <div>
      <h4>Incoming ({connections.incoming.length})</h4>
      {connections.incoming.map((conn) => {
        const source = getObjectById(conn.sourceObjectId);
        return <p key={conn.id}>{source?.name}</p>;
      })}

      <h4>Outgoing ({connections.outgoing.length})</h4>
      {connections.outgoing.map((conn) => {
        const target = getObjectById(conn.targetObjectId);
        return <p key={conn.id}>{target?.name}</p>;
      })}
    </div>
  );
}

// Filter by type
function ProcessObjectsList() {
  const { getObjectsByType } = useCanvasObjectStore();
  const processObjects = getObjectsByType('process');

  return (
    <div>
      <h3>Process Objects</h3>
      {processObjects.map((obj) => (
        <ObjectCard key={obj.id} object={obj} />
      ))}
    </div>
  );
}
```

---

## Store Integration Pattern

All three stores work together for complete canvas functionality:

```typescript
function CanvasContainer() {
  // Initialize stores
  const { initialize: initCatalog, isInitialized: catalogReady } = useShapeCatalogStore();
  const { setCurrentPlant, objects, connections } = useCanvasObjectStore();
  const { activeTool, setSelectTool, isPlacing } = useToolStore();
  const { currentPlantId } = usePlantStore();

  useEffect(() => {
    // Initialize catalog once
    if (!catalogReady) {
      initCatalog();
    }
  }, []);

  useEffect(() => {
    // Load objects when plant changes
    if (currentPlantId) {
      setCurrentPlant(currentPlantId);
    }
  }, [currentPlantId]);

  return (
    <div>
      <CanvasToolbar />
      <ObjectPalette />
      <Canvas
        objects={objects}
        connections={connections}
        activeTool={activeTool}
      />
      {isPlacing() && <GhostPreview />}
      <PropertiesPanel />
    </div>
  );
}
```

---

## Key Features

### useToolStore
- Tool state management (select, pan, connect, place)
- Ghost position for placement preview
- Multi-select support (Shift, Ctrl/Cmd)
- Connection source tracking
- Keyboard shortcut helpers

### useShapeCatalogStore
- Categories and shapes loading
- Favorites management
- Usage tracking
- Optimistic updates
- Category filtering
- Most-used shapes

### useCanvasObjectStore
- Plant-scoped object loading
- CRUD with optimistic updates
- Batch position updates
- Type conversion (generic → process, buffer)
- Buffer properties management
- Process line linking
- Connection management
- Object relationships

---

## Notes

1. **IPC Channels**: All stores use channels from `@shared/constants`
2. **Plant Scoping**: Objects are loaded per-plant in useCanvasObjectStore
3. **Optimistic Updates**: Position and property updates are optimistic with rollback
4. **Error Handling**: All stores have error state with `clearError()` method
5. **Type Safety**: Full TypeScript typing from shared types
6. **Initialization**: ShapeCatalogStore needs `initialize()` call on app startup
7. **Fire-and-Forget**: Usage tracking doesn't block UI
8. **Multi-Select**: useToolStore supports Shift/Ctrl selection patterns
