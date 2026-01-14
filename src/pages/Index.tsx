import { useState, useEffect } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AnimatedView } from "@/components/layout/AnimatedView";
import { DashboardView } from "@/components/views/DashboardView";
import { FlightsView } from "@/components/views/FlightsView";
import { EventsView } from "@/components/views/EventsView";
import { LicensesView } from "@/components/views/LicensesView";
import { AlertsView } from "@/components/views/AlertsView";
import { TerminalDetailView } from "@/components/views/TerminalDetailView";
import { FullDayView } from "@/components/views/FullDayView";
import { TrainsFullDayView } from "@/components/views/TrainsFullDayView";
import { TrainsByCityView } from "@/components/views/TrainsByCityView";
import { TrainsByOperatorView } from "@/components/views/TrainsByOperatorView";
import { useTheme } from "@/hooks/useTheme";

const titles: Record<string, string> = {
  dashboard: "Inicio",
  vuelos: "Vuelos Aeropuerto BCN",
  trenes: "Trenes Sants",
  eventos: "Calendario de Eventos",
  licencias: "Precio de Licencias",
  alertas: "Alertas",
  terminalDetail: "Detalle Terminal",
  fullDay: "Vuelos Día Completo",
  trainsFullDay: "Trenes Sants",
  trainsByCity: "Trenes por Ciudad",
  trainsByOperator: "Trenes por Operador",
};

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [selectedTrainCity, setSelectedTrainCity] = useState<string | null>(null);
  const [selectedTrainOperator, setSelectedTrainOperator] = useState<string | null>(null);

  // Initialize theme
  useTheme();

  const handleTerminalClick = (terminalId: string) => {
    setSelectedTerminal(terminalId);
    setActiveTab("terminalDetail");
  };

  const handleBackFromTerminal = () => {
    setSelectedTerminal(null);
    setActiveTab("dashboard");
  };

  const handleViewAllFlights = () => {
    setActiveTab("fullDay");
  };

  const handleViewAllEvents = () => {
    setActiveTab("eventos");
  };

  const handleViewFullDay = () => {
    setActiveTab("fullDay");
  };

  const handleBackFromFullDay = () => {
    setActiveTab("dashboard");
  };

  const handleViewTrainsFullDay = () => {
    setActiveTab("trainsFullDay");
  };

  const handleBackFromTrainsFullDay = () => {
    setActiveTab("dashboard");
  };

  const handleTrainCityClick = (city: string) => {
    setSelectedTrainCity(city);
    setActiveTab("trainsByCity");
  };

  const handleBackFromTrainsByCity = () => {
    setSelectedTrainCity(null);
    setActiveTab("trainsFullDay");
  };

  const handleTrainOperatorClick = (operator: string) => {
    setSelectedTrainOperator(operator);
    setActiveTab("trainsByOperator");
  };

  const handleBackFromTrainsByOperator = () => {
    setSelectedTrainOperator(null);
    setActiveTab("trainsFullDay");
  };

  const handleViewLicenses = () => {
    setActiveTab("licencias");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedTerminal(null);
    setSelectedTrainCity(null);
    setSelectedTrainOperator(null);
  };

  const renderView = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardView 
            onTerminalClick={handleTerminalClick}
            onViewAllFlights={handleViewAllFlights}
            onViewAllEvents={handleViewAllEvents}
            onViewFullDay={handleViewFullDay}
            onViewTrainsFullDay={handleViewTrainsFullDay}
            onViewLicenses={handleViewLicenses}
          />
        );
      case "vuelos":
        return <FlightsView />;
      case "trenes":
      case "trainsFullDay":
        return (
          <TrainsFullDayView 
            onBack={handleBackFromTrainsFullDay}
            onCityClick={handleTrainCityClick}
            onOperatorClick={handleTrainOperatorClick}
          />
        );
      case "eventos":
        return <EventsView />;
      case "licencias":
        return <LicensesView />;
      case "alertas":
        return <AlertsView />;
      case "terminalDetail":
        return selectedTerminal ? (
          <TerminalDetailView 
            terminalId={selectedTerminal} 
            onBack={handleBackFromTerminal} 
          />
        ) : null;
      case "fullDay":
        return <FullDayView onBack={handleBackFromFullDay} />;
      case "trainsByCity":
        return selectedTrainCity ? (
          <TrainsByCityView 
            city={selectedTrainCity}
            onBack={handleBackFromTrainsByCity}
          />
        ) : null;
      case "trainsByOperator":
        return selectedTrainOperator ? (
          <TrainsByOperatorView 
            operator={selectedTrainOperator}
            onBack={handleBackFromTrainsByOperator}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Desktop Top Navigation */}
      <TopNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />
      
      {/* Mobile Header */}
      <MobileHeader 
        title={titles[activeTab]} 
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />
      
      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={handleTabChange}
      />
      
      {/* Main Content with Animations */}
      <main className="lg:pt-16 pb-20 lg:pb-6">
        <div className="p-4 md:p-6">
          <AnimatedView viewKey={activeTab}>
            {renderView()}
          </AnimatedView>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
      />
    </div>
  );
};

export default Index;
