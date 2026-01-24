"""
=============================================================================
SCRAPER UTILS - Utilidades para robustez del pipeline de datos
=============================================================================
Autor: Data Engineering
Descripción: Módulo con funciones de validación, safe-write, logging y retry
             para prevenir pérdida de datos por errores de scraping.
"""

import json
import os
import shutil
import logging
from datetime import datetime
from functools import wraps
import time
from typing import Any, Callable, Dict, List, Optional, Union

# =============================================================================
# LOGGING CONFIGURADO
# =============================================================================
def setup_logger(name: str, log_file: Optional[str] = None) -> logging.Logger:
    """
    Configura un logger estructurado con formato consistente.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    
    # Evitar duplicar handlers si ya existen
    if logger.handlers:
        return logger
    
    # Formato consistente
    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Handler de consola
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Handler de archivo (opcional)
    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

# =============================================================================
# VALIDACIÓN DE DATOS
# =============================================================================
class DataValidator:
    """
    Clase para validar datos antes de guardarlos.
    """
    
    @staticmethod
    def is_valid_json_list(data: Any, min_items: int = 1) -> bool:
        """Verifica que sea una lista con mínimo de elementos."""
        return isinstance(data, list) and len(data) >= min_items
    
    @staticmethod
    def is_valid_json_dict(data: Any, required_keys: List[str] = None) -> bool:
        """Verifica que sea un dict con las claves requeridas."""
        if not isinstance(data, dict):
            return False
        if required_keys:
            return all(key in data for key in required_keys)
        return len(data) > 0
    
    @staticmethod
    def validate_flight_data(data: List[Dict]) -> tuple[bool, str]:
        """Valida estructura de datos de vuelos."""
        if not data:
            return False, "Lista de vuelos vacía"
        
        required_fields = ['hora', 'terminal']
        for i, vuelo in enumerate(data[:5]):  # Verificar primeros 5
            for field in required_fields:
                if field not in vuelo or not vuelo[field]:
                    return False, f"Vuelo {i} sin campo '{field}'"
        
        return True, "OK"
    
    @staticmethod
    def validate_train_data(data: List[Dict]) -> tuple[bool, str]:
        """Valida estructura de datos de trenes."""
        if not data:
            return False, "Lista de trenes vacía"
        
        required_fields = ['hora', 'tren']
        for i, tren in enumerate(data[:5]):
            for field in required_fields:
                if field not in tren or not tren[field]:
                    return False, f"Tren {i} sin campo '{field}'"
        
        return True, "OK"
    
    @staticmethod
    def validate_license_data(data: List[Dict]) -> tuple[bool, str]:
        """Valida estructura de datos de licencias."""
        if not data:
            return False, "Lista de licencias vacía"
        
        if len(data) < 3:  # Mínimo razonable de ofertas
            return False, f"Solo {len(data)} ofertas (mínimo esperado: 3)"
        
        return True, "OK"
    
    @staticmethod
    def validate_web_feed(data: Dict) -> tuple[bool, str]:
        """Valida estructura del feed web de licencias."""
        required_keys = ['ticker', 'charts', 'market_depth', 'updated_at']

        if not isinstance(data, dict):
            return False, "No es un diccionario"

        for key in required_keys:
            if key not in data:
                return False, f"Falta clave '{key}'"

        if 'ticker' in data and 'current_price' in data['ticker']:
            if data['ticker']['current_price'] <= 0:
                return False, "Precio actual es 0 o negativo"

        return True, "OK"

    @staticmethod
    def validate_cruise_data(data: Dict) -> tuple[bool, str]:
        """Valida estructura de datos de cruceros."""
        if not isinstance(data, dict):
            return False, "No es un diccionario"

        required_keys = ['llegadas', 'salidas', 'resumen', 'metadata']
        for key in required_keys:
            if key not in data:
                return False, f"Falta clave '{key}'"

        # Verificar que llegadas y salidas son listas
        if not isinstance(data.get('llegadas'), list):
            return False, "llegadas no es una lista"
        if not isinstance(data.get('salidas'), list):
            return False, "salidas no es una lista"

        # Validar estructura de cruceros individuales (si hay datos)
        for i, crucero in enumerate(data['llegadas'][:3]):
            if 'hora' not in crucero or 'nombre' not in crucero:
                return False, f"Crucero llegada {i} sin campos requeridos"

        for i, crucero in enumerate(data['salidas'][:3]):
            if 'hora' not in crucero or 'nombre' not in crucero:
                return False, f"Crucero salida {i} sin campos requeridos"

        return True, "OK"


# =============================================================================
# SAFE WRITE - ESCRITURA SEGURA CON COMPARACIÓN
# =============================================================================
class SafeWriter:
    """
    Clase para guardar archivos de forma segura:
    - Compara con datos existentes
    - No sobrescribe si nuevos datos son peores
    - Crea backups automáticos
    """
    
    def __init__(self, logger: logging.Logger = None):
        self.logger = logger or setup_logger('SafeWriter')
    
    def write_json(
        self,
        filepath: str,
        new_data: Union[List, Dict],
        validator_func: Callable[[Any], tuple[bool, str]] = None,
        min_items: int = None,
        force: bool = False,
        backup: bool = True
    ) -> tuple[bool, str]:
        """
        Guarda JSON de forma segura, comparando con datos existentes.
        
        Args:
            filepath: Ruta del archivo a guardar
            new_data: Datos nuevos a guardar
            validator_func: Función de validación específica (opcional)
            min_items: Mínimo de items requeridos (para listas)
            force: Si es True, sobrescribe sin importar validación
            backup: Si es True, crea backup antes de sobrescribir
        
        Returns:
            tuple(éxito: bool, mensaje: str)
        """
        # 1. Validar datos nuevos
        if not force:
            # Validación básica
            if new_data is None:
                return False, "❌ Datos nuevos son None - NO SE SOBRESCRIBE"
            
            if isinstance(new_data, list):
                if len(new_data) == 0:
                    return False, "❌ Lista vacía - NO SE SOBRESCRIBE"
                if min_items and len(new_data) < min_items:
                    return False, f"❌ Solo {len(new_data)} items (mínimo: {min_items}) - NO SE SOBRESCRIBE"
            
            elif isinstance(new_data, dict):
                if len(new_data) == 0:
                    return False, "❌ Diccionario vacío - NO SE SOBRESCRIBE"
            
            # Validación específica
            if validator_func:
                is_valid, msg = validator_func(new_data)
                if not is_valid:
                    return False, f"❌ Validación fallida: {msg} - NO SE SOBRESCRIBE"
        
        # 2. Comparar con datos existentes
        existing_data = None
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                
                # Comparación de calidad
                if not force and isinstance(new_data, list) and isinstance(existing_data, list):
                    if len(new_data) < len(existing_data) * 0.5:  # Menos del 50% de antes
                        self.logger.warning(
                            f"⚠️ Nuevos datos ({len(new_data)}) son <50% de existentes ({len(existing_data)})"
                        )
                        # Aún así guardamos pero con advertencia
                
            except (json.JSONDecodeError, Exception) as e:
                self.logger.warning(f"⚠️ No se pudo leer archivo existente: {e}")
        
        # 3. Crear backup si existe archivo previo
        if backup and existing_data is not None:
            backup_path = self._create_backup(filepath)
            if backup_path:
                self.logger.info(f"📦 Backup creado: {backup_path}")
        
        # 4. Guardar nuevos datos
        try:
            os.makedirs(os.path.dirname(filepath) or '.', exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(new_data, f, ensure_ascii=False, indent=4)
            
            items_count = len(new_data) if isinstance(new_data, (list, dict)) else 1
            return True, f"✅ Guardado exitoso: {items_count} items en {filepath}"
            
        except Exception as e:
            return False, f"❌ Error al guardar: {e}"
    
    def _create_backup(self, filepath: str) -> Optional[str]:
        """Crea backup con timestamp."""
        if not os.path.exists(filepath):
            return None
        
        backup_dir = os.path.join(os.path.dirname(filepath), 'backups')
        os.makedirs(backup_dir, exist_ok=True)
        
        filename = os.path.basename(filepath)
        name, ext = os.path.splitext(filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"{name}_{timestamp}{ext}"
        backup_path = os.path.join(backup_dir, backup_name)
        
        try:
            shutil.copy2(filepath, backup_path)
            return backup_path
        except Exception as e:
            self.logger.error(f"Error creando backup: {e}")
            return None


# =============================================================================
# RETRY DECORATOR
# =============================================================================
def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exceptions: tuple = (Exception,)
):
    """
    Decorador para reintentar funciones con backoff exponencial.
    
    Args:
        max_retries: Número máximo de reintentos
        base_delay: Delay inicial en segundos
        max_delay: Delay máximo en segundos
        exceptions: Tupla de excepciones a capturar
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = kwargs.get('logger') or setup_logger('Retry')
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        logger.warning(
                            f"⚠️ Intento {attempt + 1}/{max_retries + 1} fallido: {e}. "
                            f"Reintentando en {delay:.1f}s..."
                        )
                        time.sleep(delay)
                    else:
                        logger.error(f"❌ Todos los reintentos fallidos: {e}")
            
            raise last_exception
        return wrapper
    return decorator


# =============================================================================
# FUNCIONES DE CONVENIENCIA
# =============================================================================
def safe_save_json(filepath: str, data: Any, data_type: str = 'generic', **kwargs) -> tuple[bool, str]:
    """
    Función de conveniencia para guardar JSON con validación automática.
    
    Args:
        filepath: Ruta del archivo
        data: Datos a guardar
        data_type: Tipo de datos ('flights', 'trains', 'licenses', 'web_feed', 'generic')
    
    Returns:
        tuple(éxito, mensaje)
    """
    writer = SafeWriter()
    validator = DataValidator()
    
    # Seleccionar validador según tipo
    validators = {
        'flights': validator.validate_flight_data,
        'trains': validator.validate_train_data,
        'licenses': validator.validate_license_data,
        'web_feed': validator.validate_web_feed,
        'cruises': validator.validate_cruise_data,
    }
    
    validator_func = validators.get(data_type)
    
    return writer.write_json(
        filepath=filepath,
        new_data=data,
        validator_func=validator_func,
        **kwargs
    )


def load_existing_or_default(filepath: str, default: Any = None) -> Any:
    """
    Carga datos existentes o retorna default si no existen/hay error.
    """
    if not os.path.exists(filepath):
        return default
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return default
