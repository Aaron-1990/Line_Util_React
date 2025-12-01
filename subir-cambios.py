#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import subprocess
import os # Necesario para buscar carpetas

def run_command(command, ignore_errors=False):
    """Ejecuta un comando y gestiona la salida."""
    if "rev-parse" not in command and "branch" not in command:
        print(f"▶️ Ejecutando: {' '.join(command)}")
    
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    
    if result.returncode != 0:
        if "commit" in command and "nothing to commit" in result.stdout:
            print("⚠️ No hay cambios de archivos (commit omitido).")
            return True

        if ignore_errors:
            return False
            
        print(f"❌ Error crítico al ejecutar: {' '.join(command)}")
        print(result.stderr if result.stderr else result.stdout)
        sys.exit(1)
    
    if result.stdout.strip() and "rev-parse" not in command:
        print(result.stdout.strip())
        print("-" * 30)
    return True

def ensure_main_branch():
    """Garantiza que estemos usando la rama 'main'."""
    res = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True)
    current_branch = res.stdout.strip()
    
    if current_branch == "master":
        print("🔀 Rama 'master' detectada. Renombrando a 'main'...")
        run_command(["git", "branch", "-m", "main"])

def check_remote():
    """Verifica y configura el remoto 'origin'."""
    print("🔍 Verificando configuración...")
    result = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True)
    
    if result.returncode != 0:
        print("⚠️ No se detectó un repositorio remoto vinculado.")
        url = input("🌐 Introduce la URL de tu repositorio GitHub: ").strip()
        if url:
            run_command(["git", "remote", "add", "origin", url])
            print("✅ Remoto configurado.")
        else:
            print("❌ Se requiere una URL. Abortando.")
            sys.exit(1)

def create_gitkeep_in_empty_dirs():
    """Busca carpetas vacías y añade un .gitkeep para que Git las suba."""
    print("📂 Escaneando carpetas vacías...")
    created_count = 0
    # Recorremos todo el directorio actual
    for root, dirs, files in os.walk("."):
        # Ignorar la carpeta .git para no corromper nada
        if ".git" in root:
            continue
            
        # Si no hay archivos y no hay subcarpetas, está vacía
        if not files and not dirs:
            gitkeep_path = os.path.join(root, ".gitkeep")
            # Crear el archivo vacío
            with open(gitkeep_path, 'w') as f:
                pass 
            print(f"   ➕ .gitkeep creado en: {root}")
            created_count += 1
            
    if created_count > 0:
        print(f"✅ Se añadieron {created_count} archivos .gitkeep en carpetas vacías.")
    else:
        print("✅ No se encontraron carpetas vacías.")

# --- Lógica Principal ---

# 1. Inicialización
if subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], capture_output=True).returncode != 0:
    print("CDM: Inicializando repositorio git...")
    run_command(["git", "init"])

ensure_main_branch()
check_remote()

# 2. NUEVO PASO: Rellenar carpetas vacías
create_gitkeep_in_empty_dirs()

# 3. Pedir mensaje
commit_message = input("\n📝 Introduce el mensaje para tu commit: ")
if not commit_message:
    print("❌ El mensaje es obligatorio.")
    sys.exit(1)

print("\nIniciando sincronización...")
print("=" * 30)

# 4. Flujo Git
run_command(["git", "add", "."]) # Ahora sí detectará los .gitkeep
run_command(["git", "commit", "-m", commit_message])

print("▶️ Ejecutando: git push")
push_result = subprocess.run(["git", "push"], capture_output=True, text=True)

if push_result.returncode != 0:
    if "set-upstream" in push_result.stderr or "no upstream" in push_result.stderr:
        print("🚀 Primer push detectado. Configurando upstream...")
        run_command(["git", "push", "-u", "origin", "main"])
    else:
        print("❌ Error al hacer push:")
        print(push_result.stderr)
else:
    print("✅ Cambios subidos correctamente.")

print("\n✅ ¡Todo listo!")