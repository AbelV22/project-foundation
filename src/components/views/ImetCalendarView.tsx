import { useState } from "react";
import { ArrowLeft, Plus, Check, Trash2, AlertTriangle, Calendar, Clock, Wrench, Gauge, ShieldCheck, ClipboardCheck, IdCard, Pin, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImetCalendar, IMET_EVENT_CONFIG, ImetEventType } from "@/hooks/useImetCalendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";

interface ImetCalendarViewProps {
    onBack: () => void;
}

const EVENT_ICONS: Record<ImetEventType, LucideIcon> = {
    itv: Wrench,
    taximeter: Gauge,
    insurance: ShieldCheck,
    metro_review: ClipboardCheck,
    license_review: IdCard,
    other: Pin,
};

const EVENT_ICON_STYLES: Record<ImetEventType, string> = {
    itv: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    taximeter: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
    insurance: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    metro_review: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    license_review: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    other: "bg-muted/40 text-muted-foreground ring-border/40",
};

export function ImetCalendarView({ onBack }: ImetCalendarViewProps) {
    const { events, loading, addEvent, completeEvent, deleteEvent, getUpcoming } = useImetCalendar();
    const { toast } = useToast();
    const [showAdd, setShowAdd] = useState(false);
    const [newType, setNewType] = useState<ImetEventType>('itv');
    const [newDate, setNewDate] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const upcoming = getUpcoming();
    const completed = events.filter(e => e.completed_at);

    const handleAdd = async () => {
        if (!newDate) {
            toast({ title: "Selecciona una fecha", variant: "destructive" });
            return;
        }
        setSaving(true);
        const config = IMET_EVENT_CONFIG[newType];
        const success = await addEvent(newType, config.label, newDate, newNotes || undefined);
        setSaving(false);
        if (success) {
            toast({ title: "Recordatorio añadido", description: `${config.label} — ${newDate}` });
            setNewDate('');
            setNewNotes('');
            setShowAdd(false);
        }
    };

    const handleComplete = async (id: string) => {
        await completeEvent(id);
        toast({ title: "Marcado como completado" });
    };

    const handleDelete = async (id: string) => {
        await deleteEvent(id);
        toast({ title: "Eliminado" });
    };

    const getUrgencyColor = (daysLeft: number) => {
        if (daysLeft < 0) return "text-red-400 bg-red-500/10 border-red-500/30";
        if (daysLeft <= 7) return "text-red-400 bg-red-500/10 border-red-500/20";
        if (daysLeft <= 30) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    };

    const getDaysLabel = (daysLeft: number) => {
        if (daysLeft < 0) return `¡Vencido hace ${Math.abs(daysLeft)} días!`;
        if (daysLeft === 0) return "¡Hoy!";
        if (daysLeft === 1) return "Mañana";
        return `En ${daysLeft} días`;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground text-sm">Cargando calendario...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-full bg-muted/30 hover:bg-muted/50 transition-colors">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Calendario IMET</h2>
                        <p className="text-xs text-muted-foreground">ITV, seguro, taxímetro y más</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => setShowAdd(true)}
                    className="rounded-xl"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir
                </Button>
            </div>

            {/* Upcoming deadlines */}
            {upcoming.length === 0 && completed.length === 0 ? (
                <div className="text-center py-12 card-glass mx-auto max-w-sm">
                    <div className="bg-muted/30 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                        <Calendar className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground font-medium">Sin recordatorios</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px] mx-auto">
                        Añade tus fechas de ITV, seguro, revisión del taxímetro y más para no olvidar ninguna.
                    </p>
                    <Button size="sm" className="mt-4 rounded-xl" onClick={() => setShowAdd(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Añadir primer recordatorio
                    </Button>
                </div>
            ) : (
                <>
                    {upcoming.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                Próximos vencimientos
                            </h3>
                            {upcoming.map((event) => {
                                const type = (event.event_type as ImetEventType);
                                const config = IMET_EVENT_CONFIG[type] || IMET_EVENT_CONFIG.other;
                                const urgency = getUrgencyColor(event.daysLeft);
                                const EventIcon = EVENT_ICONS[type] || EVENT_ICONS.other;
                                const iconStyle = EVENT_ICON_STYLES[type] || EVENT_ICON_STYLES.other;
                                return (
                                    <div
                                        key={event.id}
                                        className={cn("card-glass p-3 flex items-center gap-3 border", urgency.split(' ').slice(1).join(' '))}
                                    >
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0", iconStyle)}>
                                            <EventIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-foreground text-sm">{event.title}</span>
                                                {event.daysLeft <= 7 && (
                                                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                <span className="flex items-center gap-0.5">
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(event.due_date), "d MMM yyyy", { locale: es })}
                                                </span>
                                                <span className={cn("font-semibold", urgency.split(' ')[0])}>
                                                    {getDaysLabel(event.daysLeft)}
                                                </span>
                                            </div>
                                            {event.notes && (
                                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{event.notes}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                onClick={() => handleComplete(event.id)}
                                                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                            >
                                                <Check className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(event.id)}
                                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {completed.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                Completados
                            </h3>
                            {completed.slice(0, 5).map((event) => {
                                const type = (event.event_type as ImetEventType);
                                const EventIcon = EVENT_ICONS[type] || EVENT_ICONS.other;
                                const iconStyle = EVENT_ICON_STYLES[type] || EVENT_ICON_STYLES.other;
                                return (
                                    <div key={event.id} className="card-glass p-3 flex items-center gap-3 opacity-50">
                                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center ring-1 shrink-0", iconStyle)}>
                                            <EventIcon className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-sm text-foreground line-through">{event.title}</span>
                                            <p className="text-[10px] text-muted-foreground">
                                                {format(new Date(event.due_date), "d MMM yyyy", { locale: es })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(event.id)}
                                            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Add Event Drawer */}
            <Drawer open={showAdd} onOpenChange={setShowAdd}>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Nuevo recordatorio
                        </DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-4 space-y-4">
                        {/* Type selection */}
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.entries(IMET_EVENT_CONFIG) as [ImetEventType, typeof IMET_EVENT_CONFIG[ImetEventType]][]).map(([type, config]) => {
                                    const OptionIcon = EVENT_ICONS[type];
                                    const optionStyle = EVENT_ICON_STYLES[type];
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setNewType(type)}
                                            className={cn(
                                                "p-2.5 rounded-xl border-2 transition-all flex items-center gap-2 text-left",
                                                newType === type
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-card hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center ring-1 shrink-0", optionStyle)}>
                                                <OptionIcon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <span className="text-xs font-medium block">{config.label}</span>
                                                {config.recurrence && (
                                                    <span className="text-[10px] text-muted-foreground">{config.recurrence}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Date */}
                        <div className="space-y-2">
                            <Label>Fecha de vencimiento</Label>
                            <Input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Notas (opcional)</Label>
                            <Input
                                placeholder="Taller, centro ITV, etc."
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleAdd} disabled={saving || !newDate} className="h-12">
                            {saving ? "Guardando..." : (
                                <><Check className="h-4 w-4 mr-2" />Guardar recordatorio</>
                            )}
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="ghost">Cancelar</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
