-- Verificar que las tablas y vistas se crearon correctamente
SELECT 'registros_carreras' as tabla, COUNT(*) as registros FROM registros_carreras
UNION ALL
SELECT 'expenses' as tabla, COUNT(*) as registros FROM expenses;

-- Ver las columnas de registros_carreras
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'registros_carreras' 
ORDER BY ordinal_position;

-- Ver las columnas de expenses
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expenses' 
ORDER BY ordinal_position;
