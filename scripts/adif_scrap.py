import sys
import os
import time
import json
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# --- IMPORTS ROBUSTEZ ---
from utils import safe_save_json, setup_logger, DataValidator
from config import URLS, OUTPUT_FILES, TIMEOUTS, LIMITS, VALIDATION

# --- CONFIGURACIÓN ---
logger = setup_logger('ADIF_Scraper')
URL_ADIF = URLS.get('adif', "https://www.adif.es/w/71801-barcelona-sants?pageFromPlid=335")
OUTPUT_FILE = str(OUTPUT_FILES.get('trenes_sants', os.path.join(os.getcwd(), "public", "trenes_sants.json")))

def click_js(driver, elemento):
    driver.execute_script("arguments[0].click();", elemento)

def limpiar_hora(texto_hora):
    """Si hay salto de línea (12:00\n12:10), nos quedamos con la última."""
    if not texto_hora: return ""
    partes = texto_hora.split('\n')
    return partes[-1].strip()

def limpiar_nombre_tren(texto_sucio):
    # Convierte "RF - AVE 03662" en "AVE 03662"
    texto = texto_sucio.replace('\n', ' ')
    limpio = re.sub(r'^(RF|RI|MD|R\d+|IL)\s*-\s*', '', texto)
    return limpio.strip()

def obtener_trenes():
    print("🚀 Iniciando Scraper de Trenes Sants (Modo GitHub Actions)...")
    
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    datos = []

    try:
        driver.get(URL_ADIF)
        wait = WebDriverWait(driver, 20) # Aumentado tiempo de espera inicial
        
        # 1. MATAR COOKIES (Crítico para que no tapen el botón de cargar)
        try: driver.execute_script("var b=document.querySelector('#onetrust-banner-sdk'); if(b) b.remove();")
        except: pass

        # 2. NAVEGACIÓN
        print("👆 Configurando filtros...")
        # Espera explicita a la pestaña
        tab_llegadas = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a[href='#tab-llegadas']")))
        click_js(driver, tab_llegadas)
        time.sleep(2)

        # Seleccionar Radio Button (Larga Distancia)
        radios = driver.find_elements(By.CSS_SELECTOR, "input[type='radio']")
        if len(radios) > 1: click_js(driver, radios[1])
        
        # Botón Consultar
        btn_consultar = driver.find_element(By.CSS_SELECTOR, "input[value='Consultar']")
        click_js(driver, btn_consultar)
        print("⏳ Consulta enviada. Esperando tabla...")
        time.sleep(6) # Damos tiempo a la carga inicial

        # 3. BUCLE "PAC-MAN" MEJORADO
        print("🔄 Buscando trenes ocultos (Scroll infinito)...")
        intentos_fallidos = 0
        
        while True:
            try:
                # Scroll al fondo de la página
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1.5)

                # Buscamos el botón específico
                botones_carga = driver.find_elements(By.CSS_SELECTOR, "#tabla-horas-trenes-llegadas-load-more input")
                
                if botones_carga:
                    boton = botones_carga[0]
                    # Truco: Scroll específico al elemento para asegurar que es "clickable"
                    driver.execute_script("arguments[0].scrollIntoView(true);", boton)
                    time.sleep(0.5)
                    
                    if boton.is_displayed():
                        print("   ⬇️ Clic en 'Cargar más'...")
                        click_js(driver, boton)
                        time.sleep(3.5) # Espera para que carguen filas
                        intentos_fallidos = 0 # Reiniciar contador
                    else:
                        print("   ⚠️ Botón detectado pero no visible. Reintentando scroll...")
                        intentos_fallidos += 1
                else:
                    print("   ✅ No hay más botones de carga.")
                    break
                
                # Seguridad para no buclear infinito si se atasca
                if intentos_fallidos > 3:
                    print("   ⚠️ Demasiados intentos fallidos. Saliendo del bucle.")
                    break

            except Exception as e:
                print(f"   ⚠️ Error en bucle de carga: {e}")
                break

        # 4. EXTRACCIÓN Y LIMPIEZA
        print("👀 Procesando filas extraídas...")
        filas = driver.find_elements(By.CSS_SELECTOR, "#horas-trenes-estacion-llegadas tbody tr")
        print(f"📊 Filas encontradas en HTML: {len(filas)}")
        
        whitelist = ["AVE", "AVLO", "OUIGO", "IRYO", "ALVIA", "EUROMED", "INTERCITY", "TGV", "LD", "MD", "AVANT"]

        for fila in filas:
            try:
                celdas = fila.find_elements(By.TAG_NAME, "td")
                if len(celdas) < 3: continue

                hora_raw = celdas[0].text.strip()
                origen = celdas[1].text.strip()
                tipo_raw = celdas[2].text.strip().upper()
                via = celdas[3].text.strip() if len(celdas) > 3 else "-"
                
                # Limpieza
                hora_real = limpiar_hora(hora_raw)
                tipo_limpio = limpiar_nombre_tren(tipo_raw)

                # Validaciones
                if not re.match(r"\d{2}:\d{2}", hora_real): continue
                
                # Filtros
                es_valido = any(marca in tipo_limpio for marca in whitelist)
                if "RODALIES" in tipo_raw or "CERCANIAS" in tipo_raw: es_valido = False

                if es_valido:
                    datos.append({
                        "hora": hora_real,
                        "origen": origen,
                        "tren": tipo_limpio,
                        "via": via
                    })
            except: continue

    except Exception as e:
        print(f"❌ Error crítico: {e}")
        # Opcional: Imprimir el HTML si falla para debuggear en los logs de GitHub
        # print(driver.page_source[:1000]) 
    finally:
        driver.quit()

    # 5. GUARDADO SEGURO (No sobrescribe si datos son inválidos)
    if datos:
        datos.sort(key=lambda x: x['hora'])
        
        # Usar safe_save_json para validar antes de sobrescribir
        success, message = safe_save_json(
            filepath=OUTPUT_FILE,
            data=datos,
            data_type='trains',
            min_items=LIMITS.get('min_trains_valid', 5),
            backup=True
        )
        
        if success:
            logger.info(f"💾 {message}")
            logger.info(f"   Último tren: {datos[-1]['hora']} - {datos[-1]['tren']}")
        else:
            logger.error(message)
            # Salir con código de error pero SIN sobrescribir datos existentes
            sys.exit(1)
    else:
        logger.warning("⚠️ No se han extraído datos válidos. Archivo existente NO modificado.")
        sys.exit(1)

if __name__ == "__main__":
    obtener_trenes()
