import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DashboardView } from "@/components/views/DashboardView";
import { FlightsView } from "@/components/views/FlightsView";
import { EventsView } from "@/components/views/EventsView";
import { LicensesView } from "@/components/views/LicensesView";
import { AlertsView } from "@/components/views/AlertsView";
import { TerminalDetailView } from "@/components/views/TerminalDetailView";

const titles: Record<string, string> = {
  dashboard: "Inicio",
  vuelos: "Vuelos Aeropuerto BCN",
  eventos: "Calendario de Eventos",
  licencias: "Precio de Licencias",
  alertas: "Alertas",
  terminalDetail: "Detalle Terminal",
};

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedTerminal(null);
        }} 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className="lg:pl-64 transition-all duration-300">
        <Header title={titles[activeTab]} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        <div className="p-4 md:p-6">
          {activeTab === "dashboard" && (
            <DashboardView 
              onTerminalClick={handleTerminalClick}
              onViewAllFlights={handleViewAllFlights}
            />
          )}
          {activeTab === "vuelos" && <FlightsView />}
          {activeTab === "eventos" && <EventsView />}
          {activeTab === "licencias" && <LicensesView />}
          {activeTab === "alertas" && <AlertsView />}
          {activeTab === "terminalDetail" && selectedTerminal && (
            <TerminalDetailView 
              terminalId={selectedTerminal} 
              onBack={handleBackFromTerminal} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
