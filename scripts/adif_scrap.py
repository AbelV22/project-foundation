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

def limpiar_nombre_tren(texto_sucio):
    # Convierte "RF - AVE" en "AVE", "IL - IRYO" en "IRYO", etc.
    texto = texto_sucio.replace('\n', ' ')
    limpio = re.sub(r'^(RF|RI|MD|R\d+|IL)\s*-\s*', '', texto)
    return limpio.strip()

def obtener_trenes():
    print("🚀 Iniciando Scraper de Trenes Sants (API directa)...")

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    datos = []

    try:
        # 1. CARGAR PÁGINA PARA OBTENER TOKEN DE AUTENTICACIÓN
        print("🔑 Obteniendo token de autenticación...")
        driver.get(URL_ADIF)
        wait = WebDriverWait(driver, 20)
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "input[type='radio']"))

        # Extraer p_p_auth del HTML de la página
        auth_token = driver.execute_script("""
            var html = document.documentElement.innerHTML;
            var match = html.match(/p_p_auth=([^"'&]+)/);
            return match ? match[1] : null;
        """)

        if not auth_token:
            print("❌ No se pudo obtener el token p_p_auth")
            sys.exit(1)

        print(f"   Token obtenido: {auth_token}")

        # 2. LLAMAR API DIRECTAMENTE (sin interacción con UI)
        print("📡 Llamando API de horarios AV/LD Llegadas...")
        whitelist = ["AVE", "AVLO", "OUIGO", "IRYO", "ALVIA", "EUROMED", "INTERCITY", "TGV", "LD", "MD", "AVANT"]
        page_num = 0
        max_pages = 20

        while page_num < max_pages:
            # Llamar la API via fetch desde el contexto del navegador (mismas cookies/sesión)
            api_result = driver.execute_script("""
                var auth = arguments[0];
                var pageNum = arguments[1];
                var url = window.location.pathname +
                    '?p_p_id=servicios_estacion_ServiciosEstacionPortlet' +
                    '&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view' +
                    '&p_p_resource_id=%2FconsultarHorario' +
                    '&p_p_cacheability=cacheLevelPage' +
                    '&assetEntryId=3067212' +
                    '&p_p_auth=' + auth +
                    '&_servicios_estacion_ServiciosEstacionPortlet_searchType=proximasLlegadas' +
                    '&_servicios_estacion_ServiciosEstacionPortlet_trafficType=avldmd' +
                    '&_servicios_estacion_ServiciosEstacionPortlet_numPage=' + pageNum +
                    '&_servicios_estacion_ServiciosEstacionPortlet_commuterNetwork=RODALIES_CATALUNYA' +
                    '&_servicios_estacion_ServiciosEstacionPortlet_stationCode=71801';

                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, false);  // Síncrono
                xhr.send();

                if (xhr.status !== 200) return {error: 'HTTP ' + xhr.status};

                // Parsear el HTML de respuesta
                var parser = new DOMParser();
                var doc = parser.parseFromString(xhr.responseText, 'text/html');
                var filas = doc.querySelectorAll('tbody tr');
                var resultado = [];

                for (var i = 0; i < filas.length; i++) {
                    var celdas = filas[i].querySelectorAll('td');
                    if (celdas.length < 3) continue;

                    // HORA: 2 spans (programada y estimada/real)
                    var horaSpans = celdas[0].querySelectorAll('div > span');
                    var hora1 = horaSpans[0] ? horaSpans[0].textContent.trim() : '';
                    var hora2 = horaSpans.length > 1 ? horaSpans[1].textContent.trim() : '';

                    // ORIGEN
                    var origen = celdas[1].textContent.trim();

                    // TREN: 2 spans (tipo y número)
                    var trenSpans = celdas[2].querySelectorAll('div > span');
                    var trenTipo = trenSpans[0] ? trenSpans[0].textContent.trim() : celdas[2].textContent.trim();
                    var trenNum = trenSpans.length > 1 ? trenSpans[1].textContent.trim() : '';

                    // VÍA
                    var viaSpan = celdas.length > 3 ? celdas[3].querySelector('div > span') : null;
                    var via = viaSpan ? viaSpan.textContent.trim() : '';

                    resultado.push({
                        hora1: hora1, hora2: hora2,
                        origen: origen,
                        trenTipo: trenTipo, trenNum: trenNum,
                        via: via
                    });
                }
                return {filas: resultado, html_length: xhr.responseText.length};
            """, auth_token, page_num)

            if isinstance(api_result, dict) and 'error' in api_result:
                print(f"   ❌ Error API página {page_num}: {api_result['error']}")
                break

            filas_pagina = api_result.get('filas', [])
            print(f"   📄 Página {page_num}: {len(filas_pagina)} filas (HTML: {api_result.get('html_length', 0)} bytes)")

            if not filas_pagina:
                print("   ✅ No hay más resultados.")
                break

            # Debug: mostrar primera fila de cada página
            if filas_pagina:
                print(f"      Muestra: {filas_pagina[0]}")

            # Procesar filas
            for fila in filas_pagina:
                try:
                    hora_real = fila.get('hora2', '') or fila.get('hora1', '')
                    origen = fila.get('origen', '')
                    tipo_raw = fila.get('trenTipo', '').upper()
                    tren_num = fila.get('trenNum', '')
                    via = fila.get('via', '') or "-"

                    tipo_limpio = limpiar_nombre_tren(tipo_raw)
                    if tren_num:
                        tipo_limpio = f"{tipo_limpio} {tren_num}"

                    # Validaciones
                    if not re.match(r"\d{2}:\d{2}", hora_real):
                        continue

                    # Filtros
                    es_valido = any(marca in tipo_limpio for marca in whitelist)
                    if "RODALIES" in tipo_raw or "CERCANIAS" in tipo_raw:
                        es_valido = False

                    if es_valido:
                        datos.append({
                            "hora": hora_real,
                            "origen": origen,
                            "tren": tipo_limpio,
                            "via": via
                        })
                except:
                    continue

            page_num += 1

        print(f"🚄 Total trenes válidos extraídos: {len(datos)}")

    except Exception as e:
        print(f"❌ Error crítico: {e}")
        import traceback
        traceback.print_exc()
    finally:
        driver.quit()

    # 3. GUARDADO SEGURO (No sobrescribe si datos son inválidos)
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
            sys.exit(1)
    else:
        logger.warning("⚠️ No se han extraído datos válidos. Archivo existente NO modificado.")
        sys.exit(1)

if __name__ == "__main__":
    obtener_trenes()
