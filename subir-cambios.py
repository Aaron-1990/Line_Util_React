#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import subprocess

def run_command(command, ignore_errors=False):
    """Ejecuta un comando y gestiona la salida."""
    # Omitimos imprimir comandos muy ruidosos o de chequeo interno
    if "rev-parse" not in command and "branch" not in command:
        print(f"▶️ Ejecutando: {' '.join(command)}")
    
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    
    if result.returncode != 0:
        # Ignorar error si no hay nada que commitear
        if "commit" in command and "nothing to commit" in result.stdout:
            print("⚠️ No hay cambios nuevos para confirmar (commit omitido).")
            return True

        if ignore_errors:
            return False
            
        print(f"❌ Error crítico al ejecutar: {' '.join(command)}")
        print(result.stderr if result.stderr else result.stdout)
        sys.exit(1)
    
    # Solo imprimir salida si es relevante
    if result.stdout.strip() and "rev-parse" not in command:
        print(result.stdout.strip())
        print("-" * 30)
    return True

def ensure_main_branch():
    """Garantiza que estemos usando la rama 'main' y no 'master'."""
    res = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True)
    current_branch = res.stdout.strip()
    
    if current_branch == "master":
        print("🔀 Rama 'master' detectada. Renombrando a 'main' para estándar GitHub...")
        run_command(["git", "branch", "-m", "main"])
    elif current_branch != "main":
        print(f"ℹ️ Estás en la rama '{current_branch}'. Se continuará con esta rama.")

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
            print("❌ Se requiere una URL para continuar. Abortando.")
            sys.exit(1)

# --- Lógica Principal ---

# 1. Verificar si existe repo, si no, crear.
if subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], capture_output=True).returncode != 0:
    print("CDM: Inicializando repositorio git...")
    run_command(["git", "init"])

# 2. Asegurar que la rama se llame 'main' (CORRECCIÓN IMPORTANTE)
ensure_main_branch()

# 3. Verificar remoto
check_remote()

# 4. Pedir mensaje
commit_message = input("\n📝 Introduce el mensaje para tu commit: ")
if not commit_message:
    print("❌ El mensaje es obligatorio.")
    sys.exit(1)

print("\nIniciando sincronización...")
print("=" * 30)

# 5. Ejecutar flujo de trabajo
run_command(["git", "add", "."])
run_command(["git", "commit", "-m", commit_message])

# 6. Push inteligente
print("▶️ Ejecutando: git push")
# Intentamos push normal primero
push_result = subprocess.run(["git", "push"], capture_output=True, text=True)

if push_result.returncode != 0:
    # Si falla porque no hay upstream (primer push), forzamos el set-upstream
    if "set-upstream" in push_result.stderr or "no upstream" in push_result.stderr:
        print("🚀 Primer push detectado. Configurando upstream en origin/main...")
        run_command(["git", "push", "-u", "origin", "main"])
    else:
        print("❌ Error al hacer push:")
        print(push_result.stderr)
else:
    print("✅ Cambios subidos correctamente.")

print("\n✅ ¡Todo listo!")