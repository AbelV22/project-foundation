import { useState } from "react";
import { ArrowLeft, Plus, Phone, MessageCircle, Clock, MapPin, Car, Sun, Moon, Sunset, Shuffle, Check, Search, Briefcase, Users, Sparkles, X, UserRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useJobBoard, AD_TYPE_CONFIG, SHIFT_LABELS, AdType, ShiftType, JobAd } from "@/hooks/useJobBoard";
import { useAuth } from "@/hooks/useAuth";
import { AccountCreationDialog } from "@/components/AccountCreationDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";

interface JobBoardViewProps {
    onBack: () => void;
}

const SHIFT_ICONS = {
    morning: Sun,
    afternoon: Sunset,
    night: Moon,
    flexible: Shuffle,
};

const TYPE_STYLES = {
    busco_conductor: {
        Icon: Car,
        accent: "from-emerald-500/80 to-emerald-400/40",
        chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
        iconBg: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
        glow: "shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_8px_24px_-12px_rgba(16,185,129,0.35)]",
    },
    busco_taxi: {
        Icon: UserRound,
        accent: "from-sky-500/80 to-sky-400/40",
        chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
        iconBg: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
        glow: "shadow-[0_0_0_1px_rgba(14,165,233,0.15),0_8px_24px_-12px_rgba(14,165,233,0.35)]",
    },
} as const;

function AdCard({ ad }: { ad: JobAd }) {
    const config = AD_TYPE_CONFIG[ad.ad_type];
    const styles = TYPE_STYLES[ad.ad_type];
    const TypeIcon = styles.Icon;
    const ShiftIcon = ad.shift ? SHIFT_ICONS[ad.shift] : null;

    return (
        <div className={cn(
            "relative card-glass rounded-2xl overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99]",
            styles.glow
        )}>
            {/* Side accent bar */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b", styles.accent)} />

            <div className="p-4 pl-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={cn("shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ring-1", styles.iconBg)}>
                            <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1", styles.chip)}>
                                {config.label}
                            </span>
                            <h3 className="text-sm font-bold text-foreground leading-snug mt-1 break-words">{ad.title}</h3>
                        </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0 whitespace-nowrap pt-1">
                        {formatDistanceToNow(new Date(ad.created_at), { addSuffix: true, locale: es })}
                    </span>
                </div>

                {/* Description */}
                {ad.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{ad.description}</p>
                )}

                {/* Tags */}
                {(ad.shift || ad.rest_day || ad.vehicle_type || ad.zone) && (
                    <div className="flex flex-wrap gap-1.5">
                        {ad.shift && ShiftIcon && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/40 text-foreground/80 px-2 py-1 rounded-lg">
                                <ShiftIcon className="h-3 w-3" />
                                {SHIFT_LABELS[ad.shift]}
                            </span>
                        )}
                        {ad.rest_day && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/40 text-foreground/80 px-2 py-1 rounded-lg">
                                <Clock className="h-3 w-3" />
                                {ad.rest_day}
                            </span>
                        )}
                        {ad.vehicle_type && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/40 text-foreground/80 px-2 py-1 rounded-lg">
                                <Car className="h-3 w-3" />
                                {ad.vehicle_type}
                            </span>
                        )}
                        {ad.zone && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/40 text-foreground/80 px-2 py-1 rounded-lg">
                                <MapPin className="h-3 w-3" />
                                {ad.zone}
                            </span>
                        )}
                    </div>
                )}

                {/* Contact */}
                {(ad.contact_phone || ad.contact_whatsapp) && (
                    <div className="flex gap-2 pt-1">
                        {ad.contact_phone && (
                            <a
                                href={`tel:${ad.contact_phone}`}
                                className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 active:scale-95 transition-all ring-1 ring-primary/20"
                            >
                                <Phone className="h-3.5 w-3.5" />
                                Llamar
                            </a>
                        )}
                        {ad.contact_whatsapp && (
                            <a
                                href={`https://wa.me/34${ad.contact_whatsapp.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 active:scale-95 transition-all ring-1 ring-emerald-500/20"
                            >
                                <MessageCircle className="h-3.5 w-3.5" />
                                WhatsApp
                            </a>
                        )}
                    </div>
                )}

                {/* Contact name */}
                {ad.contact_name && (
                    <p className="text-[10px] text-muted-foreground/60 text-right italic">
                        — {ad.contact_name}
                    </p>
                )}
            </div>
        </div>
    );
}

export function JobBoardView({ onBack }: JobBoardViewProps) {
    const { ads, loading, createAd, closeAd, getMyAds } = useJobBoard();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { toast } = useToast();

    const [filter, setFilter] = useState<AdType | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [showAuthDialog, setShowAuthDialog] = useState(false);

    const handlePublishClick = () => {
        if (authLoading) return;
        if (!isAuthenticated) {
            setShowAuthDialog(true);
            return;
        }
        setShowCreate(true);
    };

    // Create form state
    const [newAdType, setNewAdType] = useState<AdType>('busco_conductor');
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newShift, setNewShift] = useState<ShiftType | ''>('');
    const [newRestDay, setNewRestDay] = useState('');
    const [newVehicle, setNewVehicle] = useState('');
    const [newZone, setNewZone] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newWhatsapp, setNewWhatsapp] = useState('');
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);

    const filteredAds = ads
        .filter(a => filter === 'all' || a.ad_type === filter)
        .filter(a => !searchQuery ||
            a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.zone?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const myAds = getMyAds();

    const countByType = (type: AdType) => ads.filter(a => a.ad_type === type).length;
    const countConductor = countByType('busco_conductor');
    const countTaxi = countByType('busco_taxi');

    const handleCreate = async () => {
        if (!isAuthenticated) {
            setShowCreate(false);
            setShowAuthDialog(true);
            return;
        }
        if (!newTitle.trim()) {
            toast({ title: "Escribe un titulo", variant: "destructive" });
            return;
        }
        if (!newPhone && !newWhatsapp) {
            toast({ title: "Pon al menos un telefono o WhatsApp", variant: "destructive" });
            return;
        }

        setSaving(true);
        const success = await createAd({
            ad_type: newAdType,
            title: newTitle.trim(),
            description: newDescription.trim() || undefined,
            shift: newShift || undefined,
            rest_day: newRestDay || undefined,
            vehicle_type: newVehicle || undefined,
            zone: newZone || undefined,
            contact_phone: newPhone || undefined,
            contact_whatsapp: newWhatsapp || undefined,
            contact_name: newName || undefined,
        });
        setSaving(false);

        if (success) {
            toast({ title: "Anuncio publicado", description: "Visible para todos los taxistas" });
            setNewTitle('');
            setNewDescription('');
            setNewShift('');
            setNewRestDay('');
            setNewVehicle('');
            setNewZone('');
            setShowCreate(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground text-sm">Cargando anuncios...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-24 animate-fade-in">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 p-4">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onBack}
                                className="p-2 rounded-full bg-background/40 backdrop-blur hover:bg-background/60 transition-colors"
                                aria-label="Volver"
                            >
                                <ArrowLeft className="h-5 w-5 text-foreground" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-primary/15 ring-1 ring-primary/30">
                                    <Briefcase className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground leading-tight">Bolsa de Trabajo</h2>
                                    <p className="text-[11px] text-muted-foreground">Taxistas de Barcelona</p>
                                </div>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={handlePublishClick}
                            className="rounded-xl shadow-lg shadow-primary/20 h-9"
                        >
                            {isAuthenticated ? (
                                <Plus className="h-4 w-4 mr-1" />
                            ) : (
                                <Lock className="h-3.5 w-3.5 mr-1" />
                            )}
                            Publicar
                        </Button>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-background/40 backdrop-blur rounded-xl p-2.5 border border-border/30">
                            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                                <Sparkles className="h-3 w-3" />
                                Total
                            </div>
                            <p className="text-xl font-bold text-foreground mt-0.5">{ads.length}</p>
                        </div>
                        <div className="bg-emerald-500/10 backdrop-blur rounded-xl p-2.5 border border-emerald-500/20">
                            <div className="flex items-center gap-1.5 text-emerald-300 text-[10px] font-medium uppercase tracking-wide">
                                <Car className="h-3 w-3" />
                                Conductor
                            </div>
                            <p className="text-xl font-bold text-emerald-300 mt-0.5">{countConductor}</p>
                        </div>
                        <div className="bg-sky-500/10 backdrop-blur rounded-xl p-2.5 border border-sky-500/20">
                            <div className="flex items-center gap-1.5 text-sky-300 text-[10px] font-medium uppercase tracking-wide">
                                <Users className="h-3 w-3" />
                                Taxi
                            </div>
                            <p className="text-xl font-bold text-sky-300 mt-0.5">{countTaxi}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Buscar por título, zona o descripción..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-2xl bg-muted/20 border-border/50 focus-visible:ring-primary/40"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/40"
                        aria-label="Limpiar"
                    >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                )}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                {([
                    { value: 'all' as const, label: 'Todos', Icon: Sparkles, count: ads.length, chip: 'bg-primary/15 text-primary ring-primary/30' },
                    { value: 'busco_conductor' as const, label: 'Buscan conductor', Icon: Car, count: countConductor, chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
                    { value: 'busco_taxi' as const, label: 'Buscan taxi', Icon: UserRound, count: countTaxi, chip: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' },
                ]).map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={cn(
                            "shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs font-semibold transition-all whitespace-nowrap ring-1",
                            filter === tab.value
                                ? `${tab.chip} scale-[1.02]`
                                : "bg-muted/20 text-muted-foreground ring-transparent hover:bg-muted/30"
                        )}
                    >
                        <tab.Icon className="h-3.5 w-3.5" />
                        {tab.label}
                        <span className={cn(
                            "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold",
                            filter === tab.value ? "bg-background/40" : "bg-muted/40"
                        )}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* My ads banner */}
            {myAds.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/25 p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 rounded-md bg-primary/20">
                            <Sparkles className="h-3 w-3 text-primary" />
                        </div>
                        <p className="text-xs font-bold text-primary">Tus anuncios activos ({myAds.length})</p>
                    </div>
                    <div className="space-y-1">
                        {myAds.map(ad => (
                            <div key={ad.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-background/30 transition-colors">
                                <span className="text-xs text-foreground truncate flex-1">{ad.title}</span>
                                <button
                                    onClick={async () => {
                                        await closeAd(ad.id);
                                        toast({ title: "Anuncio cerrado" });
                                    }}
                                    className="text-[10px] font-semibold text-red-400 hover:text-red-300 ml-2 px-2 py-1 rounded-md hover:bg-red-500/10"
                                >
                                    Cerrar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ads list */}
            {filteredAds.length === 0 ? (
                <div className="text-center py-14 card-glass rounded-3xl border border-dashed border-border/50">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Briefcase className="h-7 w-7 text-primary/70" />
                    </div>
                    <p className="text-foreground font-semibold">
                        {searchQuery ? 'Sin resultados' : 'No hay anuncios'}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1 px-8">
                        {searchQuery
                            ? 'Prueba con otras palabras clave'
                            : filter !== 'all'
                                ? 'Cambia el filtro o sé el primero en publicar'
                                : 'Sé el primero en publicar una oferta'}
                    </p>
                    <Button size="sm" className="mt-5 rounded-xl" onClick={handlePublishClick}>
                        <Plus className="h-4 w-4 mr-1" />
                        Publicar anuncio
                    </Button>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between px-1">
                        <p className="text-[11px] text-muted-foreground font-medium">
                            {filteredAds.length} {filteredAds.length === 1 ? 'anuncio' : 'anuncios'}
                        </p>
                    </div>
                    <div className="space-y-3">
                        {filteredAds.map(ad => (
                            <AdCard key={ad.id} ad={ad} />
                        ))}
                    </div>
                </>
            )}

            {/* Create Ad Drawer */}
            {/* Auth dialog gating publish */}
            <AccountCreationDialog
                open={showAuthDialog}
                onDone={() => {
                    setShowAuthDialog(false);
                    setShowCreate(true);
                }}
                onSkip={() => setShowAuthDialog(false)}
            />

            <Drawer open={showCreate} onOpenChange={setShowCreate}>
                <DrawerContent className="max-h-[92vh]">
                    <DrawerHeader className="pb-2">
                        <DrawerTitle className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/15">
                                <Plus className="h-4 w-4 text-primary" />
                            </div>
                            Publicar anuncio
                        </DrawerTitle>
                        <p className="text-xs text-muted-foreground">Llega a cientos de taxistas de Barcelona</p>
                    </DrawerHeader>
                    <div className="px-4 pb-4 space-y-5 overflow-y-auto">
                        {/* Ad Type */}
                        <div>
                            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Tipo de anuncio</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.entries(AD_TYPE_CONFIG) as [AdType, typeof AD_TYPE_CONFIG[AdType]][]).map(([type, config]) => {
                                    const OptionIcon = TYPE_STYLES[type].Icon;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setNewAdType(type)}
                                            className={cn(
                                                "p-3 rounded-2xl border-2 transition-all text-left",
                                                newAdType === type
                                                    ? "border-primary bg-primary/10 scale-[1.02]"
                                                    : "border-border bg-card hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center ring-1", TYPE_STYLES[type].iconBg)}>
                                                <OptionIcon className="h-4 w-4" />
                                            </div>
                                            <p className="text-xs font-semibold mt-2">{config.label}</p>
                                            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{config.description}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Title */}
                        <div className="space-y-1.5">
                            <Label>Título *</Label>
                            <Input
                                placeholder={newAdType === 'busco_conductor' ? "Ej: Busco conductor turno mañana" : "Ej: Conductor con experiencia busca taxi"}
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label>Descripción</Label>
                            <Textarea
                                placeholder="Detalles del puesto, condiciones, experiencia requerida..."
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                rows={3}
                                className="rounded-xl resize-none"
                            />
                        </div>

                        {/* Shift */}
                        <div className="space-y-1.5">
                            <Label>Turno</Label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {(Object.entries(SHIFT_LABELS) as [ShiftType, string][]).map(([shift, label]) => {
                                    const Icon = SHIFT_ICONS[shift];
                                    return (
                                        <button
                                            key={shift}
                                            onClick={() => setNewShift(newShift === shift ? '' : shift)}
                                            className={cn(
                                                "py-2.5 rounded-xl text-[10px] font-medium transition-all flex flex-col items-center gap-1 ring-1",
                                                newShift === shift
                                                    ? "bg-primary/15 text-primary ring-primary"
                                                    : "bg-muted/20 text-muted-foreground ring-transparent hover:bg-muted/30"
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {label.split(' ')[0]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Vehicle & Zone */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Vehículo</Label>
                                <Input placeholder="Ej: Toyota Corolla" value={newVehicle} onChange={(e) => setNewVehicle(e.target.value)} className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Zona</Label>
                                <Input placeholder="Ej: Barcelona centro" value={newZone} onChange={(e) => setNewZone(e.target.value)} className="rounded-xl" />
                            </div>
                        </div>

                        {/* Rest day */}
                        <div className="space-y-1.5">
                            <Label>Día de descanso</Label>
                            <Input placeholder="Ej: Jueves impar" value={newRestDay} onChange={(e) => setNewRestDay(e.target.value)} className="rounded-xl" />
                        </div>

                        {/* Contact */}
                        <div className="space-y-1.5">
                            <Label>Contacto *</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input placeholder="Teléfono" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" className="rounded-xl pl-9" />
                                </div>
                                <div className="relative">
                                    <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" />
                                    <Input placeholder="WhatsApp" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} type="tel" className="rounded-xl pl-9" />
                                </div>
                            </div>
                            <Input placeholder="Tu nombre (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-2 rounded-xl" />
                        </div>
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="h-12 rounded-xl shadow-lg shadow-primary/20">
                            {saving ? "Publicando..." : (
                                <><Check className="h-4 w-4 mr-2" />Publicar anuncio</>
                            )}
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="ghost" className="rounded-xl">Cancelar</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
