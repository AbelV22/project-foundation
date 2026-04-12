import { useState, useRef } from "react";
import { Minus, Fuel, Wrench, FileText, DollarSign, Check, Camera, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useExpenses, ExpenseCategory, EXPENSE_SUBCATEGORIES } from "@/hooks/useExpenses";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateDeviceId } from "@/lib/deviceId";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Preset amounts for quick fuel purchases
const FUEL_PRESETS = [20, 30, 40, 50, 60];

const CATEGORY_CONFIG = {
    fuel: { label: 'Combustible', icon: Fuel, color: 'bg-orange-500' },
    maintenance: { label: 'Mantenimiento', icon: Wrench, color: 'bg-blue-500' },
    operating: { label: 'Operativo', icon: FileText, color: 'bg-purple-500' },
    other: { label: 'Otros', icon: DollarSign, color: 'bg-gray-500' },
};

export function AddExpenseSheet() {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<ExpenseCategory>('fuel');
    const [subcategory, setSubcategory] = useState<string>('');
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState<string>("");
    const [odometer, setOdometer] = useState<string>("");
    const [liters, setLiters] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const receiptInputRef = useRef<HTMLInputElement>(null);

    const { addExpense } = useExpenses();
    const { toast } = useToast();

    const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setReceiptPreview(base64);
            setReceiptBase64(base64);
        };
        reader.readAsDataURL(file);
    };

    const uploadReceipt = async (base64: string): Promise<string | null> => {
        try {
            const deviceId = getOrCreateDeviceId();
            const fileName = `receipts/${deviceId}/${Date.now()}.jpg`;
            const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
            const byteCharacters = atob(base64Data);
            const byteArray = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteArray[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            const { error: uploadError } = await supabase.storage
                .from('tickets')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('tickets')
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (err) {
            console.error('[AddExpense] Upload receipt error:', err);
            return null;
        }
    };

    const handleAmountSelect = (amount: number) => {
        setSelectedAmount(amount);
        setCustomAmount("");
    };

    const handleCustomAmount = (value: string) => {
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

    const handleCategoryChange = (newCategory: ExpenseCategory) => {
        setCategory(newCategory);
        setSubcategory('');
        setSelectedAmount(null);
        setCustomAmount('');
        setLiters('');
    };

    const handleSave = async () => {
        const amount = getFinalAmount();
        if (!amount || amount <= 0) {
            toast({
                title: "Error",
                description: "Introduce un importe válido",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);

        // Upload receipt photo if available
        let receiptUrl: string | undefined;
        if (receiptBase64) {
            const url = await uploadReceipt(receiptBase64);
            if (url) receiptUrl = url;
        }

        const success = await addExpense(
            category,
            amount,
            subcategory || undefined,
            odometer ? parseInt(odometer) : undefined,
            liters ? parseFloat(liters) : undefined,
            notes || undefined,
            false,
            undefined,
            receiptUrl
        );
        setSaving(false);

        if (success) {
            toast({
                title: "✅ Gasto registrado",
                description: `${CATEGORY_CONFIG[category].label}: ${amount}€`,
            });
            // Reset and close
            setSelectedAmount(null);
            setCustomAmount("");
            setOdometer("");
            setLiters("");
            setNotes("");
            setSubcategory("");
            setReceiptPreview(null);
            setReceiptBase64(null);
            if (receiptInputRef.current) receiptInputRef.current.value = '';
            setOpen(false);
        } else {
            toast({
                title: "Error",
                description: "No se pudo guardar el gasto",
                variant: "destructive",
            });
        }
    };

    const finalAmount = getFinalAmount();
    const CategoryIcon = CATEGORY_CONFIG[category].icon;

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <button
                    className="fixed bottom-36 right-4 z-40 h-14 w-14 rounded-full bg-red-500 shadow-lg shadow-red-500/30 flex items-center justify-center text-white hover:bg-red-600 transition-all active:scale-95"
                    aria-label="Añadir gasto"
                >
                    <Minus className="h-6 w-6" />
                </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
                <DrawerHeader>
                    <DrawerTitle className="flex items-center gap-2">
                        <Minus className="h-5 w-5 text-red-500" />
                        Registrar Gasto
                    </DrawerTitle>
                </DrawerHeader>

                <div className="px-4 pb-4 space-y-4 overflow-y-auto">
                    {/* Category Selection */}
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((cat) => {
                            const config = CATEGORY_CONFIG[cat];
                            const Icon = config.icon;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => handleCategoryChange(cat)}
                                    className={cn(
                                        "p-3 rounded-lg border-2 transition-all flex items-center gap-2",
                                        category === cat
                                            ? "border-primary bg-primary/10"
                                            : "border-border bg-card hover:border-primary/50"
                                    )}
                                >
                                    <div className={cn("p-2 rounded-full", config.color)}>
                                        <Icon className="h-4 w-4 text-white" />
                                    </div>
                                    <span className="text-sm font-medium">{config.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Subcategory */}
                    <div className="space-y-2">
                        <Label>Tipo de gasto</Label>
                        <Select value={subcategory} onValueChange={setSubcategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                                {EXPENSE_SUBCATEGORIES[category].map((sub) => (
                                    <SelectItem key={sub} value={sub}>
                                        {sub}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Quick amounts for fuel */}
                    {category === 'fuel' && (
                        <div className="space-y-2">
                            <Label>Importes rápidos</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {FUEL_PRESETS.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => handleAmountSelect(amount)}
                                        className={cn(
                                            "p-3 rounded-lg border-2 transition-all text-center",
                                            selectedAmount === amount
                                                ? "border-primary bg-primary/10"
                                                : "border-border bg-card hover:border-primary/50"
                                        )}
                                    >
                                        <span className="text-sm font-semibold">{amount}€</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom amount */}
                    <div className="space-y-2">
                        <Label>Importe (€)</Label>
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={customAmount}
                            onChange={(e) => handleCustomAmount(e.target.value)}
                            className="text-lg"
                        />
                    </div>

                    {/* Fuel-specific fields */}
                    {category === 'fuel' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Litros</Label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    value={liters}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || /^\d+(\.\d{0,2})?$/.test(val)) {
                                            setLiters(val);
                                        }
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Kilómetros</Label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={odometer}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || /^\d+$/.test(val)) {
                                            setOdometer(val);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Odometer for other categories */}
                    {category !== 'fuel' && (
                        <div className="space-y-2">
                            <Label>Kilómetros (opcional)</Label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={odometer}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || /^\d+$/.test(val)) {
                                        setOdometer(val);
                                    }
                                }}
                            />
                        </div>
                    )}

                    {/* Receipt Photo */}
                    <div className="space-y-2">
                        <Label>Foto del recibo (opcional)</Label>
                        {receiptPreview ? (
                            <div className="relative">
                                <img
                                    src={receiptPreview}
                                    alt="Recibo"
                                    className="w-full h-24 object-cover rounded-xl border border-border"
                                />
                                <button
                                    onClick={() => {
                                        setReceiptPreview(null);
                                        setReceiptBase64(null);
                                        if (receiptInputRef.current) receiptInputRef.current.value = '';
                                    }}
                                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center"
                                >
                                    <X className="h-3.5 w-3.5 text-foreground" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => receiptInputRef.current?.click()}
                                className="w-full h-16 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/20 transition-all"
                            >
                                <Camera className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Fotografiar recibo</span>
                            </button>
                        )}
                        <input
                            ref={receiptInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleReceiptSelect}
                            className="hidden"
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Notas (opcional)</Label>
                        <Input
                            type="text"
                            placeholder="Descripción del gasto..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DrawerFooter className="border-t">
                    <div className="flex gap-2">
                        <DrawerClose asChild>
                            <Button variant="outline" className="flex-1">
                                Cancelar
                            </Button>
                        </DrawerClose>
                        <Button
                            onClick={handleSave}
                            disabled={!finalAmount || finalAmount <= 0 || saving}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                        >
                            {saving ? (
                                "Guardando..."
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Guardar {finalAmount ? `${finalAmount}€` : ""}
                                </>
                            )}
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
