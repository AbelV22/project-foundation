import json
import pandas as pd
import numpy as np
import re
import os
from datetime import datetime

# =============================================================================
# CONFIGURACIÓN Y CONSTANTES
# =============================================================================
FILE_INPUT_RAW = 'licencias_totales.json' # Tu output del scraper
FILE_HISTORY = 'public/history_stats.csv'     # Base de datos histórica
FILE_OUTPUT_WEB = 'public/web_feed.json'      # Lo que lee tu web

# Precios Base (Tu lógica corregida con VITO > MERCEDES)
PRECIOS_BASE = {
    "TESLA": 40000, "MODEL 3": 40000, "MODEL Y": 45000,
    "MERCEDES VITO": 73000, "MERCEDES CLASE V": 75000, "CLASE V": 75000, "VITO": 73000,
    "MERCEDES": 48000,
    "TOYOTA CAMRY": 34000, "TOYOTA COROLLA": 27000, "TOYOTA PRIUS": 32000,
    "TOYOTA": 28000,
    "SKODA OCTAVIA": 27000, "SKODA": 26000,
    "DACIA JOGGER": 20000, "DACIA": 19000,
    "FORD CUSTOM": 32000, "FORD": 24000,
    "VOLKSWAGEN CADDY": 32000, "VOLKSWAGEN": 30000,
    "SEAT": 22000
}
MODELOS_ORDENADOS = sorted(PRECIOS_BASE.keys(), key=len, reverse=True)

# =============================================================================
# FUNCIONES DE LIMPIEZA Y TASACIÓN
# =============================================================================
def tasar_coche(texto_raw):
    texto = texto_raw.upper()
    if "SIN COCHE" in texto or "SIN VEHICULO" in texto: return 0, "SIN COCHE"

    modelo, valor_base = "DESCONOCIDO", 10000
    for key in MODELOS_ORDENADOS:
        if key in texto:
            modelo, valor_base = key, PRECIOS_BASE[key]
            break
            
    # Antigüedad (Default 5 años)
    anio_actual = datetime.now().year
    antiguedad = 5
    match_anio = re.search(r'(201[0-9]|202[0-9])', texto)
    if match_anio: antiguedad = anio_actual - int(match_anio.group(1))
    
    # KMs
    kms = 0
    match_km = re.search(r'(\d{2,3})[\.,]?(\d{3})\s?(KM|KMS)', texto)
    if match_km: kms = int(match_km.group(1) + match_km.group(2))
    
    # Fórmula de Depreciación
    factor_edad = 0.85 ** max(0, antiguedad)
    factor_km = max(0.2, 1 - ((kms / 100000) * 0.15))
    
    return int(max(1000, valor_base * factor_edad * factor_km)), modelo

def extraer_precio(raw):
    raw_clean = raw.replace('\n', ' ').upper()
    # Prioridad: "Precio: X" > "X €" > Número suelto grande
    match_p = re.search(r'PRECIO:?\s*\|?\s*(\d{1,3}[\.,]?\d{3})', raw_clean)
    if match_p: return int(match_p.group(1).replace('.','').replace(',',''))
    
    match_e = re.search(r'(\d{1,3}[\.,]?\d{3})\s*€', raw_clean)
    if match_e: return int(match_e.group(1).replace('.','').replace(',',''))
    
    candidatos = re.finditer(r'(\d{5,6})', raw_clean.replace('.','').replace(',',''))
    for m in candidatos:
        val = int(m.group(1))
        if 80000 <= val <= 300000: # Rango lógico licencia
            if "KM" not in raw_clean[max(0, m.start()-10):min(len(raw_clean), m.end()+10)]:
                return val
    return 0

def extraer_dia(raw):
    t = raw.upper()
    dias = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]
    dia = next((d for d in dias if d in t), "DESCONOCIDO")
    tipo = " PAR" if "PAR" in t and "IMPAR" not in t else " IMPAR" if "IMPAR" in t else ""
    return (dia + tipo) if dia != "DESCONOCIDO" else "NO ESPECIFICADO"

# =============================================================================
# EJECUCIÓN PRINCIPAL
# =============================================================================
def main():
    # 1. Cargar Datos Crudos (Scraper Output)
    if not os.path.exists(FILE_INPUT_RAW):
        print("No hay datos nuevos. Fin.")
        return

    with open(FILE_INPUT_RAW, 'r') as f: raw_data = json.load(f)
    
    clean_items = []
    for item in raw_data:
        raw = item.get('raw', '')
        fuente = item.get('fuente', 'DESCONOCIDO')
        
        # Filtros básicos
        if any(x in raw.upper() for x in ["VTC", "SANTA MARGARIDA", "3 LICENCIA"]): continue
        
        # Extracción inteligente STAC vs General
        texto_coche = raw
        precio = 0
        if fuente == "STAC":
            parts = raw.split('|')
            precio_part = next((p for p in parts if "PRECIO" in p.upper() or "€" in p), None)
            if precio_part: precio = extraer_precio(precio_part)
            
            coche_part = next((p for p in parts if len(p)>15 and "REF" not in p.upper() and "PRECIO" not in p.upper()), raw)
            texto_coche = coche_part
        
        if precio == 0: precio = extraer_precio(raw)
        if precio < 50000: continue # Filtro basura

        valor_coche, modelo = tasar_coche(texto_coche)
        
        clean_items.append({
            "id": abs(hash(raw)), # ID único para tracking simple
            "fuente": fuente,
            "dia": extraer_dia(raw),
            "modelo": modelo,
            "precio_total": precio,
            "valor_coche": valor_coche,
            "precio_neto": precio - valor_coche,
            "raw": raw[:100]
        })

    df = pd.DataFrame(clean_items)
    
    # 2. CALCULAR MÉTRICAS DEL DÍA (SNAPSHOT)
    if df.empty: return
    
    today_stats = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "avg_price": int(df['precio_neto'].mean()),
        "median_price": int(df['precio_neto'].median()),
        "min_price": int(df['precio_neto'].min()),
        "max_price": int(df['precio_neto'].max()),
        "volume": len(df),
        "volatility_std": int(df['precio_neto'].std()) if len(df) > 1 else 0
    }

    # 3. ACTUALIZAR HISTÓRICO Y CALCULAR TENDENCIAS
    # Crear carpeta si no existe
    os.makedirs(os.path.dirname(FILE_HISTORY), exist_ok=True)
    
    history_df = pd.DataFrame()
    if os.path.exists(FILE_HISTORY):
        history_df = pd.read_csv(FILE_HISTORY)
    
    # Añadir hoy (si no existe ya para hoy)
    if not history_df.empty and today_stats['date'] in history_df['date'].values:
        # Actualizamos el registro de hoy
        history_df.loc[history_df['date'] == today_stats['date']] = pd.DataFrame([today_stats]).values
    else:
        # Añadimos nueva fila
        history_df = pd.concat([history_df, pd.DataFrame([today_stats])], ignore_index=True)
    
    # Guardar histórico actualizado
    history_df.to_csv(FILE_HISTORY, index=False)
    
    # --- CÁLCULOS FINANCIEROS AVANZADOS (BLOOMBERG STYLE) ---
    # Calcular Media Móvil (SMA) 7 días y 30 días
    history_df['sma_7'] = history_df['median_price'].rolling(window=7).mean().fillna(0).astype(int)
    history_df['sma_30'] = history_df['median_price'].rolling(window=30).mean().fillna(0).astype(int)
    
    # Calcular Cambio Porcentual Diario (Delta)
    current_median = today_stats['median_price']
    prev_median = current_median
    if len(history_df) > 1:
        prev_median = history_df.iloc[-2]['median_price']
    
    delta_abs = current_median - prev_median
    delta_pct = round((delta_abs / prev_median) * 100, 2) if prev_median else 0

    # 4. GENERAR JSON PARA LA WEB
    # Agrupación por días (Lunes, Martes...) para gráfico de barras "Precio por Día"
    precio_por_dia = df.groupby('dia')['precio_neto'].median().to_dict()
    
    # Top 5 Ofertas más baratas (El "Hot List")
    top_baratas = df.sort_values('precio_neto').head(5)[['fuente', 'dia', 'modelo', 'precio_neto', 'precio_total', 'valor_coche']].to_dict('records')

    web_output = {
        "ticker": {
            "current_price": current_median,
            "delta_value": int(delta_abs),
            "delta_percent": delta_pct,
            "direction": "up" if delta_abs >= 0 else "down",
            "volume": today_stats['volume'],
            "volatility": today_stats['volatility_std']
        },
        "charts": {
            "history_dates": history_df['date'].tolist(),
            "history_prices": history_df['median_price'].tolist(),
            "history_sma_7": history_df['sma_7'].tolist(),
            "price_by_day_descanso": precio_por_dia
        },
        "market_depth": {
            "cheapest_offers": top_baratas,
            "all_offers": df[['fuente', 'precio_neto', 'modelo', 'dia', 'raw']].to_dict('records')
        },
        "updated_at": datetime.now().strftime("%d/%m/%Y %H:%M")
    }

    with open(FILE_OUTPUT_WEB, 'w', encoding='utf-8') as f:
        json.dump(web_output, f, ensure_ascii=False, indent=4)
    
    print(f"✅ Proceso completado. Precio actual: {current_median}€ ({delta_pct}%)")

if __name__ == "__main__":
    main()
