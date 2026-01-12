# LINE OPTIMIZER - GUÍA RÁPIDA

## Inicio Rápido
```bash
# 1. Abrir proyecto
cd ~/Developer/work/Line_Utilization_Desktop_App

# 2. Iniciar app
npm start

# 3. En la app: Click en "Canvas" → Ver 6 líneas
```

## Comandos Más Usados
```bash
npm start              # Iniciar app
npm run type-check     # Verificar TypeScript
npm run lint:fix       # Corregir linting
npm run format         # Formatear código
```

## Estructura Clave
```
src/
├── domain/entities/           # Lógica de negocio
├── renderer/features/canvas/  # Canvas UI
├── main/ipc/handlers/         # IPC handlers
└── main/database/             # SQLite
```

## Archivos Importantes

- `ESTADO_PROYECTO_2025-01-08.md` - Este documento (referencia completa)
- `src/shared/types/index.ts` - Tipos TypeScript
- `src/shared/constants/index.ts` - IPC channels y constantes
- `src/main/database/connection.ts` - Conexión DB

## Próximo Paso: FASE 2

Implementar modal "Add Line" para crear líneas desde UI.

Ver FASE 2 en documento principal para detalles.
