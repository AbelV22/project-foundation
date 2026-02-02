"""
=============================================================================
PROCESADOR DE LICENCIAS V2 - Versión mejorada con mejor análisis estadístico
=============================================================================
Mejoras:
- Usa campos pre-extraídos del scraper v2 (precio_detectado, dia_descanso, modelo)
- Cálculo de mediana más robusto (usa mediana de los últimos 3 días para suavizar)
- Detección de outliers con IQR
- Mejor tasación de vehículos
- Histórico con múltiples métricas
- Validación cruzada de precios
=============================================================================
"""

import json
import pandas as pd
import numpy as np
import re
import os
import sys
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple

# --- IMPORTS ROBUSTEZ ---
from utils import safe_save_json, setup_logger, load_existing_or_default
from config import OUTPUT_FILES, LIMITS, VALIDATION

# --- LOGGER ---
logger = setup_logger('Licencia_Procesador_V2')

# =============================================================================
# CONFIGURACIÓN Y CONSTANTES
# =============================================================================
FILE_INPUT_RAW = 'licencias_totales.json'
FILE_HISTORY = 'public/history_stats.csv'
FILE_OUTPUT_WEB = 'public/web_feed.json'
FILE_OUTPUT_ANALYSIS = 'public/analisis_licencias_taxi.json'

# Precios Base de Vehículos (actualizados 2026)
PRECIOS_BASE = {
    # Eléctricos
    "TESLA MODEL 3": 42000,
    "TESLA MODEL Y": 48000,
    "TESLA": 40000,

    # Premium / PMR
    "MERCEDES CLASE V": 78000,
    "MERCEDES VITO": 73000,
    "VITO": 73000,
    "CLASE V": 78000,
    "MERCEDES": 48000,

    # Toyota (muy común)
    "TOYOTA CAMRY": 35000,
    "TOYOTA COROLLA": 28000,
    "TOYOTA PRIUS": 32000,
    "TOYOTA": 28000,

    # Otros
    "SKODA OCTAVIA": 28000,
    "SKODA": 26000,
    "DACIA JOGGER": 22000,
    "DACIA": 19000,
    "FORD CUSTOM": 34000,
    "FORD TRANSIT": 32000,
    "FORD": 24000,
    "VOLKSWAGEN CADDY": 34000,
    "VOLKSWAGEN": 30000,
    "FIAT TALENTO": 28000,
    "FIAT": 22000,
    "SEAT": 22000,
    "HYUNDAI": 26000,
    "KIA": 26000,
}
MODELOS_ORDENADOS = sorted(PRECIOS_BASE.keys(), key=len, reverse=True)

# =============================================================================
# FUNCIONES DE TASACIÓN
# =============================================================================

def tasar_coche(texto_raw: str, modelo_hint: Optional[str] = None) -> Tuple[int, str]:
    """
    Tasa el valor del vehículo incluido en la oferta.
    Usa modelo_hint si viene del scraper, sino lo extrae del texto.
    """
    texto = texto_raw.upper()

    # Sin coche = 0
    if "SIN COCHE" in texto or "SIN VEHICULO" in texto or "SIN VEHÍCULO" in texto:
        return 0, "SIN COCHE"

    # Determinar modelo
    modelo = modelo_hint or "DESCONOCIDO"
    valor_base = 10000

    if modelo == "DESCONOCIDO" or modelo not in PRECIOS_BASE:
        for key in MODELOS_ORDENADOS:
            if key in texto:
                modelo = key
                valor_base = PRECIOS_BASE[key]
                break
    else:
        valor_base = PRECIOS_BASE.get(modelo, 10000)

    # Antigüedad (años)
    anio_actual = datetime.now().year
    antiguedad = 4  # Default

    # Buscar año en el texto (2020-2026)
    match_anio = re.search(r'\b(202[0-6])\b', texto)
    if match_anio:
        antiguedad = anio_actual - int(match_anio.group(1))

    # Buscar "X años de antigüedad"
    match_anos = re.search(r'(\d+)\s*años?\s*(?:de\s*)?antig[üu]edad', texto, re.IGNORECASE)
    if match_anos:
        antiguedad = int(match_anos.group(1))

    # KMs
    kms = 0
    # Patrón: 150000km, 150.000km, 150000 km
    match_km = re.search(r'(\d{2,3})[\.,]?(\d{3})\s*(?:KM|KMS|KILOMETR)', texto)
    if match_km:
        kms = int(match_km.group(1) + match_km.group(2))

    # Fórmula de Depreciación
    # - Factor edad: 15% por año (0.85^años)
    # - Factor KM: -15% por cada 100k km
    factor_edad = 0.85 ** max(0, min(antiguedad, 10))  # Max 10 años
    factor_km = max(0.3, 1 - ((kms / 100000) * 0.15))

    valor_final = int(max(3000, valor_base * factor_edad * factor_km))

    return valor_final, modelo

def extraer_precio_fallback(raw: str) -> int:
    """Extrae precio del texto raw como fallback"""
    raw_clean = raw.replace('\n', ' ').upper()

    # Patrón 1: "Precio: X€"
    match = re.search(r'PRECIO:?\s*\|?\s*(\d{1,3}[\.,]?\d{3})', raw_clean)
    if match:
        return int(match.group(1).replace('.', '').replace(',', ''))

    # Patrón 2: "X€"
    match = re.search(r'(\d{1,3}[\.,]?\d{3})\s*€', raw_clean)
    if match:
        return int(match.group(1).replace('.', '').replace(',', ''))

    # Patrón 3: Número de 6 dígitos
    for match in re.finditer(r'(\d{6})', raw_clean.replace('.', '').replace(',', '')):
        val = int(match.group(1))
        if 50000 <= val <= 600000:
            contexto = raw_clean[max(0, match.start()-10):min(len(raw_clean), match.end()+10)]
            if "KM" not in contexto:
                return val

    return 0

def normalizar_dia_descanso(dia: Optional[str]) -> str:
    """Normaliza el día de descanso a formato estándar"""
    if not dia or dia == "NO ESPECIFICADO":
        return "NO ESPECIFICADO"

    dia = dia.upper().strip()

    # Normalizar acentos
    dia = dia.replace("MIÉRCOLES", "MIERCOLES")

    # Asegurar formato correcto
    dias_validos = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]

    for dia_valido in dias_validos:
        if dia_valido in dia:
            tipo = ""
            if "IMPAR" in dia:
                tipo = " IMPAR"
            elif "PAR" in dia and "IMPAR" not in dia:
                tipo = " PAR"
            return dia_valido + tipo

    return "NO ESPECIFICADO"

# =============================================================================
# DETECCIÓN DE OUTLIERS
# =============================================================================

def detectar_outliers_iqr(precios: List[int], factor: float = 1.5) -> Tuple[int, int]:
    """
    Detecta outliers usando el método IQR (Interquartile Range).
    Retorna los límites inferior y superior válidos.
    """
    if len(precios) < 4:
        return min(precios), max(precios)

    q1 = np.percentile(precios, 25)
    q3 = np.percentile(precios, 75)
    iqr = q3 - q1

    limite_inferior = max(50000, q1 - factor * iqr)
    limite_superior = min(600000, q3 + factor * iqr)

    return int(limite_inferior), int(limite_superior)

def filtrar_outliers(df: pd.DataFrame, columna: str = 'precio_neto') -> pd.DataFrame:
    """Filtra outliers del DataFrame usando IQR"""
    if len(df) < 4:
        return df

    limite_inf, limite_sup = detectar_outliers_iqr(df[columna].tolist())
    df_filtrado = df[(df[columna] >= limite_inf) & (df[columna] <= limite_sup)]

    logger.info(f"   Outliers: {len(df) - len(df_filtrado)} eliminados (rango: {limite_inf:,}€ - {limite_sup:,}€)")

    return df_filtrado

# =============================================================================
# CÁLCULOS ESTADÍSTICOS AVANZADOS
# =============================================================================

def calcular_precio_referencia(df: pd.DataFrame, history_df: pd.DataFrame) -> int:
    """
    Calcula precio de referencia robusto usando:
    - Mediana ponderada de últimos 3 días (si hay histórico)
    - Mediana actual como fallback
    """
    mediana_actual = int(df['precio_neto'].median())

    # Si tenemos histórico, ponderar con días anteriores
    if len(history_df) >= 3:
        ultimos_3 = history_df.tail(3)['median_price'].tolist()

        # Ponderación: hoy = 50%, ayer = 30%, anteayer = 20%
        if len(ultimos_3) == 3:
            precio_ponderado = int(
                mediana_actual * 0.5 +
                ultimos_3[-1] * 0.3 +
                ultimos_3[-2] * 0.2
            )
            return precio_ponderado

    return mediana_actual

def calcular_volatilidad(history_df: pd.DataFrame, ventana: int = 7) -> float:
    """Calcula volatilidad como desviación estándar % de los últimos N días"""
    if len(history_df) < ventana:
        return 0.0

    precios = history_df.tail(ventana)['median_price'].tolist()
    media = np.mean(precios)

    if media == 0:
        return 0.0

    std = np.std(precios)
    return round((std / media) * 100, 2)  # Porcentaje

def calcular_tendencia(history_df: pd.DataFrame, ventana: int = 7) -> float:
    """Calcula tendencia % de los últimos N días"""
    if len(history_df) < ventana:
        return 0.0

    precios = history_df.tail(ventana)['median_price'].tolist()

    if precios[0] == 0:
        return 0.0

    cambio = ((precios[-1] - precios[0]) / precios[0]) * 100
    return round(cambio, 2)

def calcular_soporte_resistencia(history_df: pd.DataFrame, ventana: int = 14) -> Tuple[int, int]:
    """Calcula niveles de soporte y resistencia basados en mínimos/máximos recientes"""
    if len(history_df) < 5:
        return 0, 0

    ultimos = history_df.tail(ventana)

    soporte = int(ultimos['min_price'].min())
    resistencia = int(ultimos['max_price'].max())

    return soporte, resistencia

# =============================================================================
# EJECUCIÓN PRINCIPAL
# =============================================================================

def main():
    logger.info("="*60)
    logger.info("🔄 PROCESADOR DE LICENCIAS V2 - Iniciando...")
    logger.info("="*60)

    # 1. Cargar Datos Crudos
    if not os.path.exists(FILE_INPUT_RAW):
        logger.error("❌ No hay datos nuevos. Archivo no encontrado.")
        return

    with open(FILE_INPUT_RAW, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    logger.info(f"📥 Cargados {len(raw_data)} registros del scraper")

    # 2. Procesar cada registro
    clean_items = []

    for item in raw_data:
        raw = item.get('raw', '')
        fuente = item.get('fuente', 'DESCONOCIDO')

        # Usar campos pre-extraídos si existen (scraper v2)
        precio = item.get('precio_detectado') or extraer_precio_fallback(raw)
        dia = normalizar_dia_descanso(item.get('dia_descanso'))
        modelo_hint = item.get('modelo_detectado')

        # Validar precio
        if not precio or precio < 50000 or precio > 600000:
            continue

        # Filtros anti-chatarra
        texto_lower = raw.lower()
        palabras_prohibidas = ['vtc', 'alquiler', 'renting', 'antigua', 'colección',
                               'conductor', 'uber', 'cabify']
        if any(p in texto_lower for p in palabras_prohibidas):
            continue

        # Tasar vehículo
        valor_coche, modelo = tasar_coche(raw, modelo_hint)

        clean_items.append({
            "id": abs(hash(raw)) % (10**9),  # ID numérico
            "fuente": fuente,
            "referencia": item.get('referencia', ''),
            "dia": dia,
            "modelo": modelo,
            "precio_total": precio,
            "valor_coche": valor_coche,
            "precio_neto": precio - valor_coche,
            "url": item.get('url'),
            "raw": raw[:150] + "..." if len(raw) > 150 else raw
        })

    df = pd.DataFrame(clean_items)

    if df.empty:
        logger.error("⚠️ No se generaron ofertas válidas.")
        return

    logger.info(f"✅ {len(df)} ofertas procesadas")

    # 3. Filtrar outliers
    df_original_len = len(df)
    df = filtrar_outliers(df, 'precio_neto')

    # 4. Cargar histórico
    history_df = pd.DataFrame()
    if os.path.exists(FILE_HISTORY):
        history_df = pd.read_csv(FILE_HISTORY)
        logger.info(f"📊 Histórico cargado: {len(history_df)} días")

    # 5. Calcular métricas del día
    today_date = datetime.now().strftime("%Y-%m-%d")

    precio_referencia = calcular_precio_referencia(df, history_df)

    today_stats = {
        "date": today_date,
        "avg_price": int(df['precio_neto'].mean()),
        "median_price": int(df['precio_neto'].median()),
        "reference_price": precio_referencia,
        "min_price": int(df['precio_neto'].min()),
        "max_price": int(df['precio_neto'].max()),
        "volume": len(df),
        "volatility_std": int(df['precio_neto'].std()) if len(df) > 1 else 0,
        "sources": df['fuente'].nunique()
    }

    # 6. Actualizar histórico
    os.makedirs(os.path.dirname(FILE_HISTORY), exist_ok=True)

    if not history_df.empty and today_date in history_df['date'].values:
        # Actualizar registro existente
        idx = history_df[history_df['date'] == today_date].index[0]
        for col, val in today_stats.items():
            if col in history_df.columns:
                history_df.loc[idx, col] = val
    else:
        # Añadir nuevo registro
        new_row = pd.DataFrame([today_stats])
        history_df = pd.concat([history_df, new_row], ignore_index=True)

    # Calcular SMAs
    history_df['sma_7'] = history_df['median_price'].rolling(window=7, min_periods=1).mean().fillna(0).astype(int)
    history_df['sma_14'] = history_df['median_price'].rolling(window=14, min_periods=1).mean().fillna(0).astype(int)
    history_df['sma_30'] = history_df['median_price'].rolling(window=30, min_periods=1).mean().fillna(0).astype(int)

    history_df.to_csv(FILE_HISTORY, index=False)
    logger.info(f"💾 Histórico actualizado: {FILE_HISTORY}")

    # 7. Calcular métricas financieras
    prev_price = precio_referencia
    if len(history_df) > 1:
        prev_price = int(history_df.iloc[-2]['median_price'])

    delta_abs = precio_referencia - prev_price
    delta_pct = round((delta_abs / prev_price) * 100, 2) if prev_price else 0

    volatilidad_7d = calcular_volatilidad(history_df, 7)
    tendencia_7d = calcular_tendencia(history_df, 7)
    tendencia_14d = calcular_tendencia(history_df, 14)
    soporte, resistencia = calcular_soporte_resistencia(history_df, 14)

    # 8. Estadísticas por día de descanso
    precio_por_dia = df.groupby('dia')['precio_neto'].median().astype(int).to_dict()

    # Mejor día para comprar
    mejor_dia = None
    if precio_por_dia:
        dias_validos = {k: v for k, v in precio_por_dia.items() if k != "NO ESPECIFICADO"}
        if dias_validos:
            mejor_dia = min(dias_validos.items(), key=lambda x: x[1])

    # Estadísticas por fuente
    stats_por_fuente = df.groupby('fuente').agg({
        'precio_neto': ['count', 'median', 'min', 'max']
    }).reset_index()
    stats_por_fuente.columns = ['fuente', 'ofertas', 'mediana', 'minimo', 'maximo']
    por_fuente_list = stats_por_fuente.to_dict('records')

    # 9. Top ofertas
    top_baratas = df.sort_values('precio_neto').head(5).to_dict('records')
    todas_ofertas = df.sort_values('precio_neto').to_dict('records')

    # 10. Generar JSON para web
    web_output = {
        "ticker": {
            "current_price": precio_referencia,
            "median_today": int(df['precio_neto'].median()),
            "delta_value": int(delta_abs),
            "delta_percent": float(delta_pct),
            "direction": "up" if delta_abs >= 0 else "down",
            "volume": len(df),
            "volatility": int(today_stats['volatility_std']),
            "volatility_7d_pct": volatilidad_7d,
            "tendencia_7d_pct": tendencia_7d,
            "tendencia_14d_pct": tendencia_14d,
            "soporte": soporte,
            "resistencia": resistencia,
            "sources_count": today_stats['sources']
        },
        "charts": {
            "history_dates": history_df['date'].tolist(),
            "history_prices": [int(x) for x in history_df['median_price'].tolist()],
            "history_sma_7": [int(x) for x in history_df['sma_7'].tolist()],
            "history_sma_14": [int(x) for x in history_df['sma_14'].tolist()],
            "history_sma_30": [int(x) for x in history_df['sma_30'].tolist()],
            "price_by_day_descanso": precio_por_dia
        },
        "market_depth": {
            "cheapest_offers": top_baratas,
            "all_offers": todas_ofertas
        },
        "analysis": {
            "mejor_dia_comprar": {
                "dia": mejor_dia[0] if mejor_dia else None,
                "precio_mediano": mejor_dia[1] if mejor_dia else None
            },
            "por_fuente": por_fuente_list,
            "outliers_eliminados": df_original_len - len(df)
        },
        "updated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "version": "2.0"
    }

    # 11. Guardar web_feed.json
    success, message = safe_save_json(
        filepath=FILE_OUTPUT_WEB,
        data=web_output,
        data_type='web_feed',
        backup=True
    )

    if success:
        logger.info(f"✅ Web feed guardado: {FILE_OUTPUT_WEB}")
    else:
        logger.error(f"❌ Error guardando web feed: {message}")
        sys.exit(1)

    # 12. Generar análisis detallado
    analysis_output = {
        "fecha_generacion": datetime.now().isoformat(),
        "resumen": {
            "precio_mercado": precio_referencia,
            "mediana_hoy": int(df['precio_neto'].median()),
            "volumen": len(df),
            "fuentes_activas": today_stats['sources'],
            "tendencia_7d": f"{tendencia_7d:+.1f}%",
            "volatilidad_7d": f"{volatilidad_7d:.1f}%"
        },
        "ofertas_destacadas": top_baratas[:3],
        "estadisticas_dia_descanso": [
            {"dia": k, "precio_mediano": v, "es_mejor": (mejor_dia and k == mejor_dia[0])}
            for k, v in sorted(precio_por_dia.items(), key=lambda x: x[1])
        ],
        "estadisticas_fuente": por_fuente_list,
        "todas_ofertas": todas_ofertas
    }

    with open(FILE_OUTPUT_ANALYSIS, 'w', encoding='utf-8') as f:
        json.dump(analysis_output, f, ensure_ascii=False, indent=2)
    logger.info(f"✅ Análisis guardado: {FILE_OUTPUT_ANALYSIS}")

    # 13. Resumen final
    logger.info("="*60)
    logger.info("📊 RESUMEN")
    logger.info("="*60)
    logger.info(f"   Precio de referencia: {precio_referencia:,}€")
    logger.info(f"   Cambio: {delta_abs:+,}€ ({delta_pct:+.2f}%)")
    logger.info(f"   Volumen: {len(df)} ofertas de {today_stats['sources']} fuentes")
    logger.info(f"   Tendencia 7D: {tendencia_7d:+.1f}%")
    logger.info(f"   Volatilidad 7D: {volatilidad_7d:.1f}%")
    if mejor_dia:
        logger.info(f"   Mejor día: {mejor_dia[0]} ({mejor_dia[1]:,}€)")
    logger.info("="*60)

if __name__ == "__main__":
    main()
