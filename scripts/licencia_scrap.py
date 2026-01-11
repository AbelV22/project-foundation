import sys
import os
import time
import re
import json
import pandas as pd
from datetime import datetime

# =============================================================================
# 1. SETUP INTELIGENTE (Detecta si es Colab o GitHub/Local)
# =============================================================================
if 'google.colab' in sys.modules:
    print("🛠️ Entorno Colab detectado. Instalando dependencias...")
    if not os.path.exists("/usr/bin/google-chrome"):
        os.system('apt-get update -q')
        os.system('apt-get remove chromium-chromedriver chromium-browser -q -y > /dev/null 2>&1')
        os.system('wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb')
        os.system('apt-get install -y ./google-chrome-stable_current_amd64.deb > /dev/null 2>&1')
        os.system('pip install selenium webdriver-manager -q')

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

# ELIMINADO: from google.colab import files (Esto causaba el error en GitHub)

def iniciar_driver():
    options = Options()
    options.add_argument('--headless') # Vital para servidores sin pantalla
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# =============================================================================
# 2. MOTORES DE EXTRACCIÓN
# =============================================================================

# --- A. MILANUNCIOS ---
def scrape_milanuncios(driver):
    datos = []
    print(f"\n🌍 [1/4] MILANUNCIOS...")
    try:
        driver.get("https://www.milanuncios.com/")
        time.sleep(3)
        # Cookies
        try: WebDriverWait(driver, 4).until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Aceptar') or contains(., 'Consentir')]"))).click()
        except: pass

        # Búsqueda
        try:
            search_box = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//input[contains(@placeholder, 'Estoy buscando')]")))
            search_box.clear()
            search_box.send_keys("Licencia taxi barcelona")
            time.sleep(1)
            driver.execute_script("arguments[0].click();", driver.find_element(By.CLASS_NAME, "ma-FormHome-submitButton"))
        except: return []

        time.sleep(5)
        # Scroll
        body = driver.find_element(By.TAG_NAME, "body")
        for _ in range(3):
            body.send_keys(Keys.PAGE_DOWN)
            time.sleep(1)

        anuncios = driver.find_elements(By.TAG_NAME, "article")
        for anuncio in anuncios:
            raw = anuncio.text.replace("\n", " | ")
            if "TAXI" in raw.upper():
                datos.append({"fuente": "MILANUNCIOS", "raw": raw})
    except: pass
    print(f"   -> {len(datos)} ofertas.")
    return datos

# --- B. ASESORÍA SOLANO ---
def scrape_solano(driver):
    datos = []
    print(f"\n🌍 [2/4] SOLANO...")
    try:
        driver.get("https://asesoriasolano.es/comprar-licencias/")
        time.sleep(4)
        full_text = driver.find_element(By.TAG_NAME, "body").text

        patron = r"(Ref:.*?ESTOY INTERESADO)"
        matches = re.findall(patron, full_text, re.DOTALL | re.IGNORECASE)

        if matches:
            for m in matches:
                datos.append({"fuente": "SOLANO", "raw": m.replace("\n", " | ")})
        else:
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
            # Fallback
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

    except Exception as e:
        print(f"   ⚠️ Error STAC: {e}")
    print(f"   -> {len(datos)} ofertas.")
    return datos

# =============================================================================
# 3. EJECUCIÓN PRINCIPAL
# =============================================================================
if __name__ == "__main__":
    try:
        driver = iniciar_driver()
        resultados = []

        resultados.extend(scrape_milanuncios(driver))
        resultados.extend(scrape_solano(driver))
        resultados.extend(scrape_garcia(driver))
        resultados.extend(scrape_stac(driver))

        driver.quit()

        # Guardamos en la raíz del repositorio para que el siguiente script lo vea
        nombre_fichero = 'licencias_totales.json'
        
        with open(nombre_fichero, 'w', encoding='utf-8') as f:
            json.dump(resultados, f, ensure_ascii=False, indent=4)

        print(f"\n✅ PROCESO COMPLETADO: {len(resultados)} ofertas guardadas en '{nombre_fichero}'.")

        # INTENTO DE DESCARGA SEGURA (Solo funciona si es Colab)
        try:
            from google.colab import files
            files.download(nombre_fichero)
        except ImportError:
            print("ℹ️ Ejecución remota/local: Archivo guardado en disco, no se descarga automáticamente.")

    except Exception as e:
        print(f"\n❌ Error fatal en el script: {e}")
        exit(1)
