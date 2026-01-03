import { QuickStats } from "@/components/widgets/QuickStats";
import { FlightsWidget } from "@/components/widgets/FlightsWidget";
import { EventsWidget } from "@/components/widgets/EventsWidget";
import { LicensePriceWidget } from "@/components/widgets/LicensePriceWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";

export function DashboardView() {
  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Quick Stats - Most important first */}
      <QuickStats />

      {/* Flights widget - Full width for prominence */}
      <FlightsWidget />

      {/* Secondary widgets grid */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <EventsWidget />
        <LicensePriceWidget />
      </div>

      {/* Weather - Less prominent at bottom */}
      <WeatherWidget />
    </div>
  );
}
