import { useState } from "react";
import { ArrowLeft, Plus, Phone, MessageCircle, Clock, MapPin, Car, Sun, Moon, Sunset, Shuffle, X, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useJobBoard, AD_TYPE_CONFIG, SHIFT_LABELS, AdType, ShiftType, JobAd } from "@/hooks/useJobBoard";
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

function AdCard({ ad }: { ad: JobAd }) {
    const config = AD_TYPE_CONFIG[ad.ad_type];
    const ShiftIcon = ad.shift ? SHIFT_ICONS[ad.shift] : null;

    return (
        <div className={cn("card-glass p-4 space-y-3 border", config.border)}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{config.emoji}</span>
                    <div>
                        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.color)}>
                            {config.label}
                        </span>
                        <h3 className="text-sm font-bold text-foreground leading-tight">{ad.title}</h3>
                    </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(ad.created_at), { addSuffix: true, locale: es })}
                </span>
            </div>

            {/* Description */}
            {ad.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{ad.description}</p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
                {ad.shift && ShiftIcon && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/30 text-foreground/70 px-2 py-1 rounded-lg">
                        <ShiftIcon className="h-3 w-3" />
                        {SHIFT_LABELS[ad.shift]}
                    </span>
                )}
                {ad.rest_day && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/30 text-foreground/70 px-2 py-1 rounded-lg">
                        <Clock className="h-3 w-3" />
                        {ad.rest_day}
                    </span>
                )}
                {ad.vehicle_type && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/30 text-foreground/70 px-2 py-1 rounded-lg">
                        <Car className="h-3 w-3" />
                        {ad.vehicle_type}
                    </span>
                )}
                {ad.zone && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/30 text-foreground/70 px-2 py-1 rounded-lg">
                        <MapPin className="h-3 w-3" />
                        {ad.zone}
                    </span>
                )}
            </div>

            {/* Contact */}
            {(ad.contact_phone || ad.contact_whatsapp) && (
                <div className="flex gap-2 pt-1">
                    {ad.contact_phone && (
                        <a
                            href={`tel:${ad.contact_phone}`}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
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
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                        </a>
                    )}
                </div>
            )}

            {/* Contact name */}
            {ad.contact_name && (
                <p className="text-[10px] text-muted-foreground/60 text-right">
                    — {ad.contact_name}
                </p>
            )}
        </div>
    );
}

export function JobBoardView({ onBack }: JobBoardViewProps) {
    const { ads, loading, createAd, closeAd, getMyAds } = useJobBoard();
    const { toast } = useToast();

    const [filter, setFilter] = useState<AdType | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreate, setShowCreate] = useState(false);

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

    const handleCreate = async () => {
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

    const countByType = (type: AdType) => ads.filter(a => a.ad_type === type).length;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground text-sm">Cargando anuncios...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-full bg-muted/30 hover:bg-muted/50 transition-colors">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Bolsa de Trabajo</h2>
                        <p className="text-xs text-muted-foreground">{ads.length} anuncios activos</p>
                    </div>
                </div>
                <Button size="sm" onClick={() => setShowCreate(true)} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-1" />
                    Publicar
                </Button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
                {([
                    { value: 'all' as const, label: 'Todos', count: ads.length },
                    { value: 'busco_conductor' as const, label: '🚕 Buscan conductor', count: countByType('busco_conductor') },
                    { value: 'busco_taxi' as const, label: '🧑‍✈️ Buscan taxi', count: countByType('busco_taxi') },
                ]).map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={cn(
                            "flex-1 py-2 rounded-xl text-[11px] font-medium transition-all",
                            filter === tab.value
                                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                                : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
                        )}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por titulo, zona..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl"
                />
            </div>

            {/* My ads banner */}
            {myAds.length > 0 && (
                <div className="card-glass p-3 border border-primary/20">
                    <p className="text-xs font-medium text-primary mb-2">Tus anuncios ({myAds.length})</p>
                    {myAds.map(ad => (
                        <div key={ad.id} className="flex items-center justify-between py-1">
                            <span className="text-xs text-foreground truncate flex-1">{ad.title}</span>
                            <button
                                onClick={async () => {
                                    await closeAd(ad.id);
                                    toast({ title: "Anuncio cerrado" });
                                }}
                                className="text-[10px] text-red-400 hover:text-red-300 ml-2"
                            >
                                Cerrar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Ads list */}
            {filteredAds.length === 0 ? (
                <div className="text-center py-12 card-glass">
                    <span className="text-4xl mb-3 block">📋</span>
                    <p className="text-muted-foreground font-medium">No hay anuncios</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        {filter !== 'all' ? 'Prueba otro filtro o ' : ''}Se el primero en publicar
                    </p>
                    <Button size="sm" className="mt-4 rounded-xl" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Publicar anuncio
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAds.map(ad => (
                        <AdCard key={ad.id} ad={ad} />
                    ))}
                </div>
            )}

            {/* Create Ad Drawer */}
            <Drawer open={showCreate} onOpenChange={setShowCreate}>
                <DrawerContent className="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Publicar anuncio
                        </DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-4 space-y-4 overflow-y-auto">
                        {/* Ad Type */}
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(AD_TYPE_CONFIG) as [AdType, typeof AD_TYPE_CONFIG[AdType]][]).map(([type, config]) => (
                                <button
                                    key={type}
                                    onClick={() => setNewAdType(type)}
                                    className={cn(
                                        "p-3 rounded-xl border-2 transition-all text-left",
                                        newAdType === type
                                            ? "border-primary bg-primary/10"
                                            : "border-border bg-card hover:border-primary/50"
                                    )}
                                >
                                    <span className="text-lg">{config.emoji}</span>
                                    <p className="text-xs font-medium mt-1">{config.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{config.description}</p>
                                </button>
                            ))}
                        </div>

                        {/* Title */}
                        <div className="space-y-1.5">
                            <Label>Titulo *</Label>
                            <Input
                                placeholder={newAdType === 'busco_conductor' ? "Ej: Busco conductor turno manana" : "Ej: Conductor con experiencia busca taxi"}
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label>Descripcion</Label>
                            <Textarea
                                placeholder="Detalles del puesto, condiciones, experiencia requerida..."
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                rows={3}
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
                                                "py-2 rounded-lg text-[10px] font-medium transition-all flex flex-col items-center gap-1",
                                                newShift === shift
                                                    ? "bg-primary/15 text-primary ring-1 ring-primary"
                                                    : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
                                            )}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {label.split(' ')[0]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Vehicle & Zone */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Vehiculo</Label>
                                <Input placeholder="Ej: Toyota Corolla" value={newVehicle} onChange={(e) => setNewVehicle(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Zona</Label>
                                <Input placeholder="Ej: Barcelona centro" value={newZone} onChange={(e) => setNewZone(e.target.value)} />
                            </div>
                        </div>

                        {/* Rest day */}
                        <div className="space-y-1.5">
                            <Label>Dia de descanso</Label>
                            <Input placeholder="Ej: Jueves impar" value={newRestDay} onChange={(e) => setNewRestDay(e.target.value)} />
                        </div>

                        {/* Contact */}
                        <div className="space-y-1.5">
                            <Label>Contacto *</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <Input placeholder="Telefono" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" />
                                <Input placeholder="WhatsApp" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} type="tel" />
                            </div>
                            <Input placeholder="Tu nombre (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-2" />
                        </div>
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="h-12">
                            {saving ? "Publicando..." : (
                                <><Check className="h-4 w-4 mr-2" />Publicar anuncio</>
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
