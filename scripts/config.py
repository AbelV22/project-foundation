"""
=============================================================================
CONFIG - Configuración centralizada del pipeline de datos
=============================================================================
"""

import os
from pathlib import Path

# =============================================================================
# RUTAS BASE
# =============================================================================
# Directorio raíz del proyecto (un nivel arriba de scripts/)
PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
PUBLIC_DIR = PROJECT_ROOT / 'public'

# =============================================================================
# ARCHIVOS DE OUTPUT
# =============================================================================
OUTPUT_FILES = {
    # Vuelos AENA (scraper)
    'vuelos_aena': PUBLIC_DIR / 'vuelos.json',

    # Trenes ADIF (scraper)
    'trenes_sants': PUBLIC_DIR / 'trenes_sants.json',

    # Cruceros Port de Barcelona (scraper)
    'cruceros': PUBLIC_DIR / 'cruceros.json',

    # Licencias (scraper raw)
    'licencias_raw': PROJECT_ROOT / 'licencias_totales.json',

    # Licencias (procesado)
    'licencias_history': PUBLIC_DIR / 'history_stats.csv',
    'licencias_web_feed': PUBLIC_DIR / 'web_feed.json',

    # API Vuelos (update_data)
    'data_api': PUBLIC_DIR / 'data.json',
}

# =============================================================================
# APIs Y ENDPOINTS
# =============================================================================
URLS = {
    'adif': 'https://www.adif.es/w/71801-barcelona-sants?pageFromPlid=335',
    'aena': 'https://www.aena.es/es/infovuelos.html',
    'aviation_api': 'http://api.aviationstack.com/v1/flights',
    # Port de Barcelona Open Data - Cruceros
    'cruceros_llegadas': 'https://opendata.portdebarcelona.cat/dataset/342fe09b-017b-4019-a743-ee773f09befd/resource/72f0fc9e-b4b4-4a61-a0fb-e7b65b601b4d/download/arribadesavui.csv',
    'cruceros_salidas': 'https://opendata.portdebarcelona.cat/dataset/342fe09b-017b-4019-a743-ee773f09befd/resource/4bf1ccd0-5132-4d54-81d4-1ab72d5542e9/download/sortidesavui.csv',
}

# =============================================================================
# TIMEOUTS Y LÍMITES
# =============================================================================
TIMEOUTS = {
    'page_load': 20,        # Segundos para cargar página
    'element_wait': 10,     # Segundos para esperar elemento
    'api_request': 60,      # Segundos para requests API
    'scroll_wait': 1.5,     # Segundos entre scrolls
    'click_wait': 3.0,      # Segundos después de click
}

LIMITS = {
    'max_retries': 3,           # Reintentos máximos
    'max_api_pages': 10,        # Páginas máximas de API
    'min_flights_valid': 10,    # Mínimo vuelos para considerar válido
    'min_trains_valid': 5,      # Mínimo trenes para considerar válido
    'min_licenses_valid': 3,    # Mínimo licencias para considerar válido
    'min_cruises_valid': 0,     # Puede haber días sin cruceros
}

# =============================================================================
# VALIDACIÓN
# =============================================================================
VALIDATION = {
    # Porcentaje mínimo respecto a datos anteriores para no alertar
    'min_ratio_vs_previous': 0.5,  # 50%
    
    # Rango de precios válidos para licencias
    'license_price_min': 50000,
    'license_price_max': 600000,
    
    # Whitelist de trenes válidos
    'train_whitelist': [
        "AVE", "AVLO", "OUIGO", "IRYO", "ALVIA", 
        "EUROMED", "INTERCITY", "TGV", "LD", "MD", "AVANT"
    ],
}

# =============================================================================
# API KEYS (desde variables de entorno)
# =============================================================================
def get_api_key(name: str) -> str:
    """Obtiene API key de variable de entorno."""
    key = os.environ.get(name)
    if not key:
        raise ValueError(f"Variable de entorno {name} no configurada")
    return key

# Funciones de conveniencia
def get_aviation_api_key() -> str:
    return get_api_key('API_KEY')

def get_scraper_api_key() -> str:
    return get_api_key('SCRAPER_API_KEY')

# =============================================================================
# LOGGING
# =============================================================================
LOGGING = {
    'log_dir': SCRIPTS_DIR / 'logs',
    'log_format': '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
    'date_format': '%Y-%m-%d %H:%M:%S',
}
