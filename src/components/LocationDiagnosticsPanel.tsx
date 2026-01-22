/**
 * Location Diagnostics Panel
 * Shows real-time location tracking status with clear messages
 */

import { useState, useEffect } from 'react';
import { MapPin, Play, Square, RefreshCw, AlertCircle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    startLocationDiagnostics,
    stopLocationDiagnostics,
    forceLocationCheck,
    getDiagnosticsStatus,
    requestLocationPermission,
    type DiagnosticStatus
} from '@/services/locationDiagnostics';

interface Props {
    deviceName?: string;
}

export function LocationDiagnosticsPanel({ deviceName }: Props) {
    const [isActive, setIsActive] = useState(false);
    const [logs, setLogs] = useState<DiagnosticStatus[]>([]);
    const [currentStatus, setCurrentStatus] = useState<DiagnosticStatus | null>(null);
    const [nameInput, setNameInput] = useState(deviceName || '');
    const [isRequesting, setIsRequesting] = useState(false);

    useEffect(() => {
        const status = getDiagnosticsStatus();
        setIsActive(status.isActive);
        if (status.deviceName) setNameInput(status.deviceName);
    }, []);

    const handleStart = () => {
        startLocationDiagnostics(nameInput || 'Usuario', (status) => {
            setCurrentStatus(status);
            setLogs(prev => [status, ...prev.slice(0, 19)]); // Keep last 20
        });
        setIsActive(true);
    };

    const handleStop = () => {
        stopLocationDiagnostics();
        setIsActive(false);
    };

    const handleForceCheck = async () => {
        setIsRequesting(true);
        const status = await forceLocationCheck();
        setCurrentStatus(status);
        setLogs(prev => [status, ...prev.slice(0, 19)]);
        setIsRequesting(false);
    };

    const handleRequestPermission = async () => {
        setIsRequesting(true);
        const result = await requestLocationPermission();
        if (result.granted) {
            handleForceCheck();
        } else {
            setCurrentStatus({
                timestamp: new Date(),
                checkNumber: 0,
                hasLocation: false,
                error: result.error,
                isSecureContext: true,
                geolocationSupported: true,
                message: `❌ ERROR: ${result.error}`
            });
        }
        setIsRequesting(false);
    };

    const getStatusIcon = (status: DiagnosticStatus) => {
        if (status.hasLocation) {
            return <CheckCircle className="h-4 w-4 text-emerald-400" />;
        }
        return <AlertCircle className="h-4 w-4 text-red-400" />;
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="card-glass p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MapPin className={cn(
                        "h-5 w-5",
                        isActive ? "text-emerald-400" : "text-muted-foreground"
                    )} />
                    <span className="font-semibold text-white">Diagnóstico de Ubicación</span>
                </div>
                <div className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-muted-foreground/20 text-muted-foreground"
                )}>
                    {isActive ? "ACTIVO" : "INACTIVO"}
                </div>
            </div>

            {/* Device Name Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nombre del dispositivo"
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    disabled={isActive}
                />
                <button
                    onClick={isActive ? handleStop : handleStart}
                    disabled={!nameInput && !isActive}
                    className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                        isActive
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
                        (!nameInput && !isActive) && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {isActive ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isActive ? "Detener" : "Iniciar"}
                </button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
                <button
                    onClick={handleForceCheck}
                    disabled={isRequesting}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
                >
                    <RefreshCw className={cn("h-4 w-4", isRequesting && "animate-spin")} />
                    Comprobar Ahora
                </button>
                <button
                    onClick={handleRequestPermission}
                    disabled={isRequesting}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm transition-colors"
                >
                    <MapPin className="h-4 w-4" />
                    Pedir Permiso
                </button>
            </div>

            {/* Current Status */}
            {currentStatus && (
                <div className={cn(
                    "p-3 rounded-lg border",
                    currentStatus.hasLocation
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-red-500/10 border-red-500/30"
                )}>
                    <div className="flex items-start gap-2">
                        {getStatusIcon(currentStatus)}
                        <div className="flex-1">
                            <p className="text-sm font-medium text-white">
                                Check #{currentStatus.checkNumber} - {formatTime(currentStatus.timestamp)}
                            </p>
                            <p className={cn(
                                "text-sm mt-1",
                                currentStatus.hasLocation ? "text-emerald-400" : "text-red-400"
                            )}>
                                {currentStatus.message}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Info */}
            <p className="text-xs text-muted-foreground">
                ⏱️ Comprueba la ubicación cada 30 segundos y muestra el resultado
            </p>

            {/* Logs */}
            {logs.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Historial de comprobaciones:</p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {logs.map((log, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex items-center gap-2 p-2 rounded text-xs",
                                    log.hasLocation ? "bg-emerald-500/5" : "bg-red-500/5"
                                )}
                            >
                                {log.hasLocation ? (
                                    <Wifi className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                                ) : (
                                    <WifiOff className="h-3 w-3 text-red-400 flex-shrink-0" />
                                )}
                                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground">
                                    {formatTime(log.timestamp)}
                                </span>
                                <span className={cn(
                                    "truncate",
                                    log.hasLocation ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {log.hasLocation
                                        ? `${log.latitude?.toFixed(4)}, ${log.longitude?.toFixed(4)}`
                                        : log.error || 'Error'
                                    }
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
