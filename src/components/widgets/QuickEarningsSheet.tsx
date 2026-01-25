import { useState } from "react";
import { Euro, CreditCard, Banknote, Check, Plus, ChevronDown } from "lucide-react";
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
import { useEarnings, RideCategory } from "@/hooks/useEarnings";
import { useToast } from "@/hooks/use-toast";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Preset amounts for quick selection
const PRESET_AMOUNTS = [8, 12, 18, 25, 35];

interface QuickEarningsSheetProps {
    currentZone?: string | null;
}

export function QuickEarningsSheet({ currentZone }: QuickEarningsSheetProps) {
    const [open, setOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState<string>("");
    const [propina, setPropina] = useState<number>(0);
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta'>('efectivo');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [startKm, setStartKm] = useState<string>("");
    const [endKm, setEndKm] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const { addCarrera, stats } = useEarnings();
    const { toast } = useToast();

    // Determine ride category from current zone
    const getRideCategory = (): RideCategory | undefined => {
        if (!currentZone) return undefined;
        const zone = currentZone.toLowerCase();
        if (zone.includes('t1') || zone.includes('t2') || zone.includes('puente') || zone.includes('aeropuerto')) {
            return 'airport';
        }
        if (zone.includes('sants') || zone.includes('tren')) {
            return 'train_station';
        }
        return 'street';
    };

    const handleAmountSelect = (amount: number) => {
        setSelectedAmount(amount);
        setCustomAmount("");
    };

    const handleCustomAmount = (value: string) => {
        // Only allow valid numbers
        if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) {
            setCustomAmount(value);
            setSelectedAmount(null);
        }
    };

    const getFinalAmount = (): number | null => {
        if (selectedAmount !== null) return selectedAmount;
        if (customAmount) return parseFloat(customAmount);
        return null;
    };

    const handleSave = async () => {
        const amount = getFinalAmount();
        if (!amount || amount <= 0) {
            toast({
                title: "Error",
                description: "Selecciona o introduce un importe válido",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);
        const success = await addCarrera(
            amount,
            propina,
            metodoPago,
            currentZone || undefined,
            startKm ? parseInt(startKm) : undefined,
            endKm ? parseInt(endKm) : undefined,
            getRideCategory()
        );
        setSaving(false);

        if (success) {
            toast({
                title: "✅ Carrera guardada",
                description: `${amount}€${propina > 0 ? ` + ${propina}€ propina` : ""}`,
            });
            // Reset and close
            setSelectedAmount(null);
            setCustomAmount("");
            setPropina(0);
            setMetodoPago('efectivo');
            setStartKm("");
            setEndKm("");
            setShowAdvanced(false);
            setOpen(false);
        } else {
            toast({
                title: "Error",
                description: "No se pudo guardar la carrera",
                variant: "destructive",
            });
        }
    };

    const finalAmount = getFinalAmount();

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <button
                    className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-white hover:bg-primary/90 transition-all active:scale-95"
                    aria-label="Añadir carrera"
                >
                    <Plus className="h-6 w-6" />
                </button>
            </DrawerTrigger>

            <DrawerContent className="bg-slate-900 border-slate-700">
                <DrawerHeader className="text-center pb-2">
                    <DrawerTitle className="text-white text-xl flex items-center justify-center gap-2">
                        <Euro className="h-5 w-5 text-primary" />
                        Añadir Carrera
                    </DrawerTitle>
                    {stats.today > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Hoy: {stats.todayCount} carreras · {stats.today.toFixed(0)}€
                        </p>
                    )}
                </DrawerHeader>

                <div className="px-4 pb-2 space-y-4">
                    {/* Preset Amount Buttons */}
                    <div className="grid grid-cols-5 gap-2">
                        {PRESET_AMOUNTS.map((amount) => (
                            <button
                                key={amount}
                                onClick={() => handleAmountSelect(amount)}
                                className={cn(
                                    "h-14 rounded-xl font-mono text-lg font-bold transition-all active:scale-95",
                                    selectedAmount === amount
                                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                                        : "bg-slate-800 text-white/80 hover:bg-slate-700"
                                )}
                            >
                                {amount}€
                            </button>
                        ))}
                    </div>

                    {/* Custom Amount Input */}
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Otro importe..."
                            value={customAmount}
                            onChange={(e) => handleCustomAmount(e.target.value)}
                            className={cn(
                                "w-full h-12 px-4 rounded-xl bg-slate-800 text-white font-mono text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2",
                                customAmount ? "ring-2 ring-primary" : "focus:ring-primary"
                            )}
                        />
                        {customAmount && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold">€</span>
                        )}
                    </div>

                    {/* Tip Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Propina:</span>
                        <div className="flex gap-1.5 flex-1">
                            {[0, 1, 2, 5].map((tip) => (
                                <button
                                    key={tip}
                                    onClick={() => setPropina(tip)}
                                    className={cn(
                                        "flex-1 h-9 rounded-lg text-sm font-medium transition-all",
                                        propina === tip
                                            ? "bg-emerald-500 text-white"
                                            : "bg-slate-800 text-white/70 hover:bg-slate-700"
                                    )}
                                >
                                    {tip === 0 ? "Sin" : `+${tip}€`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment Method Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMetodoPago('efectivo')}
                            className={cn(
                                "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-medium transition-all",
                                metodoPago === 'efectivo'
                                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500"
                                    : "bg-slate-800 text-white/60 hover:bg-slate-700"
                            )}
                        >
                            <Banknote className="h-4 w-4" />
                            Efectivo
                        </button>
                        <button
                            onClick={() => setMetodoPago('tarjeta')}
                            className={cn(
                                "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-medium transition-all",
                                metodoPago === 'tarjeta'
                                    ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500"
                                    : "bg-slate-800 text-white/60 hover:bg-slate-700"
                            )}
                        >
                            <CreditCard className="h-4 w-4" />
                            Tarjeta
                        </button>
                    </div>

                    {/* Advanced Options - Collapsible */}
                    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                        <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                                <ChevronDown className={cn(
                                    "h-4 w-4 transition-transform",
                                    showAdvanced && "rotate-180"
                                )} />
                                Opciones avanzadas (km)
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Km inicial</label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={startKm}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || /^\d+$/.test(val)) {
                                                setStartKm(val);
                                            }
                                        }}
                                        className="bg-slate-800 border-slate-700 text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Km final</label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={endKm}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || /^\d+$/.test(val)) {
                                                setEndKm(val);
                                            }
                                        }}
                                        className="bg-slate-800 border-slate-700 text-white"
                                    />
                                </div>
                            </div>
                            {startKm && endKm && parseInt(endKm) > parseInt(startKm) && (
                                <p className="text-xs text-emerald-400 text-center">
                                    Distancia: {parseInt(endKm) - parseInt(startKm)} km
                                </p>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                </div>

                <DrawerFooter className="pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={!finalAmount || saving}
                        className="h-12 text-base font-semibold bg-primary hover:bg-primary/90"
                    >
                        {saving ? (
                            "Guardando..."
                        ) : finalAmount ? (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                Guardar {finalAmount}€{propina > 0 ? ` + ${propina}€` : ""}
                            </>
                        ) : (
                            "Selecciona importe"
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
