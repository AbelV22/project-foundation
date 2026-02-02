import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import {
  VueloRaw,
  TrenSants,
  CrucerosData,
  EventosBcn,
  LicenciasWebFeed,
  getVuelos,
  getTrenes,
  getCruceros,
  getEventos,
  getLicenciasWebFeed,
  getLicenciasHistory,
  getDashboardData,
  subscribe,
  invalidateCache,
  startAutoRefresh,
  stopAllAutoRefresh,
  getCacheStats
} from '@/services/dataService';
import {
  AnalisisMercado,
  obtenerAnalisisMercado,
  invalidarCacheLicencias,
} from '@/services/licenciasService';

// Context State Type
interface DataContextState {
  // Data
  vuelos: VueloRaw[];
  trenes: TrenSants[];
  cruceros: CrucerosData | null;
  eventos: EventosBcn[];
  licencias: LicenciasWebFeed | null;
  licenciasHistory: string;

  // Loading states
  loading: {
    vuelos: boolean;
    trenes: boolean;
    cruceros: boolean;
    eventos: boolean;
    licencias: boolean;
    global: boolean;
  };

  // Errors
  errors: {
    vuelos: Error | null;
    trenes: Error | null;
    cruceros: Error | null;
    eventos: Error | null;
    licencias: Error | null;
  };

  // Actions
  refreshVuelos: () => Promise<void>;
  refreshTrenes: () => Promise<void>;
  refreshCruceros: () => Promise<void>;
  refreshEventos: () => Promise<void>;
  refreshLicencias: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // Utils
  getCacheStats: () => Record<string, { valid: boolean; age: number; ttl: number }>;
}

// Default context value
const defaultState: DataContextState = {
  vuelos: [],
  trenes: [],
  cruceros: null,
  eventos: [],
  licencias: null,
  licenciasHistory: '',
  loading: {
    vuelos: true,
    trenes: true,
    cruceros: true,
    eventos: true,
    licencias: true,
    global: true,
  },
  errors: {
    vuelos: null,
    trenes: null,
    cruceros: null,
    eventos: null,
    licencias: null,
  },
  refreshVuelos: async () => {},
  refreshTrenes: async () => {},
  refreshCruceros: async () => {},
  refreshEventos: async () => {},
  refreshLicencias: async () => {},
  refreshAll: async () => {},
  getCacheStats: () => ({}),
};

// Create Context
const DataContext = createContext<DataContextState>(defaultState);

// Provider Props
interface DataProviderProps {
  children: ReactNode;
  autoRefresh?: boolean;
}

// Provider Component
export function DataProvider({ children, autoRefresh = true }: DataProviderProps) {
  // Data states
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [trenes, setTrenes] = useState<TrenSants[]>([]);
  const [cruceros, setCruceros] = useState<CrucerosData | null>(null);
  const [eventos, setEventos] = useState<EventosBcn[]>([]);
  const [licencias, setLicencias] = useState<LicenciasWebFeed | null>(null);
  const [licenciasHistory, setLicenciasHistory] = useState<string>('');

  // Loading states
  const [loading, setLoading] = useState({
    vuelos: true,
    trenes: true,
    cruceros: true,
    eventos: true,
    licencias: true,
    global: true,
  });

  // Error states
  const [errors, setErrors] = useState({
    vuelos: null as Error | null,
    trenes: null as Error | null,
    cruceros: null as Error | null,
    eventos: null as Error | null,
    licencias: null as Error | null,
  });

  // Update loading helper
  const setLoadingFor = useCallback((key: keyof typeof loading, value: boolean) => {
    setLoading(prev => {
      const newLoading = { ...prev, [key]: value };
      // Global is false when all are done
      newLoading.global = Object.entries(newLoading)
        .filter(([k]) => k !== 'global')
        .some(([_, v]) => v);
      return newLoading;
    });
  }, []);

  // Set error helper
  const setErrorFor = useCallback((key: keyof typeof errors, error: Error | null) => {
    setErrors(prev => ({ ...prev, [key]: error }));
  }, []);

  // Refresh functions
  const refreshVuelos = useCallback(async () => {
    setLoadingFor('vuelos', true);
    setErrorFor('vuelos', null);
    try {
      invalidateCache('vuelos');
      const data = await getVuelos();
      setVuelos(data);
    } catch (e) {
      setErrorFor('vuelos', e as Error);
    } finally {
      setLoadingFor('vuelos', false);
    }
  }, [setLoadingFor, setErrorFor]);

  const refreshTrenes = useCallback(async () => {
    setLoadingFor('trenes', true);
    setErrorFor('trenes', null);
    try {
      invalidateCache('trenes');
      const data = await getTrenes();
      setTrenes(data);
    } catch (e) {
      setErrorFor('trenes', e as Error);
    } finally {
      setLoadingFor('trenes', false);
    }
  }, [setLoadingFor, setErrorFor]);

  const refreshCruceros = useCallback(async () => {
    setLoadingFor('cruceros', true);
    setErrorFor('cruceros', null);
    try {
      invalidateCache('cruceros');
      const data = await getCruceros();
      setCruceros(data);
    } catch (e) {
      setErrorFor('cruceros', e as Error);
    } finally {
      setLoadingFor('cruceros', false);
    }
  }, [setLoadingFor, setErrorFor]);

  const refreshEventos = useCallback(async () => {
    setLoadingFor('eventos', true);
    setErrorFor('eventos', null);
    try {
      invalidateCache('eventos');
      const data = await getEventos();
      setEventos(data);
    } catch (e) {
      setErrorFor('eventos', e as Error);
    } finally {
      setLoadingFor('eventos', false);
    }
  }, [setLoadingFor, setErrorFor]);

  const refreshLicencias = useCallback(async () => {
    setLoadingFor('licencias', true);
    setErrorFor('licencias', null);
    try {
      invalidateCache('licencias');
      invalidateCache('historyStats');
      const [feed, history] = await Promise.all([
        getLicenciasWebFeed(),
        getLicenciasHistory()
      ]);
      setLicencias(feed);
      setLicenciasHistory(history);
    } catch (e) {
      setErrorFor('licencias', e as Error);
    } finally {
      setLoadingFor('licencias', false);
    }
  }, [setLoadingFor, setErrorFor]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshVuelos(),
      refreshTrenes(),
      refreshCruceros(),
      refreshEventos(),
      refreshLicencias(),
    ]);
  }, [refreshVuelos, refreshTrenes, refreshCruceros, refreshEventos, refreshLicencias]);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('[DataContext] Loading initial data...');

      // Load dashboard data in parallel
      try {
        const [dashData, licenciasData, historyData] = await Promise.all([
          getDashboardData(),
          getLicenciasWebFeed(),
          getLicenciasHistory()
        ]);

        setVuelos(dashData.vuelos);
        setTrenes(dashData.trenes);
        setCruceros(dashData.cruceros);
        setEventos(dashData.eventos);
        setLicencias(licenciasData);
        setLicenciasHistory(historyData);

        console.log('[DataContext] Initial data loaded');
      } catch (e) {
        console.error('[DataContext] Error loading initial data:', e);
      } finally {
        setLoading({
          vuelos: false,
          trenes: false,
          cruceros: false,
          eventos: false,
          licencias: false,
          global: false,
        });
      }
    };

    loadInitialData();
  }, []);

  // Subscribe to updates from dataService
  useEffect(() => {
    const unsubVuelos = subscribe<VueloRaw[]>('vuelos', setVuelos);
    const unsubTrenes = subscribe<TrenSants[]>('trenes', setTrenes);
    const unsubCruceros = subscribe<CrucerosData>('cruceros', setCruceros);
    const unsubEventos = subscribe<EventosBcn[]>('eventos', setEventos);
    const unsubLicencias = subscribe<LicenciasWebFeed>('licencias', setLicencias);

    return () => {
      unsubVuelos();
      unsubTrenes();
      unsubCruceros();
      unsubEventos();
      unsubLicencias();
    };
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    console.log('[DataContext] Starting auto-refresh...');
    startAutoRefresh('vuelos');
    startAutoRefresh('trenes');
    startAutoRefresh('cruceros');
    startAutoRefresh('eventos');
    startAutoRefresh('licencias');

    return () => {
      console.log('[DataContext] Stopping auto-refresh...');
      stopAllAutoRefresh();
    };
  }, [autoRefresh]);

  const value: DataContextState = {
    vuelos,
    trenes,
    cruceros,
    eventos,
    licencias,
    licenciasHistory,
    loading,
    errors,
    refreshVuelos,
    refreshTrenes,
    refreshCruceros,
    refreshEventos,
    refreshLicencias,
    refreshAll,
    getCacheStats,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

// Hook to use data context
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

// Specialized hooks for specific data
export function useVuelos() {
  const { vuelos, loading, errors, refreshVuelos } = useData();
  return {
    vuelos,
    loading: loading.vuelos,
    error: errors.vuelos,
    refresh: refreshVuelos,
  };
}

export function useTrenes() {
  const { trenes, loading, errors, refreshTrenes } = useData();
  return {
    trenes,
    loading: loading.trenes,
    error: errors.trenes,
    refresh: refreshTrenes,
  };
}

export function useCruceros() {
  const { cruceros, loading, errors, refreshCruceros } = useData();
  return {
    cruceros,
    loading: loading.cruceros,
    error: errors.cruceros,
    refresh: refreshCruceros,
  };
}

export function useEventosData() {
  const { eventos, loading, errors, refreshEventos } = useData();
  return {
    eventos,
    loading: loading.eventos,
    error: errors.eventos,
    refresh: refreshEventos,
  };
}

export function useLicencias() {
  const { licencias, licenciasHistory, loading, errors, refreshLicencias } = useData();
  return {
    licencias,
    history: licenciasHistory,
    loading: loading.licencias,
    error: errors.licencias,
    refresh: refreshLicencias,
  };
}

// ============================================
// ADVANCED LICENCIAS HOOK
// Uses the specialized licenciasService for rich data
// ============================================

/**
 * Hook avanzado para datos de licencias con análisis completo
 */
export function useLicenciasAnalisis() {
  const [analisis, setAnalisis] = useState<AnalisisMercado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAnalisis = useCallback(async () => {
    try {
      setLoading(true);
      const data = await obtenerAnalisisMercado();
      setAnalisis(data);
      setError(null);
    } catch (e) {
      setError(e as Error);
      console.error('[useLicenciasAnalisis] Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    invalidarCacheLicencias();
    await fetchAnalisis();
  }, [fetchAnalisis]);

  // Initial load
  useEffect(() => {
    fetchAnalisis();
  }, [fetchAnalisis]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchAnalisis();
    }, 5 * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchAnalisis]);

  return {
    // Full analysis data
    analisis,

    // Convenience accessors
    ticker: analisis?.ticker ?? null,
    ofertas: analisis?.todasLasOfertas ?? [],
    ofertasBaratas: analisis?.ofertasMasBaratas ?? [],
    historial: analisis?.historial ?? [],
    porPortal: analisis?.porPortal ?? [],
    porDiaDescanso: analisis?.porDiaDescanso ?? [],
    mejorDia: analisis?.mejorDiaParaComprar ?? null,

    // Market metrics
    precioMercado: analisis?.precioMercado ?? 0,
    spread: analisis?.spread ?? 0,
    spreadPorcentaje: analisis?.spreadPorcentaje ?? 0,
    tendencia7D: analisis?.tendencia7D ?? 0,
    tendencia14D: analisis?.tendencia14D ?? 0,
    volatilidad7D: analisis?.volatilidad7D ?? 0,
    soporte: analisis?.soportePrecio ?? 0,
    resistencia: analisis?.resistenciaPrecio ?? 0,

    // State
    loading,
    error,

    // Actions
    refresh,
  };
}
