import sys
import os
import time
import re
import json
import pandas as pd
import undetected_chromedriver as uc
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

# =============================================================================
# MODIFICACIÓN: MODO MÓVIL (LA ÚLTIMA ESPERANZA GRATUITA)
# =============================================================================
def iniciar_driver():
    print("📱 Iniciando Chrome con CONFIGURACIÓN MANUAL DE MÓVIL...")
    
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument("--lang=es-ES")
    
    # --- CORRECCIÓN: Definimos el móvil manualmente (Sin nombre de dispositivo) ---
    # Esto simula un Pixel generico sin depender de la base de datos de Chrome
    mobile_emulation = {
        "deviceMetrics": { "width": 360, "height": 640, "pixelRatio": 3.0 },
        "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
    }
    options.add_experimental_option("mobileEmulation", mobile_emulation)
    # -----------------------------------------------------------------------------
    
    # Ocultar rastro de automatización
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    return driver
def scrape_milanuncios(driver):
    datos = []
    print(f"\n🌍 [1/4] MILANUNCIOS (Vista Móvil)...")
    try:
        # 1. Navegación
        driver.get("https://www.milanuncios.com/anuncios/?s=Licencia%20taxi%20barcelona")
        time.sleep(5) # Espera prudencial

        # 2. Verificar Bloqueo
        if "Interruption" in driver.title or "Denied" in driver.title:
            print("   🚨 BLOQUEO DE IP CONFIRMADO (El modo móvil tampoco funcionó).")
            print("   💡 Solución: Ejecutar en local o usar Proxy.")
            return []

        # 3. Cookies (En móvil suelen ser un banner abajo)
        try:
            # Buscamos botones genéricos de aceptar
            boton = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Aceptar') or contains(., 'Consentir') or contains(., 'Agree')]"))
            )
            # En móvil a veces es mejor usar Javascript para el click
            driver.execute_script("arguments[0].click();", boton)
            print("   ✅ Cookies cerradas.")
            time.sleep(2)
        except: 
            print("   ⚠️ No se vieron cookies (o el banner es diferente en móvil).")

        # 4. Scroll Móvil (Es más corto)
        print("   -> Bajando...")
        for _ in range(20): # Menos scrolls porque la lista móvil carga distinto
            driver.execute_script("window.scrollBy(0, 800);")
            time.sleep(1)

        # 5. Extracción
        # En versión móvil, la estructura HTML puede cambiar ligeramente,
        # pero la etiqueta 'article' suele mantenerse.
        anuncios = driver.find_elements(By.TAG_NAME, "article")
        
        # Si falla article, probamos clases comunes de móvil
        if not anuncios:
            anuncios = driver.find_elements(By.CLASS_NAME, "ma-AdCard")

        print(f"   -> Elementos visualizados: {len(anuncios)}")

        for anuncio in anuncios:
            try:
                raw = driver.execute_script("return arguments[0].textContent;", anuncio).strip()
                raw = re.sub(r'\s+', ' ', raw)

                if len(raw) > 15 and ("TAXI" in raw.upper() or "LICENCIA" in raw.upper()):
                    datos.append({"fuente": "MILANUNCIOS", "raw": raw})
            except: continue
            
    except Exception as e: 
        print(f"   ⚠️ Error: {e}")
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
