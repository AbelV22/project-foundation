import { useState, useMemo } from "react";
import {
  Coffee,
  Fuel,
  Wrench,
  FileText,
  UtensilsCrossed,
  Car,
  Sparkles,
  ShoppingBag,
  Percent,
  MapPin,
  Clock,
  ChevronRight,
  Tag,
  Star,
  Phone,
  Navigation,
  BadgePercent,
  Gift,
  Heart,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Categorías de negocios
const categories = {
  cafeteria: { icon: Coffee, color: "#8B4513", label: "Cafeterías", emoji: "☕" },
  restaurante: { icon: UtensilsCrossed, color: "#E11D48", label: "Restaurantes", emoji: "🍽️" },
  gasolinera: { icon: Fuel, color: "#059669", label: "Gasolineras", emoji: "⛽" },
  mecanico: { icon: Wrench, color: "#3B82F6", label: "Mecánicos", emoji: "🔧" },
  gestoria: { icon: FileText, color: "#8B5CF6", label: "Gestorías", emoji: "📋" },
  lavado: { icon: Sparkles, color: "#06B6D4", label: "Lavado", emoji: "🚿" },
  parking: { icon: Car, color: "#F59E0B", label: "Parking", emoji: "🅿️" },
  tienda: { icon: ShoppingBag, color: "#EC4899", label: "Tiendas", emoji: "🛍️" },
};

type CategoryKey = keyof typeof categories;

interface Offer {
  id: string;
  business: string;
  category: CategoryKey;
  title: string;
  description: string;
  discount: string;
  originalPrice?: string;
  finalPrice?: string;
  address: string;
  lat: number;
  lon: number;
  phone?: string;
  validUntil: string;
  rating?: number;
  reviews?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  code?: string;
  terms?: string;
}

// Ofertas de ejemplo (esto vendría de una API/JSON)
const sampleOffers: Offer[] = [
  {
    id: "1",
    business: "Cafetería El Taxista",
    category: "cafeteria",
    title: "Desayuno completo",
    description: "Café + tostada con tomate + zumo natural",
    discount: "20%",
    originalPrice: "5,50€",
    finalPrice: "4,40€",
    address: "C/ Aragó 285, Barcelona",
    lat: 41.3954,
    lon: 2.1629,
    phone: "932 123 456",
    validUntil: "2026-03-31",
    rating: 4.7,
    reviews: 128,
    isNew: true,
    code: "TAXI20",
  },
  {
    id: "2",
    business: "Repsol Diagonal",
    category: "gasolinera",
    title: "3 céntimos/L descuento",
    description: "En gasolina y diésel mostrando carnet de taxista",
    discount: "3¢/L",
    address: "Av. Diagonal 640, Barcelona",
    lat: 41.3932,
    lon: 2.1366,
    phone: "933 456 789",
    validUntil: "2026-06-30",
    rating: 4.2,
    reviews: 89,
    isFeatured: true,
  },
  {
    id: "3",
    business: "Taller Mecánico Jordi",
    category: "mecanico",
    title: "Cambio de aceite + filtros",
    description: "Incluye aceite sintético 5W30 y revisión de 20 puntos",
    discount: "25%",
    originalPrice: "89€",
    finalPrice: "66,75€",
    address: "C/ Marina 245, Barcelona",
    lat: 41.4012,
    lon: 2.1891,
    phone: "934 567 890",
    validUntil: "2026-04-15",
    rating: 4.9,
    reviews: 256,
  },
  {
    id: "4",
    business: "Gestoría AutoTax",
    category: "gestoria",
    title: "Renovación licencia taxi",
    description: "Gestión completa de renovación + asesoramiento fiscal",
    discount: "15%",
    originalPrice: "120€",
    finalPrice: "102€",
    address: "C/ València 320, Barcelona",
    lat: 41.3967,
    lon: 2.1689,
    phone: "935 678 901",
    validUntil: "2026-12-31",
    rating: 4.6,
    reviews: 73,
  },
  {
    id: "5",
    business: "Restaurante La Parada",
    category: "restaurante",
    title: "Menú del día taxista",
    description: "Primer plato + segundo + postre + bebida",
    discount: "Especial",
    finalPrice: "10,90€",
    address: "C/ Consell de Cent 380, Barcelona",
    lat: 41.3889,
    lon: 2.1652,
    phone: "936 789 012",
    validUntil: "2026-12-31",
    rating: 4.4,
    reviews: 312,
    isNew: true,
  },
  {
    id: "6",
    business: "Lavado Express T1",
    category: "lavado",
    title: "Lavado exterior + interior",
    description: "Lavado completo con aspirado y limpieza de cristales",
    discount: "30%",
    originalPrice: "18€",
    finalPrice: "12,60€",
    address: "Terminal T1, Aeropuerto BCN",
    lat: 41.2974,
    lon: 2.0833,
    phone: "937 890 123",
    validUntil: "2026-05-31",
    rating: 4.3,
    reviews: 45,
  },
  {
    id: "7",
    business: "Parking Sants",
    category: "parking",
    title: "Tarifa nocturna especial",
    description: "Parking 20:00-08:00 para taxistas",
    discount: "40%",
    originalPrice: "15€",
    finalPrice: "9€",
    address: "Estació de Sants, Barcelona",
    lat: 41.3792,
    lon: 2.1404,
    phone: "938 901 234",
    validUntil: "2026-12-31",
    rating: 4.1,
    reviews: 67,
    isFeatured: true,
  },
  {
    id: "8",
    business: "Accesorios AutoPro",
    category: "tienda",
    title: "Ambientadores premium",
    description: "Pack 3 ambientadores larga duración",
    discount: "2x1",
    originalPrice: "9,90€",
    finalPrice: "4,95€",
    address: "C/ Provença 410, Barcelona",
    lat: 41.4012,
    lon: 2.1745,
    phone: "939 012 345",
    validUntil: "2026-02-28",
    rating: 4.5,
    reviews: 34,
  },
];

const getWazeUrl = (lat: number, lon: number) => {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes&z=10`;
};

export function OffersView() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [savedOffers, setSavedOffers] = useState<Set<string>>(new Set());
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false);

  const filteredOffers = useMemo(() => {
    let filtered = sampleOffers;

    if (selectedCategory) {
      filtered = filtered.filter(o => o.category === selectedCategory);
    }
    if (showOnlyNew) {
      filtered = filtered.filter(o => o.isNew);
    }
    if (showOnlyFeatured) {
      filtered = filtered.filter(o => o.isFeatured);
    }

    return filtered;
  }, [selectedCategory, showOnlyNew, showOnlyFeatured]);

  const toggleSaved = (offerId: string) => {
    setSavedOffers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(offerId)) {
        newSet.delete(offerId);
      } else {
        newSet.add(offerId);
      }
      return newSet;
    });
  };

  const featuredOffers = useMemo(() =>
    sampleOffers.filter(o => o.isFeatured),
    []
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <BadgePercent className="h-7 w-7 text-primary" />
          <h1 className="text-[28px] font-bold tracking-tight">Ofertas</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Descuentos exclusivos para taxistas
        </p>
      </div>

      {/* Featured banner */}
      {featuredOffers.length > 0 && !selectedCategory && (
        <div className="flex-shrink-0 px-5 py-3">
          <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 rounded-2xl p-4 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Ofertas destacadas
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {featuredOffers.map(offer => {
                const cat = categories[offer.category];
                return (
                  <div
                    key={offer.id}
                    className="flex-shrink-0 bg-background/80 backdrop-blur rounded-xl p-3 min-w-[180px] border border-border/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{cat.emoji}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold line-clamp-1">{offer.business}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{offer.title}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {offer.discount}
                      </span>
                      <button
                        onClick={() => window.open(getWazeUrl(offer.lat, offer.lon), "_blank")}
                        className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"
                      >
                        <Navigation className="h-3.5 w-3.5 text-blue-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Category chips */}
      <div className="flex-shrink-0 px-5 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setShowOnlyNew(false);
              setShowOnlyFeatured(false);
            }}
            className={cn(
              "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-[0.98]",
              selectedCategory === null && !showOnlyNew && !showOnlyFeatured
                ? "bg-foreground text-background"
                : "bg-muted/60 text-foreground"
            )}
          >
            Todas
          </button>
          <button
            onClick={() => {
              setShowOnlyNew(!showOnlyNew);
              setShowOnlyFeatured(false);
              setSelectedCategory(null);
            }}
            className={cn(
              "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-[0.98] flex items-center gap-1.5",
              showOnlyNew
                ? "bg-green-500 text-white"
                : "bg-muted/60 text-foreground"
            )}
          >
            <Gift className="h-4 w-4" />
            Nuevas
          </button>
          {Object.entries(categories).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCategory(key as CategoryKey);
                setShowOnlyNew(false);
                setShowOnlyFeatured(false);
              }}
              className={cn(
                "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 active:scale-[0.98]",
                selectedCategory === key
                  ? "text-white"
                  : "bg-muted/60 text-foreground"
              )}
              style={selectedCategory === key ? { backgroundColor: cat.color } : {}}
            >
              <cat.icon className="h-4 w-4" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Offers list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-3 pb-28">
          <AnimatePresence mode="popLayout">
            {filteredOffers.map((offer, idx) => {
              const cat = categories[offer.category];
              const Icon = cat.icon;
              const isSaved = savedOffers.has(offer.id);
              const validDate = new Date(offer.validUntil);
              const isExpiringSoon = validDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

              return (
                <motion.div
                  key={offer.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  className="rounded-2xl bg-card border border-border/50 overflow-hidden"
                >
                  {/* Header with category and badges */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${cat.color}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: cat.color }}>
                          {cat.label}
                        </p>
                        <p className="text-sm font-semibold">{offer.business}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {offer.isNew && (
                        <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                          NUEVO
                        </span>
                      )}
                      <button
                        onClick={() => toggleSaved(offer.id)}
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                          isSaved ? "bg-primary/10" : "bg-muted/50"
                        )}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="h-4 w-4 text-primary" />
                        ) : (
                          <Bookmark className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Offer details */}
                  <div className="px-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold leading-snug">
                          {offer.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {offer.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="bg-green-500/10 px-3 py-1.5 rounded-lg">
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {offer.discount}
                          </p>
                        </div>
                        {offer.originalPrice && (
                          <p className="text-xs text-muted-foreground line-through mt-1">
                            {offer.originalPrice}
                          </p>
                        )}
                        {offer.finalPrice && (
                          <p className="text-sm font-semibold text-foreground">
                            {offer.finalPrice}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Code if exists */}
                    {offer.code && (
                      <div className="mt-3 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Código:</span>
                        <span className="text-sm font-mono font-bold tracking-wide">
                          {offer.code}
                        </span>
                      </div>
                    )}

                    {/* Rating */}
                    {offer.rating && (
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-semibold">{offer.rating}</span>
                        </div>
                        {offer.reviews && (
                          <span className="text-xs text-muted-foreground">
                            ({offer.reviews} reseñas)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer with location and actions */}
                  <div className="border-t border-border/30 bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{offer.address}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className={cn(
                            "flex items-center gap-1 text-xs",
                            isExpiringSoon ? "text-orange-500" : "text-muted-foreground"
                          )}>
                            <Clock className="h-3 w-3" />
                            <span>
                              {isExpiringSoon ? "Expira pronto: " : "Válido hasta "}
                              {validDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {offer.phone && (
                          <button
                            onClick={() => window.open(`tel:${offer.phone}`, "_self")}
                            className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center active:scale-[0.95] transition-transform"
                            title="Llamar"
                          >
                            <Phone className="h-5 w-5 text-green-600" />
                          </button>
                        )}
                        <button
                          onClick={() => window.open(getWazeUrl(offer.lat, offer.lon), "_blank")}
                          className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center active:scale-[0.95] transition-transform"
                          title="Ir con Waze"
                        >
                          <Navigation className="h-5 w-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredOffers.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Percent className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-base font-semibold">Sin ofertas</p>
              <p className="text-sm text-muted-foreground mt-1">
                No hay ofertas en esta categoría
              </p>
            </motion.div>
          )}

          {/* Info card */}
          <div className="mt-6 rounded-2xl bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">¿Tienes un negocio?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Si quieres ofrecer descuentos exclusivos para taxistas,
                  contacta con nosotros para aparecer en esta sección.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
