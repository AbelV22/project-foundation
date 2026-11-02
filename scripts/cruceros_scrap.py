"""
=============================================================================
CRUCEROS SCRAPER - Barcelona Port Cruise Arrivals/Departures
=============================================================================
Fuente: Open Data Port de Barcelona
API: https://opendata.portdebarcelona.cat
Frecuencia: Cada hora
"""

import sys
import os
import requests
import csv
from io import StringIO
from datetime import datetime
from typing import List, Dict, Optional

# --- IMPORTS ROBUSTEZ ---
from utils import safe_save_json, setup_logger
from config import OUTPUT_FILES, LIMITS, URLS, TIMEOUTS

# --- LOGGER ---
logger = setup_logger('Cruceros_Scraper')

# =============================================================================
# CONSTANTS
# =============================================================================
# Tipos de barco que nos interesan, tal como los publica el Port (VAIXELLTIPUS,
# en catalán). El resto (Portacontenidors, Tancs, Car-carrier, Ro-Ro...) son
# mercancías y no traen pasajeros.
PASSENGER_TYPES = {
    "PASSATGE": "crucero",
    "TRANSBORDADORS": "ferry",
}

# Terminales de cruceros en Barcelona
CRUISE_TERMINALS = {
    "A": "Terminal A (WTC)",
    "B": "Terminal B (Maremagnum)",
    "C": "Terminal C (Sant Bertran)",
    "D": "Terminal D (Adossat)",
    "E": "Terminal E (Adossat)",
    "F": "Terminal F (Adossat)",
    "N": "Terminal Nord",
    "S": "Terminal Sud",
}

# Capacidades estimadas de pasajeros por eslora (metros)
def estimate_passengers(eslora: float) -> int:
    """Estima pasajeros basado en eslora del barco."""
    if eslora >= 350:  # Mega cruceros (Oasis, MSC World)
        return 6500
    elif eslora >= 300:  # Grandes cruceros
        return 4500
    elif eslora >= 250:  # Cruceros medianos-grandes
        return 3000
    elif eslora >= 200:  # Cruceros medianos
        return 2000
    elif eslora >= 150:  # Cruceros pequeños / ferries grandes
        return 1000
    else:  # Ferries pequeños
        return 500

# =============================================================================
# DATA FETCHING
# =============================================================================
def fetch_csv_data(url: str) -> Optional[List[Dict]]:
    """
    Descarga y parsea CSV desde la API del Port de Barcelona.
    """
    try:
        response = requests.get(url, timeout=TIMEOUTS.get('api_request', 60))
        response.raise_for_status()
        response.encoding = 'utf-8'

        reader = csv.DictReader(StringIO(response.text))
        return list(reader)
    except requests.RequestException as e:
        logger.error(f"Error fetching {url}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error parsing CSV: {e}")
        return None

def parse_metres(value) -> float:
    """El Port publica las medidas con coma decimal ("293,95")."""
    try:
        return float(str(value or 0).replace(',', '.'))
    except ValueError:
        return 0.0

def vessel_class(row: Dict) -> Optional[str]:
    """
    'crucero' o 'ferry' según VAIXELLTIPUS; None para barcos de mercancías.
    Clasificar por nombre o eslora colaba portacontenedores (MSC...) y
    car-carriers (Grimaldi) como cruceros.
    """
    vessel_type = (row.get('VAIXELLTIPUS') or '').strip().upper()
    return PASSENGER_TYPES.get(vessel_type)

def is_cruise_or_ferry(row: Dict) -> bool:
    """Determina si el barco es un crucero o ferry de pasajeros."""
    return vessel_class(row) is not None

def parse_cruise_row(row: Dict, is_arrival: bool = True) -> Dict:
    """
    Parsea una fila del CSV a nuestro formato de crucero.
    """
    # Extraer hora
    if is_arrival:
        hora = row.get('ETAHORA', '00:00')
        fecha = row.get('ETADIA', '')
    else:
        hora = row.get('ETDHORA', '00:00')
        fecha = row.get('ETDDIA', '')

    # Limpiar hora
    if hora:
        hora = hora[:5] if len(hora) >= 5 else hora

    # Extraer eslora y estimar pasajeros
    eslora = parse_metres(row.get('ESLORA_METRES'))

    pax = estimate_passengers(eslora)

    # Terminal
    terminal_code = row.get('TERMINALCODI', '')
    terminal_name = CRUISE_TERMINALS.get(terminal_code, row.get('TERMINALNOM', 'N/A'))

    # Origen/Destino
    if is_arrival:
        puerto = row.get('PORTORIGENNOM', row.get('PORTORIGENCODI', 'N/A'))
    else:
        puerto = row.get('PORTDESTINOM', row.get('PORTDESTICODI', 'N/A'))

    # Limpiar nombre del barco
    nombre = row.get('VAIXELLNOM', 'N/A')
    if nombre:
        nombre = nombre.title()

    return {
        "hora": hora,
        "nombre": nombre,
        "naviera": row.get('NAVIERA', row.get('CONSIGNATARI', 'N/A')),
        "terminal": terminal_name,
        "terminal_codigo": terminal_code,
        "eslora": eslora,
        "pax_estimados": pax,
        "puerto": puerto,
        "tipo": "llegada" if is_arrival else "salida",
        "clase": vessel_class(row),
        "estado": row.get('ESCALAESTAT', 'Programado'),
        "bandera": row.get('VAIXELLBANDERANOM', 'N/A'),
        "imo": row.get('IMO', ''),
        "mmsi": row.get('MMSI', ''),
        "fecha": fecha,
    }

# =============================================================================
# MAIN SCRAPER
# =============================================================================
def obtener_cruceros() -> Dict:
    """
    Obtiene todos los cruceros del día desde el Open Data del Port de Barcelona.

    Returns:
        Dict con llegadas, salidas, resumen y metadata
    """
    logger.info("🚢 Iniciando scraping de cruceros...")

    # URLs del Open Data
    url_arrivals = URLS.get('cruceros_llegadas',
        'https://opendata.portdebarcelona.cat/dataset/342fe09b-017b-4019-a743-ee773f09befd/resource/72f0fc9e-b4b4-4a61-a0fb-e7b65b601b4d/download/arribadesavui.csv')
    url_departures = URLS.get('cruceros_salidas',
        'https://opendata.portdebarcelona.cat/dataset/342fe09b-017b-4019-a743-ee773f09befd/resource/4bf1ccd0-5132-4d54-81d4-1ab72d5542e9/download/sortidesavui.csv')

    llegadas = []
    salidas = []

    # Fetch arrivals
    logger.info("📥 Descargando llegadas...")
    arrivals_data = fetch_csv_data(url_arrivals)
    if arrivals_data:
        for row in arrivals_data:
            if is_cruise_or_ferry(row):
                cruise = parse_cruise_row(row, is_arrival=True)
                llegadas.append(cruise)
        logger.info(f"   ✅ {len(llegadas)} cruceros/ferries en llegadas")
    else:
        logger.warning("   ⚠️ No se pudieron obtener llegadas")

    # Fetch departures
    logger.info("📤 Descargando salidas...")
    departures_data = fetch_csv_data(url_departures)
    if departures_data:
        for row in departures_data:
            if is_cruise_or_ferry(row):
                cruise = parse_cruise_row(row, is_arrival=False)
                salidas.append(cruise)
        logger.info(f"   ✅ {len(salidas)} cruceros/ferries en salidas")
    else:
        logger.warning("   ⚠️ No se pudieron obtener salidas")

    # Ordenar por hora
    llegadas.sort(key=lambda x: x['hora'])
    salidas.sort(key=lambda x: x['hora'])

    # Calcular estadísticas
    total_cruceros = len(set(c['nombre'] for c in llegadas + salidas))
    total_pax = sum(c['pax_estimados'] for c in llegadas)

    # Próximo desembarco (llegada más cercana que aún no ha pasado)
    now = datetime.now()
    now_minutes = now.hour * 60 + now.minute

    proximo_desembarco = None
    for llegada in llegadas:
        try:
            h, m = llegada['hora'].split(':')
            llegada_minutes = int(h) * 60 + int(m)
            if llegada_minutes >= now_minutes:
                proximo_desembarco = llegada
                break
        except:
            continue

    # Construir resultado
    result = {
        "llegadas": llegadas,
        "salidas": salidas,
        "resumen": {
            "total_cruceros": total_cruceros,
            "total_llegadas": len(llegadas),
            "total_salidas": len(salidas),
            "pax_estimados_hoy": total_pax,
            "proximo_desembarco": proximo_desembarco['hora'] if proximo_desembarco else None,
            "proximo_barco": proximo_desembarco['nombre'] if proximo_desembarco else None,
        },
        "terminales_activas": list(set(
            c['terminal_codigo'] for c in llegadas + salidas if c['terminal_codigo']
        )),
        "metadata": {
            "fuente": "Open Data Port de Barcelona",
            "actualizado": datetime.now().isoformat(),
            "frecuencia": "horaria",
        }
    }

    return result

# =============================================================================
# EJECUCIÓN
# =============================================================================
if __name__ == "__main__":
    cruceros_data = obtener_cruceros()

    if cruceros_data and (cruceros_data['llegadas'] or cruceros_data['salidas']):
        # Usar safe_save_json para validar antes de sobrescribir
        archivo = str(OUTPUT_FILES.get('cruceros', 'public/cruceros.json'))

        success, message = safe_save_json(
            filepath=archivo,
            data=cruceros_data,
            data_type='cruises',
            min_items=0,  # Puede haber días sin cruceros
            backup=True
        )

        if success:
            logger.info(f"💾 {message}")
            logger.info(f"📊 Resumen: {cruceros_data['resumen']['total_cruceros']} cruceros, "
                       f"~{cruceros_data['resumen']['pax_estimados_hoy']:,} pasajeros estimados")
        else:
            logger.error(message)
            sys.exit(1)
    else:
        logger.warning("⚠️ No se encontraron datos de cruceros.")
        # Aún así guardar estructura vacía
        empty_data = {
            "llegadas": [],
            "salidas": [],
            "resumen": {
                "total_cruceros": 0,
                "total_llegadas": 0,
                "total_salidas": 0,
                "pax_estimados_hoy": 0,
                "proximo_desembarco": None,
                "proximo_barco": None,
            },
            "terminales_activas": [],
            "metadata": {
                "fuente": "Open Data Port de Barcelona",
                "actualizado": datetime.now().isoformat(),
                "frecuencia": "horaria",
            }
        }
        archivo = str(OUTPUT_FILES.get('cruceros', 'public/cruceros.json'))
        safe_save_json(filepath=archivo, data=empty_data, data_type='generic', backup=False)
