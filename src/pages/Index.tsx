import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
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

const titles: Record<string, string> = {
  dashboard: "Inicio",
  vuelos: "Vuelos Aeropuerto BCN",
  trenes: "Trenes Sants",
  eventos: "Calendario de Eventos",
  licencias: "Precio de Licencias",
  alertas: "Alertas",
  terminalDetail: "Detalle Terminal",
  fullDay: "Vista Día Completo",
  trainsFullDay: "Trenes Sants",
  trainsByCity: "Trenes por Ciudad",
  trainsByOperator: "Trenes por Operador",
};

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [selectedTrainCity, setSelectedTrainCity] = useState<string | null>(null);
  const [selectedTrainOperator, setSelectedTrainOperator] = useState<string | null>(null);

  const handleTerminalClick = (terminalId: string) => {
    setSelectedTerminal(terminalId);
    setActiveTab("terminalDetail");
  };

  const handleBackFromTerminal = () => {
    setSelectedTerminal(null);
    setActiveTab("dashboard");
  };

  const handleViewAllFlights = () => {
    setActiveTab("vuelos");
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedTerminal(null);
          setSelectedTrainCity(null);
          setSelectedTrainOperator(null);
        }} 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className="lg:pl-56 transition-all duration-300">
        <Header title={titles[activeTab]} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        <div className="p-4 md:p-6">
          {activeTab === "dashboard" && (
            <DashboardView 
              onTerminalClick={handleTerminalClick}
              onViewAllFlights={handleViewAllFlights}
              onViewAllEvents={handleViewAllEvents}
              onViewFullDay={handleViewFullDay}
              onViewTrainsFullDay={handleViewTrainsFullDay}
              onViewLicenses={handleViewLicenses}
            />
          )}
          {activeTab === "vuelos" && <FlightsView />}
          {activeTab === "trenes" && (
            <TrainsFullDayView 
              onBack={() => setActiveTab("dashboard")}
              onCityClick={handleTrainCityClick}
              onOperatorClick={handleTrainOperatorClick}
            />
          )}
          {activeTab === "eventos" && <EventsView />}
          {activeTab === "licencias" && <LicensesView />}
          {activeTab === "alertas" && <AlertsView />}
          {activeTab === "terminalDetail" && selectedTerminal && (
            <TerminalDetailView 
              terminalId={selectedTerminal} 
              onBack={handleBackFromTerminal} 
            />
          )}
          {activeTab === "fullDay" && (
            <FullDayView onBack={handleBackFromFullDay} />
          )}
          {activeTab === "trainsFullDay" && (
            <TrainsFullDayView 
              onBack={handleBackFromTrainsFullDay}
              onCityClick={handleTrainCityClick}
              onOperatorClick={handleTrainOperatorClick}
            />
          )}
          {activeTab === "trainsByCity" && selectedTrainCity && (
            <TrainsByCityView 
              city={selectedTrainCity}
              onBack={handleBackFromTrainsByCity}
            />
          )}
          {activeTab === "trainsByOperator" && selectedTrainOperator && (
            <TrainsByOperatorView 
              operator={selectedTrainOperator}
              onBack={handleBackFromTrainsByOperator}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
