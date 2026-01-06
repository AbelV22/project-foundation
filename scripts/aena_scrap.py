# =============================================================================
# 1. SETUP E IMPORTS
# =============================================================================
import sys
import os
import time
import json
import re

# Instalación automática (Solo Colab)
if 'google.colab' in sys.modules:
    print("🛠️ Verificando entorno e instalando librerías...")
    if not os.path.exists("/usr/bin/google-chrome"):
        os.system('apt-get remove chromium-chromedriver chromium-browser -q -y > /dev/null 2>&1')
        os.system('wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb')
        os.system('apt-get install -y ./google-chrome-stable_current_amd64.deb > /dev/null 2>&1')
        os.system('pip install selenium webdriver-manager -q')
    else:
        print("✅ Entorno ya estaba listo.")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# =============================================================================
# 2. FUNCIONES DE PARSEO (V4 - ANCLA)
# =============================================================================
def parsear_fila_aena_v4(texto_fila, hora_detectada):
    partes = [p.strip() for p in texto_fila.split(" | ")]
    obj = {
        "hora": hora_detectada, "vuelo": "N/A", "aerolinea": "N/A",
        "origen": "N/A", "terminal": "N/A", "sala": "", "estado": "Programado"
    }
    BLACKLIST_ESTADO = ["EN HORA", "RETRASADO", "ATERRIZADO", "PROGRAMADO", 
                        "CANCELADO", "DESVIADO", "SALA", "CINTA", "LLEGADA", 
                        "FINALIZADO", "OPERANDO", "EMBARCANDO", "ÚLTIMA LLAMADA"]
    # Estado
    if len(partes) > 0:
        ultimo = partes[-1].upper()
        if any(x in ultimo for x in BLACKLIST_ESTADO):
            obj["estado"] = partes[-1]
        elif len(partes) > 1:
            penultimo = partes[-2].upper()
            if any(x in penultimo for x in BLACKLIST_ESTADO):
                obj["estado"] = partes[-2]
    # Terminal
    idx_terminal = -1
    for i, p in enumerate(partes):
        p_upper = p.upper()
        if p_upper in ["T1", "T2", "TERMINAL T1", "TERMINAL T2"]:
            obj["terminal"] = "T1" if "T1" in p_upper else "T2"
            idx_terminal = i
            break
    # Sala
    if idx_terminal != -1 and len(partes) > idx_terminal + 1:
        posible_sala = partes[idx_terminal + 1]
        if len(posible_sala) < 6: 
            obj["sala"] = posible_sala
            if obj["terminal"] == "T2" and "C" in posible_sala.upper():
                obj["terminal"] = "T2C (EasyJet)"
            elif obj["terminal"] == "T2":
                obj["terminal"] = f"T2{posible_sala}"
    # Vuelo y Origen
    for i, p in enumerate(partes):
        if re.match(r"^[A-Z]{2,3}\d{3,4}$", p):
            obj["vuelo"] = p
            if i + 1 < len(partes):
                candidato_origen = partes[i+1]
                es_hora = ":" in candidato_origen
                es_terminal = "T1" in candidato_origen or "T2" in candidato_origen
                es_estado = any(x in candidato_origen.upper() for x in BLACKLIST_ESTADO)
                if not es_hora and not es_terminal and not es_estado:
                    obj["origen"] = candidato_origen
            break 
    return obj

def limpiar_y_deduplicar(datos):
    print(f"\n🧹 Procesando {len(datos)} vuelos crudos...")
    unicos = {}
    for v in datos:
        origen_clean = v['origen'].strip().upper()
        clave = (v['dia_relativo'], v['hora'], v['vuelo'] if origen_clean == "N/A" else origen_clean)
        if clave in unicos:
            existente = unicos[clave]
            existente['aerolinea'] = "Multicompania"
            if v['vuelo'] != "N/A" and v['vuelo'] not in existente['vuelo']:
                existente['vuelo'] = f"{existente['vuelo']} / {v['vuelo']}"
            if "T2C" in v['terminal'] and "T2C" not in existente['terminal']:
                 existente['terminal'] = v['terminal']
        else:
            unicos[clave] = v
    lista = list(unicos.values())
    lista.sort(key=lambda x: (x['dia_relativo'], x['hora']))
    return lista

# =============================================================================
# 3. MOTOR TURBO (LÓGICA BIDIRECCIONAL + 50 CLICKS)
# =============================================================================
def obtener_vuelos_turbo():
    options = Options()
    options.add_argument('--headless') 
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    url = "https://www.aena.es/es/infovuelos.html"
    datos_recolectados = []

    try:
        print(f"✈️ Entrando en AENA...")
        driver.get(url)
        time.sleep(3)

        # BÚSQUEDA
        try: driver.execute_script("var b=document.querySelectorAll('.onetrust-pc-dark-filter, #onetrust-consent-sdk');b.forEach(e=>e.remove());")
        except: pass
        try:
            inp = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//input[contains(@placeholder, 'llegada')]")))
            inp.send_keys("JOSEP TARRADELLAS BARCELONA-EL PRAT")
            time.sleep(1)
            driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "btnBuscadorVuelos"))
        except: pass
        
        print("⏳ Esperando tabla...")
        time.sleep(5)

        # === FASE 1: CARGAR TODO ===
        hora_inicio = -1
        dia_actual = 0 
        ultimo_minuto_check = -1
        stop_flag = False
        clicks = 0
        MAX_PAGINAS = 80
        MIN_CLICKS_OBLIGATORIOS = 50 

        print(f"\n🚀 FASE 1: Carga Rápida (Requisito: >{MIN_CLICKS_OBLIGATORIOS} clicks y 24h reales)...")

        while not stop_flag and clicks < MAX_PAGINAS:
            try:
                elementos_hora = driver.find_elements(By.XPATH, "//*[contains(text(), ':') and string-length(text()) = 5]")
                if elementos_hora:
                    # Capturar hora inicio
                    if hora_inicio == -1:
                        h_ini = elementos_hora[0].text
                        if re.match(r"^\d{2}:\d{2}$", h_ini):
                            hora_inicio = int(h_ini.split(':')[0])*60 + int(h_ini.split(':')[1])
                            ultimo_minuto_check = hora_inicio
                            print(f"⏱️ Hora Inicio: {h_ini}")

                    # Mirar el último visible
                    h_fin = elementos_hora[-1].text
                    if re.match(r"^\d{2}:\d{2}$", h_fin):
                        m_act = int(h_fin.split(':')[0])*60 + int(h_fin.split(':')[1])
                        
                        # --- LÓGICA BIDIRECCIONAL (CORRECCIÓN DE ERRORES) ---
                        diferencia = ultimo_minuto_check - m_act
                        
                        # 1. Si bajamos drásticamente (23:00 -> 01:00) -> DÍA SIGUIENTE
                        if diferencia > 600:
                            dia_actual += 1
                            if clicks >= MIN_CLICKS_OBLIGATORIOS:
                                print(f"🌙 Cambio de día DETECTADO ({h_fin}). Día relativo: {dia_actual}")
                        
                        # 2. Si subimos drásticamente (01:00 -> 23:00) -> VOLVIMOS ATRÁS (Corregir error AENA)
                        elif diferencia < -600:
                            dia_actual -= 1
                            print(f"🔙 Corrección de día detectada ({h_fin}). Volvemos al día: {dia_actual}")

                        ultimo_minuto_check = m_act

                        # --- CONDICIÓN DE PARADA ---
                        # Solo paramos si ya hemos pasado al día siguiente DE VERDAD y tenemos los clicks
                        if dia_actual >= 1 and m_act >= hora_inicio:
                            if clicks >= MIN_CLICKS_OBLIGATORIOS:
                                print(f"🛑 Círculo 24h cerrado ({h_fin}) y clicks cumplidos. Parando.")
                                stop_flag = True
                                break
                            else:
                                # Si faltan clicks, IGNORAMOS la señal de parada y seguimos
                                # La "Corrección de día" arreglará el flag si era un error
                                pass
            except: pass

            try:
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                btn = WebDriverWait(driver, 1).until(EC.visibility_of_element_located((By.CLASS_NAME, "btn-see-more")))
                driver.execute_script("arguments[0].click();", btn)
                clicks += 1
                if clicks % 5 == 0: 
                    estado = "✅" if clicks >= MIN_CLICKS_OBLIGATORIOS else f"⏳ ({clicks}/{MIN_CLICKS_OBLIGATORIOS})"
                    print(f" ⬇️ Click {clicks} {estado}")
                time.sleep(0.6)
            except:
                print("✅ Fin de botones.")
                break

        # === FASE 2: LECTURA MASIVA (Igual, pero aplicando la misma lógica bidireccional) ===
        print(f"\n👀 FASE 2: Procesando y ordenando...")
        
        elementos_hora = driver.find_elements(By.XPATH, "//*[contains(text(), ':') and string-length(text()) = 5]")
        
        dia_parseo = 0
        min_anterior_parseo = hora_inicio 
        
        if min_anterior_parseo == -1 and elementos_hora:
             h_txt = elementos_hora[0].text
             if re.match(r"^\d{2}:\d{2}$", h_txt):
                 min_anterior_parseo = int(h_txt.split(':')[0])*60 + int(h_txt.split(':')[1])

        filas_procesadas_ids = set()

        for i, el in enumerate(elementos_hora):
            try:
                hora_str = el.text
                if not re.match(r"^\d{2}:\d{2}$", hora_str): continue
                
                fila_padre = el.find_element(By.XPATH, "./../..")
                texto_fila = fila_padre.text.replace("\n", " | ")
                
                if texto_fila in filas_procesadas_ids: continue
                
                m_actual = int(hora_str.split(':')[0])*60 + int(hora_str.split(':')[1])
                
                # LÓGICA BIDIRECCIONAL TAMBIÉN AQUÍ PARA ASIGNAR EL DÍA CORRECTO
                diferencia = min_anterior_parseo - m_actual
                if diferencia > 600:
                    dia_parseo += 1 # Pasamos a mañana
                elif diferencia < -600:
                    dia_parseo -= 1 # Oops, volvimos a ayer (desorden)
                
                min_anterior_parseo = m_actual 

                obj = parsear_fila_aena_v4(texto_fila, hora_str)
                # Si el desorden hace que dia_parseo sea -1, lo forzamos a 0
                obj["dia_relativo"] = max(0, dia_parseo) 
                
                if obj["vuelo"] != "N/A" or obj["origen"] != "N/A":
                    datos_recolectados.append(obj)
                
                filas_procesadas_ids.add(texto_fila)

            except: continue

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        driver.quit()
        return datos_recolectados

# =============================================================================
# 4. EJECUCIÓN
# =============================================================================
if __name__ == "__main__":
    vuelos_raw = obtener_vuelos_turbo()
    
    if vuelos_raw:
        vuelos_clean = limpiar_y_deduplicar(vuelos_raw)
        archivo = 'vuelos.json'
        with open(archivo, 'w', encoding='utf-8') as f:
            json.dump(vuelos_clean, f, indent=4, ensure_ascii=False)
        print(f"\n💾 ¡ÉXITO! {len(vuelos_clean)} vuelos guardados en: {archivo}")
    else:
        print("⚠️ No se encontraron datos.")
