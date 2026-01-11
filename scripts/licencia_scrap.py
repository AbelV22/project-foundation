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

def iniciar_driver():
    options = Options()
    options.add_argument('--headless') # Vital para servidores sin pantalla
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    
    # --- NOVEDAD: Forzar Español para evitar popups en inglés ---
    options.add_argument("--lang=es-ES") 
    options.add_experimental_option('prefs', {'intl.accept_languages': 'es,es_ES'})
    
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# =============================================================================
# 2. MOTORES DE EXTRACCIÓN
# =============================================================================

# --- A. MILANUNCIOS (LÓGICA NUEVA: SCROLL PROGRESIVO + JS) ---
def scrape_milanuncios(driver):
    datos = []
    print(f"\n🌍 [1/4] MILANUNCIOS (Modo Scroll Progresivo)...")
    try:
        # 1. Enlace Directo (Evita errores de buscador)
        driver.get("https://www.milanuncios.com/anuncios/?s=Licencia%20taxi%20barcelona")
        time.sleep(4)

        # 2. Gestión de Cookies (Multilenguaje)
        try: 
            xpath_cookies = "//button[contains(., 'Agree') or contains(., 'Aceptar') or contains(., 'Consentir')]"
            boton = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, xpath_cookies)))
            boton.click()
            print("   -> Cookies cerradas.")
            time.sleep(2)
        except: pass

        # 3. Scroll Humano (Baja poco a poco para forzar carga de ofertas)
        print("   -> Bajando para cargar ofertas...")
        viewport_height = driver.execute_script("return window.innerHeight")
        
        for _ in range(50): # Límite de seguridad
            driver.execute_script(f"window.scrollBy(0, {viewport_height});")
            time.sleep(1.5) # Espera carga de imágenes
            
            # Chequeo de final
            new_height = driver.execute_script("return document.body.scrollHeight")
            current_scroll = driver.execute_script("return window.pageYOffset + window.innerHeight")
            
            if current_scroll >= new_height - 100:
                time.sleep(2) # Última oportunidad de carga
                if driver.execute_script("return document.body.scrollHeight") == new_height:
                    break # Fin real

        # 4. Extracción Blindada (JS textContent)
        anuncios = driver.find_elements(By.TAG_NAME, "article")
        print(f"   -> Elementos visualizados: {len(anuncios)}")

        for anuncio in anuncios:
            try:
                # Extraemos con JS directo del HTML (bypassea bloqueos visuales de Selenium)
                raw = driver.execute_script("return arguments[0].textContent;", anuncio).strip()
                raw = re.sub(r'\s+', ' ', raw) # Limpieza de espacios

                if len(raw) > 20 and ("TAXI" in raw.upper() or "LICENCIA" in raw.upper()):
                    datos.append({"fuente": "MILANUNCIOS", "raw": raw})
            except: continue
            
    except Exception as e: 
        print(f"   ⚠️ Error en Milanuncios: {e}")
        pass
        
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

        # Guardamos en la raíz del repositorio
        nombre_fichero = 'licencias_totales.json'
        
        with open(nombre_fichero, 'w', encoding='utf-8') as f:
            json.dump(resultados, f, ensure_ascii=False, indent=4)

        print(f"\n✅ PROCESO COMPLETADO: {len(resultados)} ofertas guardadas en '{nombre_fichero}'.")

        # INTENTO DE DESCARGA SEGURA (Solo funciona si es Colab)
        if 'google.colab' in sys.modules:
            try:
                from google.colab import files
                files.download(nombre_fichero)
            except: pass

    except Exception as e:
        print(f"\n❌ Error fatal en el script: {e}")
        exit(1)
