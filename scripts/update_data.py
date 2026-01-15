import requests
import json
import os
import sys
from datetime import datetime
import time

# --- IMPORTS ROBUSTEZ ---
from utils import safe_save_json, setup_logger
from config import URLS, OUTPUT_FILES, LIMITS

# --- LOGGER ---
logger = setup_logger('Update_Data')

# CONFIGURACIÓN
API_KEY = os.environ.get("API_KEY") 
BASE_URL = URLS.get('aviation_api', "http://api.aviationstack.com/v1/flights")

def obtener_datos():
    print("📡 Escaneando radar iTaxiBcn (Modo Paginación Activado)...")
    
    if not API_KEY:
        print("❌ ERROR: No hay API_KEY configurada.")
        sys.exit(1)

    # Variables para el bucle
    todos_vuelos_raw = []
    offset = 0
    limit = 100
    total_encontrados = 0
    max_loops = 10 # MEDIDA DE SEGURIDAD: Para no gastar más de 10 peticiones si hay un error

    loop_count = 0

    while True:
        loop_count += 1
        print(f"   ↳ Petición página {loop_count} (Offset: {offset})...")

        params = {
            'access_key': API_KEY,
            'arr_iata': 'BCN',
            'limit': limit,
            'offset': offset
        }
        
        try:
            response = requests.get(BASE_URL, params=params)
            try:
                data = response.json()
            except:
                print(f"❌ Error JSON en página {loop_count}.")
                break
                
            if 'error' in data:
                print(f"❌ API Error: {data['error']}")
                # Si falla una página, salimos con lo que tengamos
                break

            # Obtenemos la lista de vuelos de esta página
            batch = data.get('data', [])
            todos_vuelos_raw.extend(batch)
            
            # Revisamos la paginación para saber si seguimos o paramos
            pagination = data.get('pagination', {})
            total_real = pagination.get('total', 0)
            count_actual = pagination.get('count', 0)
            
            print(f"      ✅ Recibidos: {count_actual} | Acumulados: {len(todos_vuelos_raw)} | Total API: {total_real}")

            # Si hemos conseguido todos, o si la API no devuelve más, o llegamos al límite de seguridad
            if len(todos_vuelos_raw) >= total_real or count_actual == 0 or loop_count >= max_loops:
                break
            
            # Preparamos el offset para la siguiente vuelta
            offset += limit
            
            # Pequeña pausa para no saturar si fuera necesario (opcional)
            # time.sleep(0.5) 

        except Exception as e:
            print(f"❌ Error de conexión en loop: {e}")
            break

    # --- PROCESAMIENTO DE DATOS (YA CON TODA LA LISTA COMPLETA) ---
    print(f"✨ Procesando {len(todos_vuelos_raw)} vuelos totales...")

    kpis = {
        "t1": {"vuelos": 0, "pax": 0},
        "t2": {"vuelos": 0, "pax": 0},
        "puente": {"vuelos": 0, "pax": 0}, 
        "t2c": {"vuelos": 0, "pax": 0}
    }
    evolucion_por_hora = {str(h).zfill(2): 0 for h in range(24)}
    lista_vuelos = []

    for flight in todos_vuelos_raw:
        try:
            # --- FILTRO 1: ESTADO DEL VUELO ---
            status_raw = flight.get('flight_status', 'scheduled')
            if status_raw in ['cancelled', 'diverted']:
                continue

            # --- EXTRACCIÓN ---
            arrival = flight.get('arrival') or {}
            departure = flight.get('departure') or {}
            airline_obj = flight.get('airline') or {}
            flight_obj = flight.get('flight') or {}
            aircraft_obj = flight.get('aircraft') or {}

            # --- LÓGICA DE TIEMPO ---
            hora_str = arrival.get('estimated')
            if not hora_str:
                hora_str = arrival.get('scheduled')
            
            if not hora_str:
                continue

            # Procesamos la hora
            try:
                dt_llegada = datetime.fromisoformat(hora_str.replace("Z", "+00:00"))
            except ValueError:
                # Fallback por si el formato fecha viene raro
                continue

            hora_corta = dt_llegada.strftime("%H:%M")
            hora_bloque = dt_llegada.strftime("%H")

            # --- RESTO DE LÓGICA ---
            airline = airline_obj.get('name', 'Desconocida')
            flight_iata = flight_obj.get('iata', 'UNK')
            modelo_avion = aircraft_obj.get('iata', 'Jet')
            
            terminal = arrival.get('terminal')
            if not terminal:
                if airline in ["Vueling", "Iberia", "Lufthansa", "British Airways", "Qatar Airways"]: terminal = "1"
                elif airline in ["Ryanair", "EasyJet", "Wizz Air", "Transavia"]: terminal = "2"
                else: terminal = "1"

            origen_iata = departure.get('iata', 'UNK')
            es_puente = (origen_iata == "MAD" and airline in ["Iberia", "Vueling", "Air Nostrum"])
            es_easyjet = ("easyJet" in airline)

            pax = 160
            if es_puente: pax = 180
            elif es_easyjet: pax = 170
            elif modelo_avion in ["380", "747", "777", "350"]: pax = 300 
            
            # KPIs
            if str(terminal) == "1":
                kpis["t1"]["vuelos"] += 1
                kpis["t1"]["pax"] += pax
                if es_puente:
                    kpis["puente"]["vuelos"] += 1
                    kpis["puente"]["pax"] += pax
            elif str(terminal) == "2":
                kpis["t2"]["vuelos"] += 1
                kpis["t2"]["pax"] += pax
                if es_easyjet:
                    kpis["t2c"]["vuelos"] += 1
                    kpis["t2c"]["pax"] += pax

            if hora_bloque in evolucion_por_hora:
                evolucion_por_hora[hora_bloque] += pax

            estado_ui = "En hora"
            estilo_estado = "secondary"
            if status_raw in ["active", "landed"]:
                estado_ui = "Aterrizando"
                estilo_estado = "warning"
            
            lista_vuelos.append({
                "id": flight_iata,
                "aerolinea": airline,
                "origen": departure.get('airport', origen_iata),
                "hora": hora_corta,
                "terminal": f"T{terminal}",
                "es_puente": es_puente,
                "es_t2c": es_easyjet,
                "avion": f"{modelo_avion}",
                "pax": pax,
                "estado": estado_ui,
                "estado_color": estilo_estado
            })
        
        except Exception:
            continue

    lista_vuelos.sort(key=lambda x: x['hora'])

    resultado = {
        "meta": {
            "update_time": datetime.now().strftime("%H:%M"),
            "total_vuelos": len(lista_vuelos),
            "total_api_calls": loop_count # Dato útil para controlar tu quota
        },
        "resumen_cards": kpis,
        "grafica": [{"name": h, "pax": p} for h, p in evolucion_por_hora.items()],
        "vuelos": lista_vuelos,
        "extras": {
            "licencia": 152000,
            "licencia_tendencia": "+1.2%",
            "clima_prob": 75,
            "clima_estado": "Lluvia"
        }
    }
    return resultado

if __name__ == "__main__":
    datos = obtener_datos()
    if datos:
        # GUARDADO SEGURO
        output_file = str(OUTPUT_FILES.get('data_api', 'public/data.json'))
        
        success, message = safe_save_json(
            filepath=output_file,
            data=datos,
            min_items=1,  # Es un dict, no lista
            backup=True
        )
        
        if success:
            logger.info("✅ Datos iTaxiBcn generados correctamente")
            logger.info(message)
        else:
            logger.error(message)
            logger.error("❌ Validación fallida. Archivo existente NO modificado.")
            sys.exit(1)
    else:
        logger.error("❌ No se pudieron obtener datos. Archivo existente NO modificado.")
        sys.exit(1)
