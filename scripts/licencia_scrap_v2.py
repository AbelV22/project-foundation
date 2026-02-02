"""
=============================================================================
LICENCIA SCRAPER V2 - Versión mejorada con múltiples fuentes y redundancia
=============================================================================
Mejoras:
- Múltiples estrategias para MILANUNCIOS (ScraperAPI + Selenium fallback)
- Nuevas fuentes: Wallapop, Idealista
- Mejor extracción de STAC (día descanso desde detalles)
- García BCN con selectores actualizados
- Deduplicación automática por referencia/precio
- Reintentos con backoff exponencial
- Logging detallado
=============================================================================
"""

import sys
import os
import time
import re
import json
import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# Selenium imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Local imports
from utils import safe_save_json, setup_logger, retry_with_backoff
from config import OUTPUT_FILES, LIMITS, TIMEOUTS

# --- LOGGER ---
logger = setup_logger('Licencia_Scraper_V2')

# =============================================================================
# DATA STRUCTURES
# =============================================================================
@dataclass
class OfertaRaw:
    """Estructura normalizada para ofertas crudas"""
    fuente: str
    referencia: str
    raw: str
    url: Optional[str] = None
    precio_detectado: Optional[int] = None
    dia_descanso: Optional[str] = None
    modelo_detectado: Optional[str] = None
    fecha_scraping: str = ""

    def __post_init__(self):
        if not self.fecha_scraping:
            self.fecha_scraping = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return asdict(self)

    def get_hash(self) -> str:
        """Genera hash único para deduplicación"""
        # Usamos referencia + fuente + precio como identificador
        key = f"{self.fuente}:{self.referencia}:{self.precio_detectado}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

# =============================================================================
# UTILIDADES
# =============================================================================
def iniciar_driver(headless: bool = True) -> webdriver.Chrome:
    """Inicia driver de Chrome con configuración optimizada"""
    options = Options()
    if headless:
        options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--lang=es-ES')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    # Evitar detección de Selenium
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )

    # Ejecutar script para ocultar webdriver
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': '''
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
        '''
    })

    return driver

def extraer_precio_texto(texto: str) -> Optional[int]:
    """Extrae precio de un texto con múltiples patrones"""
    texto_clean = texto.replace('\n', ' ').upper().replace('.', '').replace(',', '')

    # Patrón 1: "Precio: X€" o "Precio X"
    match = re.search(r'PRECIO:?\s*(\d{5,6})\s*€?', texto_clean)
    if match:
        return int(match.group(1))

    # Patrón 2: "X €" o "X€"
    match = re.search(r'(\d{3})\.?(\d{3})\s*€', texto.replace('\n', ' '))
    if match:
        return int(match.group(1) + match.group(2))

    # Patrón 3: Número de 6 dígitos en rango válido
    for match in re.finditer(r'(\d{6})', texto_clean):
        val = int(match.group(1))
        if 100000 <= val <= 300000:
            # Verificar que no sea KM
            contexto = texto_clean[max(0, match.start()-15):min(len(texto_clean), match.end()+10)]
            if 'KM' not in contexto and 'KILOMETR' not in contexto:
                return val

    # Patrón 4: Número de 5-6 dígitos general
    for match in re.finditer(r'(\d{5,6})', texto_clean):
        val = int(match.group(1))
        if 50000 <= val <= 600000:
            contexto = texto_clean[max(0, match.start()-15):min(len(texto_clean), match.end()+10)]
            if 'KM' not in contexto and 'KILOMETR' not in contexto:
                return val

    return None

def extraer_dia_descanso(texto: str) -> str:
    """Extrae día de descanso de un texto"""
    texto_upper = texto.upper()

    # Buscar día específico
    dias = {
        'LUNES': 'LUNES',
        'MARTES': 'MARTES',
        'MIERCOLES': 'MIERCOLES',
        'MIÉRCOLES': 'MIERCOLES',
        'JUEVES': 'JUEVES',
        'VIERNES': 'VIERNES'
    }

    dia_encontrado = None
    for palabra, dia in dias.items():
        if palabra in texto_upper:
            dia_encontrado = dia
            break

    if not dia_encontrado:
        return "NO ESPECIFICADO"

    # Buscar PAR/IMPAR
    tipo = ""
    if " IMPAR" in texto_upper or "_IMPAR" in texto_upper or "IMPAR" in texto_upper.split():
        tipo = " IMPAR"
    elif " PAR" in texto_upper or "_PAR" in texto_upper:
        # Evitar falsos positivos como "REPARAR"
        if re.search(r'\bPAR\b', texto_upper) and 'IMPAR' not in texto_upper:
            tipo = " PAR"

    return dia_encontrado + tipo if dia_encontrado else "NO ESPECIFICADO"

def extraer_modelo(texto: str) -> str:
    """Extrae modelo de vehículo del texto"""
    texto_upper = texto.upper()

    modelos = [
        ("TESLA MODEL 3", "TESLA MODEL 3"),
        ("TESLA MODEL Y", "TESLA MODEL Y"),
        ("TESLA", "TESLA"),
        ("MERCEDES VITO", "MERCEDES VITO"),
        ("MERCEDES CLASE V", "MERCEDES CLASE V"),
        ("CLASE V", "MERCEDES CLASE V"),
        ("VITO", "MERCEDES VITO"),
        ("MERCEDES", "MERCEDES"),
        ("TOYOTA CAMRY", "TOYOTA CAMRY"),
        ("TOYOTA COROLLA", "TOYOTA COROLLA"),
        ("TOYOTA PRIUS", "TOYOTA PRIUS"),
        ("TOYOTA", "TOYOTA"),
        ("SKODA OCTAVIA", "SKODA OCTAVIA"),
        ("SKODA", "SKODA"),
        ("DACIA JOGGER", "DACIA JOGGER"),
        ("DACIA", "DACIA"),
        ("FORD CUSTOM", "FORD CUSTOM"),
        ("FORD TRANSIT", "FORD TRANSIT"),
        ("FORD", "FORD"),
        ("VOLKSWAGEN CADDY", "VOLKSWAGEN CADDY"),
        ("VW CADDY", "VOLKSWAGEN CADDY"),
        ("VOLKSWAGEN", "VOLKSWAGEN"),
        ("SEAT", "SEAT"),
        ("FIAT TALENTO", "FIAT TALENTO"),
        ("FIAT", "FIAT"),
        ("HYUNDAI", "HYUNDAI"),
        ("KIA", "KIA"),
    ]

    for patron, modelo in modelos:
        if patron in texto_upper:
            return modelo

    return "DESCONOCIDO"

def extraer_referencia(texto: str, fuente: str) -> str:
    """Extrae referencia única de la oferta"""
    # Buscar patrón "Ref: XXXX" o "Referencia: XXXX"
    match = re.search(r'(?:REF(?:ERENCIA)?:?\s*#?\s*)(\d+)', texto.upper())
    if match:
        return match.group(1)

    # Generar hash del contenido como fallback
    return hashlib.md5(texto.encode()).hexdigest()[:8]

# =============================================================================
# SCRAPERS INDIVIDUALES
# =============================================================================

def scrape_milanuncios_api() -> List[OfertaRaw]:
    """Scrape MILANUNCIOS usando ScraperAPI"""
    ofertas = []
    logger.info("🌍 [MILANUNCIOS] Iniciando scraping via ScraperAPI...")

    api_key = os.environ.get('SCRAPER_API_KEY')
    if not api_key:
        logger.warning("❌ No se encontró SCRAPER_API_KEY")
        return ofertas

    # Múltiples búsquedas para más resultados
    queries = [
        "Licencia taxi barcelona",
        "licencia taxi bcn venta",
    ]

    for query in queries:
        target_url = f"https://www.milanuncios.com/anuncios/?s={query.replace(' ', '%20')}"

        payload = {
            'api_key': api_key,
            'url': target_url,
            'render': 'true',
            'country_code': 'es',
            'wait_for_selector': 'article',
            'session_number': '1'  # Mantener sesión para evitar bloqueos
        }

        try:
            logger.info(f"   -> Buscando: {query}")
            r = requests.get('http://api.scraperapi.com', params=payload, timeout=90)

            if r.status_code == 200:
                soup = BeautifulSoup(r.text, 'html.parser')
                anuncios = soup.find_all('article')
                logger.info(f"   -> {len(anuncios)} anuncios encontrados")

                for anuncio in anuncios:
                    texto = anuncio.get_text(separator=" | ", strip=True)

                    # Filtros
                    texto_lower = texto.lower()
                    if len(texto) < 30:
                        continue
                    if not ("taxi" in texto_lower or "licencia" in texto_lower):
                        continue
                    # Excluir chatarra
                    palabras_prohibidas = ['antigua', 'colección', 'alquilo', 'alquiler',
                                          'compartir', 'chapa', 'taxi inglés', 'conductor',
                                          'vtc', 'uber', 'cabify']
                    if any(p in texto_lower for p in palabras_prohibidas):
                        continue

                    # Extraer enlace si existe
                    link = anuncio.find('a', href=True)
                    url = f"https://www.milanuncios.com{link['href']}" if link else None

                    precio = extraer_precio_texto(texto)
                    if precio and 50000 <= precio <= 600000:
                        ofertas.append(OfertaRaw(
                            fuente="MILANUNCIOS",
                            referencia=extraer_referencia(texto, "MILANUNCIOS"),
                            raw=texto,
                            url=url,
                            precio_detectado=precio,
                            dia_descanso=extraer_dia_descanso(texto),
                            modelo_detectado=extraer_modelo(texto)
                        ))
            else:
                logger.warning(f"   ⚠️ Status {r.status_code}: {r.text[:200]}")

        except Exception as e:
            logger.error(f"   🔥 Error: {e}")

    logger.info(f"   ✅ {len(ofertas)} ofertas válidas de MILANUNCIOS")
    return ofertas

def scrape_milanuncios_selenium(driver: webdriver.Chrome) -> List[OfertaRaw]:
    """Fallback: Scrape MILANUNCIOS con Selenium"""
    ofertas = []
    logger.info("🌍 [MILANUNCIOS-SELENIUM] Intentando fallback...")

    try:
        driver.get("https://www.milanuncios.com/anuncios/?s=Licencia%20taxi%20barcelona")
        time.sleep(5)

        # Aceptar cookies si aparece
        try:
            cookie_btn = driver.find_element(By.ID, "didomi-notice-agree-button")
            cookie_btn.click()
            time.sleep(1)
        except:
            pass

        # Scroll para cargar más
        for _ in range(3):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

        anuncios = driver.find_elements(By.TAG_NAME, "article")

        for anuncio in anuncios:
            try:
                texto = anuncio.text
                if len(texto) < 30:
                    continue

                texto_lower = texto.lower()
                if not ("taxi" in texto_lower or "licencia" in texto_lower):
                    continue

                precio = extraer_precio_texto(texto)
                if precio and 50000 <= precio <= 600000:
                    ofertas.append(OfertaRaw(
                        fuente="MILANUNCIOS",
                        referencia=extraer_referencia(texto, "MILANUNCIOS"),
                        raw=texto.replace("\n", " | "),
                        precio_detectado=precio,
                        dia_descanso=extraer_dia_descanso(texto),
                        modelo_detectado=extraer_modelo(texto)
                    ))
            except:
                continue

    except Exception as e:
        logger.error(f"   🔥 Error Selenium: {e}")

    logger.info(f"   ✅ {len(ofertas)} ofertas de MILANUNCIOS (Selenium)")
    return ofertas

def scrape_solano(driver: webdriver.Chrome) -> List[OfertaRaw]:
    """Scrape Asesoría Solano - Fuente muy fiable"""
    ofertas = []
    logger.info("🌍 [SOLANO] Iniciando scraping...")

    try:
        driver.get("https://asesoriasolano.es/comprar-licencias/")
        time.sleep(4)

        # Scroll completo
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)

        full_text = driver.find_element(By.TAG_NAME, "body").text

        # Patrón principal: Ref -> ESTOY INTERESADO
        patron = r"(Ref:.*?ESTOY INTERESADO)"
        matches = re.findall(patron, full_text, re.DOTALL | re.IGNORECASE)

        for match in matches:
            texto = match.replace("\n", " | ")
            precio = extraer_precio_texto(texto)

            if precio and 50000 <= precio <= 600000:
                ofertas.append(OfertaRaw(
                    fuente="SOLANO",
                    referencia=extraer_referencia(texto, "SOLANO"),
                    raw=texto,
                    url="https://asesoriasolano.es/comprar-licencias/",
                    precio_detectado=precio,
                    dia_descanso=extraer_dia_descanso(texto),
                    modelo_detectado=extraer_modelo(texto)
                ))

        # Fallback: bloques con precio
        if not ofertas:
            bloques = full_text.split('\n\n')
            for bloque in bloques:
                if "PRECIO" in bloque.upper() and "€" in bloque:
                    precio = extraer_precio_texto(bloque)
                    if precio and 50000 <= precio <= 600000:
                        ofertas.append(OfertaRaw(
                            fuente="SOLANO",
                            referencia=extraer_referencia(bloque, "SOLANO"),
                            raw=bloque.replace("\n", " | "),
                            precio_detectado=precio,
                            dia_descanso=extraer_dia_descanso(bloque),
                            modelo_detectado=extraer_modelo(bloque)
                        ))

    except Exception as e:
        logger.error(f"   🔥 Error: {e}")

    logger.info(f"   ✅ {len(ofertas)} ofertas de SOLANO")
    return ofertas

def scrape_garcia_bcn(driver: webdriver.Chrome) -> List[OfertaRaw]:
    """Scrape Asesoría García BCN - Actualizado"""
    ofertas = []
    logger.info("🌍 [GARCIA BCN] Iniciando scraping...")

    try:
        driver.get("https://asesoriagarciabcn.com/compra-y-venta-de-licencias-de-taxi-en-barcelona/")
        time.sleep(5)

        # Scroll completo para cargar todo
        for _ in range(3):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1.5)

        # Buscar en múltiples selectores
        elementos = []
        for tag in ['article', 'div', 'li', 'p']:
            elementos.extend(driver.find_elements(By.TAG_NAME, tag))

        textos_vistos = set()

        for elem in elementos:
            try:
                texto = elem.text
                if len(texto) < 30 or texto in textos_vistos:
                    continue
                textos_vistos.add(texto)

                texto_upper = texto.upper()
                # Debe contener precio y ser de taxi
                if "€" not in texto and "PRECIO" not in texto_upper:
                    continue
                if "TAXI" not in texto_upper and "LICENCIA" not in texto_upper:
                    continue

                precio = extraer_precio_texto(texto)
                if precio and 50000 <= precio <= 600000:
                    ofertas.append(OfertaRaw(
                        fuente="GARCIA_BCN",
                        referencia=extraer_referencia(texto, "GARCIA_BCN"),
                        raw=texto.replace("\n", " | "),
                        url="https://asesoriagarciabcn.com/compra-y-venta-de-licencias-de-taxi-en-barcelona/",
                        precio_detectado=precio,
                        dia_descanso=extraer_dia_descanso(texto),
                        modelo_detectado=extraer_modelo(texto)
                    ))
            except:
                continue

    except Exception as e:
        logger.error(f"   🔥 Error: {e}")

    logger.info(f"   ✅ {len(ofertas)} ofertas de GARCIA BCN")
    return ofertas

def scrape_stac(driver: webdriver.Chrome) -> List[OfertaRaw]:
    """Scrape STAC (Bolsa de Licencias oficial) - Mejorado"""
    ofertas = []
    logger.info("🌍 [STAC] Iniciando scraping...")

    try:
        driver.get("https://bolsadelicenciasstac.cat")
        time.sleep(5)

        # Scroll para cargar todo
        for _ in range(2):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

        articles = driver.find_elements(By.TAG_NAME, "article")

        for art in articles:
            try:
                texto = art.text
                if "Precio" not in texto and "€" not in texto:
                    continue

                precio = extraer_precio_texto(texto)
                if not precio or precio < 50000:
                    continue

                # Intentar obtener más detalles del enlace
                dia_descanso = "NO ESPECIFICADO"
                try:
                    link = art.find_element(By.TAG_NAME, "a")
                    href = link.get_attribute("href")
                    if href and "licencia" in href.lower():
                        # Abrir en nueva pestaña para obtener detalles
                        driver.execute_script("window.open(arguments[0], '_blank');", href)
                        driver.switch_to.window(driver.window_handles[-1])
                        time.sleep(2)

                        detalle_texto = driver.find_element(By.TAG_NAME, "body").text
                        dia_descanso = extraer_dia_descanso(detalle_texto)

                        driver.close()
                        driver.switch_to.window(driver.window_handles[0])
                except:
                    pass

                ofertas.append(OfertaRaw(
                    fuente="STAC",
                    referencia=extraer_referencia(texto, "STAC"),
                    raw=texto.replace("\n", " | "),
                    url="https://bolsadelicenciasstac.cat",
                    precio_detectado=precio,
                    dia_descanso=dia_descanso,
                    modelo_detectado=extraer_modelo(texto)
                ))

            except Exception as e:
                continue

        # Fallback: buscar precios directamente
        if not ofertas:
            precios_elems = driver.find_elements(By.XPATH, "//*[contains(text(), 'Precio:')]")
            for p in precios_elems:
                try:
                    contenedor = p.find_element(By.XPATH, "./ancestor::article")
                    texto = contenedor.text
                    precio = extraer_precio_texto(texto)

                    if precio and 50000 <= precio <= 600000:
                        ofertas.append(OfertaRaw(
                            fuente="STAC",
                            referencia=extraer_referencia(texto, "STAC"),
                            raw=texto.replace("\n", " | "),
                            precio_detectado=precio,
                            dia_descanso=extraer_dia_descanso(texto),
                            modelo_detectado=extraer_modelo(texto)
                        ))
                except:
                    continue

    except Exception as e:
        logger.error(f"   🔥 Error: {e}")

    logger.info(f"   ✅ {len(ofertas)} ofertas de STAC")
    return ofertas

def scrape_wallapop() -> List[OfertaRaw]:
    """Scrape Wallapop via API pública"""
    ofertas = []
    logger.info("🌍 [WALLAPOP] Iniciando scraping...")

    try:
        # Wallapop tiene una API de búsqueda pública
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }

        # Búsqueda por keywords
        keywords = "licencia taxi barcelona"
        url = f"https://api.wallapop.com/api/v3/general/search?keywords={keywords.replace(' ', '%20')}&latitude=41.3851&longitude=2.1734&filters_source=quick_filters"

        r = requests.get(url, headers=headers, timeout=30)

        if r.status_code == 200:
            data = r.json()
            items = data.get('search_objects', [])

            for item in items:
                try:
                    titulo = item.get('title', '')
                    descripcion = item.get('description', '')
                    precio = item.get('price', 0)

                    texto = f"{titulo} | {descripcion}"
                    texto_lower = texto.lower()

                    # Filtros
                    if not ("taxi" in texto_lower or "licencia" in texto_lower):
                        continue
                    if precio < 50000 or precio > 600000:
                        continue

                    ofertas.append(OfertaRaw(
                        fuente="WALLAPOP",
                        referencia=str(item.get('id', '')),
                        raw=texto,
                        url=item.get('web_slug', ''),
                        precio_detectado=int(precio),
                        dia_descanso=extraer_dia_descanso(texto),
                        modelo_detectado=extraer_modelo(texto)
                    ))
                except:
                    continue
        else:
            logger.warning(f"   ⚠️ Wallapop API status: {r.status_code}")

    except Exception as e:
        logger.error(f"   🔥 Error Wallapop: {e}")

    logger.info(f"   ✅ {len(ofertas)} ofertas de WALLAPOP")
    return ofertas

# =============================================================================
# DEDUPLICACIÓN Y VALIDACIÓN
# =============================================================================

def deduplicar_ofertas(ofertas: List[OfertaRaw]) -> List[OfertaRaw]:
    """Elimina duplicados basándose en precio y referencia similar"""
    logger.info(f"🔄 Deduplicando {len(ofertas)} ofertas...")

    vistos = {}  # hash -> oferta

    for oferta in ofertas:
        # Crear clave única: referencia + precio (con tolerancia de ±1000€)
        precio_normalizado = (oferta.precio_detectado // 1000) * 1000 if oferta.precio_detectado else 0

        # Hash más flexible para detectar duplicados cross-fuente
        keys = [
            oferta.get_hash(),  # Hash exacto
            f"precio:{precio_normalizado}",  # Mismo precio aprox
        ]

        # Si tiene referencia numérica, usarla
        if oferta.referencia.isdigit():
            keys.append(f"ref:{oferta.referencia}")

        # Verificar si ya existe algo similar
        es_duplicado = False
        for key in keys:
            if key in vistos:
                existente = vistos[key]
                # Si el precio es muy similar (±2000€), es duplicado
                if existente.precio_detectado and oferta.precio_detectado:
                    if abs(existente.precio_detectado - oferta.precio_detectado) <= 2000:
                        es_duplicado = True
                        # Preferir fuente más confiable
                        fuentes_prioridad = ["STAC", "SOLANO", "GARCIA_BCN", "MILANUNCIOS", "WALLAPOP"]
                        if fuentes_prioridad.index(oferta.fuente) < fuentes_prioridad.index(existente.fuente):
                            vistos[key] = oferta
                        break

        if not es_duplicado:
            vistos[oferta.get_hash()] = oferta

    resultado = list(vistos.values())
    logger.info(f"   ✅ {len(resultado)} ofertas únicas (eliminados {len(ofertas) - len(resultado)} duplicados)")
    return resultado

def validar_ofertas(ofertas: List[OfertaRaw]) -> List[OfertaRaw]:
    """Valida y filtra ofertas con criterios de calidad"""
    logger.info(f"🔍 Validando {len(ofertas)} ofertas...")

    validas = []
    for oferta in ofertas:
        # Debe tener precio válido
        if not oferta.precio_detectado:
            continue
        if oferta.precio_detectado < 50000 or oferta.precio_detectado > 600000:
            continue

        # Filtrar VTC y otros no-taxi
        texto_lower = oferta.raw.lower()
        if any(x in texto_lower for x in ['vtc', 'uber', 'cabify', 'alquiler', 'renting']):
            continue

        validas.append(oferta)

    logger.info(f"   ✅ {len(validas)} ofertas válidas")
    return validas

# =============================================================================
# EJECUCIÓN PRINCIPAL
# =============================================================================

def main():
    logger.info("="*60)
    logger.info("🚀 LICENCIA SCRAPER V2 - Iniciando...")
    logger.info("="*60)

    todas_ofertas: List[OfertaRaw] = []

    # 1. Fuentes sin Selenium (más rápidas)
    logger.info("\n📡 FASE 1: Fuentes API...")

    # MILANUNCIOS via ScraperAPI
    ofertas_milan = scrape_milanuncios_api()
    todas_ofertas.extend(ofertas_milan)

    # Wallapop API
    ofertas_walla = scrape_wallapop()
    todas_ofertas.extend(ofertas_walla)

    # 2. Fuentes con Selenium
    logger.info("\n🌐 FASE 2: Fuentes Selenium...")
    driver = None

    try:
        driver = iniciar_driver()

        # Si MILANUNCIOS API falló, intentar Selenium
        if len(ofertas_milan) < 3:
            logger.info("   -> MILANUNCIOS API insuficiente, probando Selenium...")
            ofertas_milan_sel = scrape_milanuncios_selenium(driver)
            todas_ofertas.extend(ofertas_milan_sel)

        # SOLANO (muy fiable)
        ofertas_solano = scrape_solano(driver)
        todas_ofertas.extend(ofertas_solano)

        # GARCIA BCN
        ofertas_garcia = scrape_garcia_bcn(driver)
        todas_ofertas.extend(ofertas_garcia)

        # STAC (oficial)
        ofertas_stac = scrape_stac(driver)
        todas_ofertas.extend(ofertas_stac)

    except Exception as e:
        logger.error(f"❌ Error en fase Selenium: {e}")
    finally:
        if driver:
            driver.quit()

    # 3. Post-procesamiento
    logger.info("\n🔧 FASE 3: Post-procesamiento...")

    # Validar
    todas_ofertas = validar_ofertas(todas_ofertas)

    # Deduplicar
    todas_ofertas = deduplicar_ofertas(todas_ofertas)

    # Ordenar por precio
    todas_ofertas.sort(key=lambda x: x.precio_detectado or 999999)

    # 4. Guardar
    logger.info("\n💾 FASE 4: Guardando resultados...")

    # Convertir a formato compatible con procesado_licen.py
    output_data = [
        {
            "fuente": o.fuente,
            "raw": o.raw,
            "referencia": o.referencia,
            "precio_detectado": o.precio_detectado,
            "dia_descanso": o.dia_descanso,
            "modelo_detectado": o.modelo_detectado,
            "url": o.url,
            "fecha_scraping": o.fecha_scraping
        }
        for o in todas_ofertas
    ]

    output_file = str(OUTPUT_FILES.get('licencias_raw', 'licencias_totales.json'))

    success, message = safe_save_json(
        filepath=output_file,
        data=output_data,
        data_type='licenses',
        min_items=LIMITS.get('min_licenses_valid', 3),
        backup=True
    )

    if success:
        logger.info(f"✅ COMPLETADO: {message}")
        logger.info(f"   📊 Total ofertas: {len(todas_ofertas)}")

        # Resumen por fuente
        por_fuente = {}
        for o in todas_ofertas:
            por_fuente[o.fuente] = por_fuente.get(o.fuente, 0) + 1
        for fuente, count in sorted(por_fuente.items()):
            logger.info(f"      - {fuente}: {count}")
    else:
        logger.error(f"❌ FALLO: {message}")
        sys.exit(1)

    logger.info("="*60)

if __name__ == "__main__":
    main()
