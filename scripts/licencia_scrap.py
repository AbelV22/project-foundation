import sys
import os
import time
import re
import json
import requests # Necesario para ScraperAPI
from bs4 import BeautifulSoup # Necesario para procesar el HTML de ScraperAPI

# =============================================================================
# 1. SETUP
# =============================================================================
if 'google.colab' in sys.modules:
    print("🛠️ Entorno Colab detectado...")
    # (Instalaciones de Colab omitidas para ahorrar espacio, déjalas si las usas)

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# --- IMPORTS ROBUSTEZ ---
from utils import safe_save_json, setup_logger
from config import OUTPUT_FILES, LIMITS

# --- LOGGER ---
logger = setup_logger('Licencia_Scraper')

def iniciar_driver():
    # Configuración estándar de Selenium (ya no necesitamos trucos de móvil ni stealth)
    options = Options()
    options.add_argument('--headless=new') 
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument("--lang=es-ES")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    return driver

# =============================================================================
# 2. MOTORES DE EXTRACCIÓN
# =============================================================================

# --- A. MILANUNCIOS (VÍA SCRAPERAPI) ---
def scrape_milanuncios_api():
    datos = []
    print(f"\n🌍 [1/4] MILANUNCIOS (Vía ScraperAPI)...")
    
    api_key = os.environ.get('SCRAPER_API_KEY')
    if not api_key:
        print("   ❌ ERROR: No se encontró la variable de entorno SCRAPER_API_KEY")
        return []

    # URL objetivo
    target_url = "https://www.milanuncios.com/anuncios/?s=Licencia%20taxi%20barcelona"
    
    # Configuración de ScraperAPI
    payload = {
        'api_key': api_key,
        'url': target_url,
        'render': 'true',      # Importante: Le dice a ScraperAPI que ejecute el JS
        'country_code': 'es',  # Usar IP de España
        'wait_for_selector': 'article' # Esperar a que existan anuncios antes de devolver HTML
    }

    try:
        print("   -> Solicitando HTML a ScraperAPI (esto puede tardar unos segundos)...")
        r = requests.get('http://api.scraperapi.com', params=payload, timeout=60)
        
        if r.status_code == 200:
            print("   ✅ Respuesta recibida con éxito.")
            # Procesamos con BeautifulSoup (mucho más rápido que Selenium)
            soup = BeautifulSoup(r.text, 'html.parser')
            
            # Buscamos los anuncios (etiqueta <article>)
            anuncios = soup.find_all('article')
            print(f"   -> Elementos encontrados: {len(anuncios)}")
            
            for anuncio in anuncios:
                # Extraemos todo el texto del artículo
                raw = anuncio.get_text(separator=" | ", strip=True)
                
                # Filtro
                if len(raw) > 20 and ("TAXI" in raw.upper() or "LICENCIA" in raw.upper()):
                    datos.append({"fuente": "MILANUNCIOS", "raw": raw})
        else:
            print(f"   ⚠️ Fallo en ScraperAPI: Status {r.status_code}")
            print(f"   Mensaje: {r.text[:200]}")

    except Exception as e:
        print(f"   🔥 Error de conexión: {e}")

    print(f"   -> {len(datos)} ofertas válidas extraídas.")
    return datos

# --- B. ASESORÍA SOLANO ---
def scrape_solano(driver):
    datos = []
    print(f"\n🌍 [2/4] SOLANO...")
    try:
        driver.get("https://asesoriasolano.es/comprar-licencias/")
        time.sleep(4)
        full_text = driver.find_element(By.TAG_NAME, "body").text
        
        # Patrón Ref -> Interesado
        patron = r"(Ref:.*?ESTOY INTERESADO)"
        matches = re.findall(patron, full_text, re.DOTALL | re.IGNORECASE)
        
        if matches:
            for m in matches:
                datos.append({"fuente": "SOLANO", "raw": m.replace("\n", " | ")})
        else:
            # Fallback bloques de precio
            bloques = full_text.split('\n\n')
            for b in bloques:
                if "PRECIO" in b.upper() and "€" in b:
                    datos.append({"fuente": "SOLANO (Bloque)", "raw": b.replace("\n", " | ")})
    except: pass
    print(f"   -> {len(datos)} ofertas.")
    return datos

# --- C. GARCÍA BCN ---
def scrape_garcia(driver):
    datos = []
    print(f"\n🌍 [3/4] GARCÍA BCN...")
    try:
        driver.get("https://asesoriagarciabcn.com/compra-y-venta-de-licencias-de-taxi-en-barcelona/")
        time.sleep(4)
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
        items = driver.find_elements(By.TAG_NAME, "li") + driver.find_elements(By.TAG_NAME, "p")
        for item in items:
            texto = item.text
            if "€" in texto and len(texto) > 20:
                datos.append({"fuente": "GARCIA_BCN", "raw": texto.replace("\n", " | ")})
    except: pass
    print(f"   -> {len(datos)} ofertas.")
    return datos

# --- D. STAC ---
def scrape_stac(driver):
    datos = []
    print(f"\n🌍 [4/4] STAC...")
    try:
        driver.get("https://bolsadelicenciasstac.cat")
        time.sleep(5)
        articles = driver.find_elements(By.TAG_NAME, "article")
        if len(articles) > 0:
            for art in articles:
                texto = art.text
                if "Precio" in texto or "€" in texto:
                    datos.append({"fuente": "STAC", "raw": texto.replace("\n", " | ")})
        else:
            precios = driver.find_elements(By.XPATH, "//*[contains(text(), 'Precio:')]")
            seen = set()
            for p in precios:
                try:
                    contenedor = p.find_element(By.XPATH, "./ancestor::article")
                    txt = contenedor.text
                    if txt not in seen:
                        datos.append({"fuente": "STAC (Ancestro)", "raw": txt.replace("\n", " | ")})
                        seen.add(txt)
                except: pass
    except: pass
    print(f"   -> {len(datos)} ofertas.")
    return datos

# =============================================================================
# 3. EJECUCIÓN PRINCIPAL
# =============================================================================
if __name__ == "__main__":
    try:
        resultados = []

        # 1. Ejecutamos MILANUNCIOS (Sin Driver, usa API)
        resultados.extend(scrape_milanuncios_api())

        # 2. Ejecutamos el resto (Con Driver Selenium)
        driver = iniciar_driver()
        resultados.extend(scrape_solano(driver))
        resultados.extend(scrape_garcia(driver))
        resultados.extend(scrape_stac(driver))
        driver.quit()

        # 3. GUARDADO SEGURO - Validar antes de sobrescribir
        nombre_fichero = str(OUTPUT_FILES.get('licencias_raw', 'licencias_totales.json'))
        
        success, message = safe_save_json(
            filepath=nombre_fichero,
            data=resultados,
            data_type='licenses',
            min_items=LIMITS.get('min_licenses_valid', 3),
            backup=True
        )
        
        if success:
            logger.info(f"✅ PROCESO COMPLETADO: {message}")
        else:
            logger.error(message)
            logger.error("❌ Scraping fallido. Archivo existente NO modificado.")
            sys.exit(1)

        # Descarga Colab
        if 'google.colab' in sys.modules:
            try:
                from google.colab import files
                files.download(nombre_fichero)
            except: pass

    except Exception as e:
        logger.exception(f"❌ Error fatal: {e}")
        exit(1)
