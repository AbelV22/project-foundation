import os

SUPABASE_URL = "https://uqjwfnevtefdfpbckuwf.supabase.co"

print("Conectando a Supabase...")
print(f"URL: {SUPABASE_URL}")

# Leer el archivo de migracion
with open('supabase/migrations/20260125_add_expenses_tracking.sql', 'r', encoding='utf-8') as f:
    migration_sql = f.read()

print(f"\nSQL de migracion cargado, tamaño: {len(migration_sql)} bytes")

# Dividir en statements individuales
statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]

print(f"\nTotal de {len(statements)} declaraciones SQL encontradas\n")

print("=" * 80)
print("IMPORTANTE: Necesitas ejecutar este SQL manualmente en Supabase Dashboard")
print("=" * 80)
print("\nPasos:")
print("1. Abre: https://supabase.com/dashboard/project/uqjwfnevtefdfpbckuwf/sql/new")
print("2. Copia TODO el SQL de abajo")
print("3. Pegalo en el editor SQL")
print("4. Haz clic en RUN (boton verde)")
print("\n" + "=" * 80)
print("SQL COMPLETO PARA COPIAR:")
print("=" * 80 + "\n")
print(migration_sql)
print("\n" + "=" * 80)
print("FIN DEL SQL - Copia desde arriba hasta aqui")
print("=" * 80)
