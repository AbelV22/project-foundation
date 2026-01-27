import { useState, useEffect } from "react";
import { ArrowLeft, Clock, Power, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setProSchedule } from "@/services/native/proTracking";
import { toast } from "sonner";
import { getItem, setItem } from "@/lib/storage";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SettingsView() {
    const [trackingEnabled, setTrackingEnabled] = useState(true);
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [startHour, setStartHour] = useState(8);
    const [endHour, setEndHour] = useState(20);
    const [loading, setLoading] = useState(true);

    // Load initial state
    useEffect(() => {
        const loadSettings = async () => {
            const storedTracking = await getItem('setting_tracking_enabled');
            const storedSchedule = await getItem('setting_schedule_enabled');
            const storedStart = await getItem('setting_start_hour');
            const storedEnd = await getItem('setting_end_hour');

            if (storedTracking !== null) setTrackingEnabled(storedTracking === 'true');
            if (storedSchedule !== null) setScheduleEnabled(storedSchedule === 'true');
            if (storedStart !== null) setStartHour(parseInt(storedStart));
            if (storedEnd !== null) setEndHour(parseInt(storedEnd));

            setLoading(false);
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        try {
            // Save JS side
            await setItem('setting_tracking_enabled', String(trackingEnabled));
            await setItem('setting_schedule_enabled', String(scheduleEnabled));
            await setItem('setting_start_hour', String(startHour));
            await setItem('setting_end_hour', String(endHour));

            // Push to Native
            await setProSchedule(startHour, endHour, scheduleEnabled, trackingEnabled);

            toast.success("Configuración guardada", {
                description: trackingEnabled
                    ? scheduleEnabled
                        ? `Tracking activo de ${startHour}:00 a ${endHour}:00`
                        : "Tracking activo 24h"
                    : "Tracking desactivado globalmente"
            });

        } catch (e) {
            console.error(e);
            toast.error("Error guardando configuración");
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando...</div>;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Volver
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Ajustes</h1>
            </div>

            <div className="max-w-md mx-auto space-y-8 mt-8">

                {/* Global Toggle */}
                <div className="card-dashboard p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <Power className="h-4 w-4 text-primary" />
                                Seguimiento de Ubicación
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Activa o desactiva completamente el radar.
                            </p>
                        </div>
                        <Switch
                            checked={trackingEnabled}
                            onCheckedChange={setTrackingEnabled}
                        />
                    </div>
                </div>

                {/* Schedule */}
                <div className={`card-dashboard p-6 space-y-6 ${!trackingEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4 text-purple-400" />
                                Horario de Trabajo
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                El radar solo funcionará en estas horas.
                            </p>
                        </div>
                        <Switch
                            checked={scheduleEnabled}
                            onCheckedChange={setScheduleEnabled}
                        />
                    </div>

                    {scheduleEnabled && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label>Hora Inicio</Label>
                                <Select value={startHour.toString()} onValueChange={(v) => setStartHour(Number(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOURS.map(h => (
                                            <SelectItem key={h} value={h.toString()}>{h}:00</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Hora Fin</Label>
                                <Select value={endHour.toString()} onValueChange={(v) => setEndHour(Number(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOURS.map(h => (
                                            <SelectItem key={h} value={h.toString()}>{h}:00</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                <Button onClick={handleSave} className="w-full" size="lg">
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                </Button>
            </div>
        </div>
    );
}
