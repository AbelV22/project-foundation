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

        # 2. NAVEGACIÓN (usando JS directo para compatibilidad con headless)
        print("👆 Configurando filtros...")

        # Esperar a que carguen los radio buttons
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "input[type='radio']"))

        # Seleccionar AV/LD radio y pestaña Llegadas via JS con dispatch de eventos
        driver.execute_script("""
            // 1. Seleccionar radio AV/LD
            var radios = document.querySelectorAll("input[type='radio']");
            if (radios.length > 1) {
                radios[1].checked = true;
                radios[1].dispatchEvent(new Event('change', {bubbles: true}));
                radios[1].dispatchEvent(new Event('click', {bubbles: true}));
            }
            // 2. Activar pestaña Llegadas
            var tab = document.querySelector("a[href='#tab-llegadas']");
            if (tab) tab.click();
        """)
        time.sleep(2)

        # Botón Consultar
        btn_consultar = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "input[value='Consultar']")))
        click_js(driver, btn_consultar)
        print("⏳ Consulta enviada. Esperando tabla...")
        time.sleep(6)

        # Verificar que la tabla de llegadas tiene contenido
        tabla_info = driver.execute_script("""
            var tabla = document.querySelector('#horas-trenes-estacion-llegadas');
            if (!tabla) return 'tabla_no_encontrada';
            var filas = tabla.querySelectorAll('tbody tr');
            var primerTexto = filas.length > 0 ? filas[0].textContent.trim().substring(0, 60) : '';
            return 'filas=' + filas.length + ' texto=' + primerTexto;
        """)
        print(f"   Verificación tabla: {tabla_info}")

        # 3. CARGAR TODOS LOS TRENES (click en "Cargar más" via JS)
        print("🔄 Cargando todos los trenes...")
        intentos_fallidos = 0

        while True:
            try:
                # Usar JS para comprobar y clickar el botón (funciona aunque no sea "visible" en headless)
                resultado = driver.execute_script("""
                    var btn = document.querySelector('#tabla-horas-trenes-llegadas-load-more input');
                    if (!btn) return 'no_btn';
                    btn.click();
                    return 'clicked';
                """)

                if resultado == 'no_btn':
                    print("   ✅ No hay más botones de carga.")
                    break

                print("   ⬇️ Clic en 'Cargar más'...")
                time.sleep(3.5)
                intentos_fallidos = 0

            except Exception as e:
                print(f"   ⚠️ Error en bucle de carga: {e}")
                intentos_fallidos += 1
                if intentos_fallidos > 3:
                    print("   ⚠️ Demasiados intentos. Saliendo del bucle.")
                    break

        # 4. EXTRACCIÓN VIA JAVASCRIPT (evita problemas de .text vacío en headless)
        print("👀 Extrayendo datos via JavaScript...")
        filas_raw = driver.execute_script("""
            var filas = document.querySelectorAll('#horas-trenes-estacion-llegadas tbody tr');
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
            return resultado;
        """)

        print(f"📊 Filas extraídas: {len(filas_raw)}")
        if filas_raw and len(filas_raw) > 0:
            print(f"   DEBUG fila 0: {filas_raw[0]}")
            if len(filas_raw) > 1:
                print(f"   DEBUG fila 1: {filas_raw[1]}")

        whitelist = ["AVE", "AVLO", "OUIGO", "IRYO", "ALVIA", "EUROMED", "INTERCITY", "TGV", "LD", "MD", "AVANT"]

        for fila in filas_raw:
            try:
                # HORA: preferir hora real/estimada (hora2), sino programada (hora1)
                hora_real = fila.get('hora2', '') or fila.get('hora1', '')
                origen = fila.get('origen', '')
                tipo_raw = fila.get('trenTipo', '').upper()
                tren_num = fila.get('trenNum', '')
                via = fila.get('via', '') or "-"

                tipo_limpio = limpiar_nombre_tren(tipo_raw)
                if tren_num:
                    tipo_limpio = f"{tipo_limpio} {tren_num}"

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
