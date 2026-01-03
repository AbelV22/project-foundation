import requests
import json
import os
from datetime import datetime

# CONFIGURACIÓN
API_KEY = os.environ.get("API_KEY") 
BASE_URL = "http://api.aviationstack.com/v1/flights"

def obtener_datos():
    print("📡 Iniciando escaneo de radar avanzado BCN...")
    
    params = {
        'access_key': API_KEY,
        'arr_iata': 'BCN',
        # 'flight_status': 'active' # Desactivado para asegurar datos en pruebas
    }
    
    try:
        response = requests.get(BASE_URL, params=params)
        data = response.json()
        
        # --- CONTADORES ---
        contadores = {
            "t1": {"vuelos": 0, "pax": 0},
            "t2": {"vuelos": 0, "pax": 0},
            "puente_aereo": {"vuelos": 0, "pax": 0}, # Subconjunto de T1
            "t2c_easyjet": {"vuelos": 0, "pax": 0}   # Subconjunto de T2
        }
        
        # --- LISTA COMPLETA PARA DESCARGAR/VISUALIZAR ---
        lista_vuelos_detallada = []

        if 'data' in data:
            for flight in data['data']:
                # 1. Extraer Datos Crudos
                arrival = flight.get('arrival', {})
                departure = flight.get('departure', {})
                airline_data = flight.get('airline', {})
                
                terminal = arrival.get('terminal')
                airline = airline_data.get('name', 'Desconocida')
                origen = departure.get('iata', 'UNK')
                flight_num = flight.get('flight', {}).get('iata', 'UNK')
                hora_llegada = arrival.get('estimated', '00:00')

                # 2. Lógica de Inferencia (Si falta terminal)
                if not terminal:
                    if airline in ["Vueling", "Iberia", "Lufthansa", "British Airways", "American Airlines", "Qatar Airways", "Emirates"]: 
                        terminal = "1"
                    elif airline in ["Ryanair", "EasyJet", "Wizz Air", "Transavia"]: 
                        terminal = "2"
                
                # 3. Clasificación Especial (La Lógica del Taxista)
                es_puente_aereo = (origen == "MAD" and airline in ["Iberia", "Vueling", "Air Nostrum"])
                es_easyjet = (airline == "easyJet" or "easyJet" in airline)

                # 4. Cálculo Pax (Estimación)
                pax_estimados = 160 # Valor por defecto
                if es_puente_aereo: pax_estimados = 180 # A320/A321 llenos
                elif es_easyjet: pax_estimados = 170
                elif airline == "Ryanair": pax_estimados = 185
                
                # 5. Sumar a los contadores
                # T1 General
                if str(terminal) == "1":
                    contadores["t1"]["vuelos"] += 1
                    contadores["t1"]["pax"] += pax_estimados
                    # Puente Aéreo (Es T1, pero lo contamos aparte también)
                    if es_puente_aereo:
                        contadores["puente_aereo"]["vuelos"] += 1
                        contadores["puente_aereo"]["pax"] += pax_estimados

                # T2 General
                elif str(terminal) == "2":
                    contadores["t2"]["vuelos"] += 1
                    contadores["t2"]["pax"] += pax_estimados
                    # EasyJet (Es T2, pero casi siempre operan en T2C)
                    if es_easyjet:
                        contadores["t2c_easyjet"]["vuelos"] += 1
                        contadores["t2c_easyjet"]["pax"] += pax_estimados

                # 6. GUARDAR EL DETALLE (Esto es lo que pedías)
                # Formateamos la hora para que quede limpia (ej: 14:30)
                hora_limpia = hora_llegada.split("T")[1][:5] if "T" in hora_llegada else hora_llegada
                
                vuelo_info = {
                    "vuelo": flight_num,
                    "hora": hora_limpia,
                    "origen": origen,
                    "aerolinea": airline,
                    "terminal": f"T{terminal}" + (" (Puente)" if es_puente_aereo else "") + ("C" if es_easyjet else ""),
                    "pax_est": pax_estimados
                }
                lista_vuelos_detallada.append(vuelo_info)

        # 7. ESTADOS SEMÁFORO
        def get_estado(pax, umbral_fuego, umbral_normal):
            return "FUEGO 🔥" if pax > umbral_fuego else ("Normal 🟢" if pax > umbral_normal else "Calma 🧊")

        # Generamos el JSON final
        resultado = {
            "meta": {
                "actualizado": datetime.now().strftime("%H:%M %d/%m"),
                "total_vuelos": len(lista_vuelos_detallada)
            },
            # KPI Cards (Resumen)
            "kpis": {
                "t1": {
                    "vuelos": contadores["t1"]["vuelos"], 
                    "pax": contadores["t1"]["pax"],
                    "estado": get_estado(contadores["t1"]["pax"], 1500, 500)
                },
                "t2": {
                    "vuelos": contadores["t2"]["vuelos"], 
                    "pax": contadores["t2"]["pax"],
                    "estado": get_estado(contadores["t2"]["pax"], 1000, 400)
                },
                "puente": {
                    "vuelos": contadores["puente_aereo"]["vuelos"], 
                    "pax": contadores["puente_aereo"]["pax"],
                    "nota": "Corredor MAD-BCN"
                },
                "t2c": {
                    "vuelos": contadores["t2c_easyjet"]["vuelos"], 
                    "pax": contadores["t2c_easyjet"]["pax"],
                    "nota": "Solo EasyJet"
                }
            },
            # LISTA COMPLETA DE VUELOS (Aquí está la info que faltaba)
            "lista_vuelos": lista_vuelos_detallada,
            
            # Datos fijos Fase 1
            "licencia": 152000, 
            "clima": {"estado": "Lluvia", "probabilidad": 75}
        }
        
        return resultado

    except Exception as e:
        print(f"❌ Error crítico: {e}")
        return None

if __name__ == "__main__":
    datos = obtener_datos()
    if datos:
        with open('public/data.json', 'w') as f:
            json.dump(datos, f)
        print("✅ Datos guardados con detalle de Puente Aéreo y T2C")
