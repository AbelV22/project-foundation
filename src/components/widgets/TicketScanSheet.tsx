import { useState, useRef } from "react";
import { Receipt, Camera, Check, Loader2, Pencil, Car, Euro, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTickets } from "@/hooks/useTickets";
import { useToast } from "@/hooks/use-toast";

export function TicketScanSheet() {
    const [open, setOpen] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Editable extracted values
    const [kmTotales, setKmTotales] = useState<string>("");
    const [ingresosTotales, setIngresosTotales] = useState<string>("");
    const [numCarreras, setNumCarreras] = useState<string>("");
    const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
    const [scanned, setScanned] = useState(false);
    const [rawResponse, setRawResponse] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { scanTicket, saveTicket, uploadPhoto, scanning } = useTickets();
    const { toast } = useToast();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Read as base64
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            setImagePreview(base64);
            setImageBase64(base64);

            // Auto-scan
            const result = await scanTicket(base64);
            if (result) {
                if (result.km_totales !== null) setKmTotales(String(result.km_totales));
                if (result.ingresos_totales !== null) setIngresosTotales(String(result.ingresos_totales));
                if (result.num_carreras !== null) setNumCarreras(String(result.num_carreras));
                setRawResponse(result.raw_response || null);
                setScanned(true);

                if (result.error) {
                    toast({
                        title: "Lectura parcial",
                        description: "No se pudieron leer todos los datos. Revisa y completa manualmente.",
                        variant: "destructive",
                    });
                }
            } else {
                toast({
                    title: "Error de lectura",
                    description: "No se pudo leer el ticket. Introduce los datos manualmente.",
                    variant: "destructive",
                });
                setScanned(true);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        const km = kmTotales ? parseFloat(kmTotales) : null;
        const ingresos = ingresosTotales ? parseFloat(ingresosTotales) : null;
        const carreras = numCarreras ? parseInt(numCarreras) : null;

        if (!km && !ingresos && !carreras) {
            toast({
                title: "Sin datos",
                description: "Introduce al menos un dato del ticket",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);

        // Upload photo if available
        let fotoUrl: string | null = null;
        if (imageBase64) {
            fotoUrl = await uploadPhoto(imageBase64);
        }

        const success = await saveTicket({
            fecha,
            km_totales: km,
            ingresos_totales: ingresos,
            num_carreras: carreras,
            foto_url: fotoUrl,
            datos_raw: rawResponse ? { raw: rawResponse } : null,
        });

        setSaving(false);

        if (success) {
            toast({
                title: "Ticket guardado",
                description: `${fecha} · ${ingresos ? ingresos + '€' : ''} ${km ? '· ' + km + ' km' : ''} ${carreras ? '· ' + carreras + ' carreras' : ''}`,
            });
            resetAndClose();
        } else {
            toast({
                title: "Error",
                description: "No se pudo guardar el ticket",
                variant: "destructive",
            });
        }
    };

    const resetAndClose = () => {
        setImagePreview(null);
        setImageBase64(null);
        setKmTotales("");
        setIngresosTotales("");
        setNumCarreras("");
        setFecha(new Date().toISOString().split('T')[0]);
        setScanned(false);
        setRawResponse(null);
        setOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <Drawer open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else setOpen(true); }}>
            <DrawerTrigger asChild>
                <button
                    className="fixed bottom-20 left-4 z-40 h-14 w-14 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 flex items-center justify-center text-white hover:bg-amber-400 transition-all active:scale-95"
                    aria-label="Escanear ticket"
                >
                    <Receipt className="h-6 w-6" />
                </button>
            </DrawerTrigger>

            <DrawerContent className="bg-slate-900 border-slate-700 max-h-[90vh]">
                <DrawerHeader className="text-center pb-2">
                    <DrawerTitle className="text-white text-xl flex items-center justify-center gap-2">
                        <Receipt className="h-5 w-5 text-amber-400" />
                        Ticket Taxitronic
                    </DrawerTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Sube la foto de tu ticket de fin de día
                    </p>
                </DrawerHeader>

                <div className="px-4 pb-2 space-y-4 overflow-y-auto">
                    {/* Date selector */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Fecha del ticket</label>
                        <Input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            className="bg-slate-800 border-slate-700 text-white"
                        />
                    </div>

                    {/* Photo capture area */}
                    {!imagePreview ? (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-40 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center gap-3 hover:border-amber-500/50 hover:bg-slate-800/50 transition-all"
                        >
                            <Camera className="h-10 w-10 text-slate-500" />
                            <span className="text-sm text-slate-400">Toca para hacer foto del ticket</span>
                        </button>
                    ) : (
                        <div className="relative">
                            <img
                                src={imagePreview}
                                alt="Ticket preview"
                                className="w-full h-40 object-cover rounded-xl"
                            />
                            {scanning && (
                                <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                                    <span className="text-sm text-white">Analizando ticket...</span>
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    setImagePreview(null);
                                    setImageBase64(null);
                                    setScanned(false);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Extracted / manual data fields */}
                    {(scanned || !imagePreview) && (
                        <div className="space-y-3">
                            {scanned && (
                                <div className="flex items-center gap-2 text-xs text-amber-400">
                                    <Pencil className="h-3 w-3" />
                                    <span>Datos extraídos — revisa y corrige si es necesario</span>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Route className="h-3 w-3" /> Km totales
                                    </label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0"
                                        value={kmTotales}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || /^\d+(\.\d{0,1})?$/.test(val)) {
                                                setKmTotales(val);
                                            }
                                        }}
                                        className={cn(
                                            "bg-slate-800 border-slate-700 text-white font-mono",
                                            kmTotales && "border-amber-500/50"
                                        )}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Euro className="h-3 w-3" /> Ingresos
                                    </label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={ingresosTotales}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || /^\d+(\.\d{0,2})?$/.test(val)) {
                                                setIngresosTotales(val);
                                            }
                                        }}
                                        className={cn(
                                            "bg-slate-800 border-slate-700 text-white font-mono",
                                            ingresosTotales && "border-amber-500/50"
                                        )}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Car className="h-3 w-3" /> Carreras
                                    </label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={numCarreras}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || /^\d+$/.test(val)) {
                                                setNumCarreras(val);
                                            }
                                        }}
                                        className={cn(
                                            "bg-slate-800 border-slate-700 text-white font-mono",
                                            numCarreras && "border-amber-500/50"
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DrawerFooter className="pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={saving || scanning || (!kmTotales && !ingresosTotales && !numCarreras)}
                        className="h-12 text-base font-semibold bg-amber-500 hover:bg-amber-400 text-black"
                    >
                        {saving ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
                        ) : scanning ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando...</>
                        ) : (
                            <><Check className="h-4 w-4 mr-2" /> Guardar Ticket</>
                        )}
                    </Button>
                    <DrawerClose asChild>
                        <Button variant="ghost" className="text-muted-foreground">
                            Cancelar
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
