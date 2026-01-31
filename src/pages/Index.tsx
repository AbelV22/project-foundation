import { useState } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
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
import { CruisesView } from "@/components/views/CruisesView";
import { QuickEarningsSheet } from "@/components/widgets/QuickEarningsSheet";
import { WhereNextSheet } from "@/components/widgets/WhereNextSheet";
import { EarningsView } from "@/components/views/EarningsView";
import { ExpensesView } from "@/components/views/ExpensesView";
import { OffersView } from "@/components/views/OffersView";
import { AddExpenseSheet } from "@/components/widgets/AddExpenseSheet";

const titles: Record<string, string> = {
  dashboard: "Inicio",
  vuelos: "Vuelos Aeropuerto BCN",
  trenes: "Trenes Sants",
  cruceros: "Cruceros Puerto BCN",
  eventos: "Calendario de Eventos",
  licencias: "Precio de Licencias",
  gastos: "Registro de Gastos",
  alertas: "Alertas",
  terminalDetail: "Detalle Terminal",
  fullDay: "Vista Día Completo",
  trainsFullDay: "Trenes Sants",
  trainsByCity: "Trenes por Ciudad",
  trainsByOperator: "Trenes por Operador",
  earnings: "Registro de Ingresos",
  ofertas: "Ofertas Exclusivas",
};

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
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

  const handleViewCruises = () => {
    setActiveTab("cruceros");
  };

  const handleBackFromCruises = () => {
    setActiveTab("dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedTerminal(null);
          setSelectedTrainCity(null);
          setSelectedTrainOperator(null);
        }}
      />

      <main className="transition-all duration-300">
        <Header title={titles[activeTab]} />

        <div className="p-4 md:p-6 pb-bottom-nav">
          {activeTab === "dashboard" && (
            <DashboardView
              onTerminalClick={handleTerminalClick}
              onViewAllFlights={handleViewAllFlights}
              onViewAllEvents={handleViewAllEvents}
              onViewFullDay={handleViewFullDay}
              onViewTrainsFullDay={handleViewTrainsFullDay}
              onViewCruises={handleViewCruises}
              onViewLicenses={handleViewLicenses}
              onViewEarnings={() => setActiveTab("earnings")}
              onViewExpenses={() => setActiveTab("gastos")}
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
          {activeTab === "cruceros" && (
            <CruisesView onBack={handleBackFromCruises} />
          )}
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
          {activeTab === "trainsByOperator" && selectedTrainOperator && (
            <TrainsByOperatorView
              operator={selectedTrainOperator}
              onBack={handleBackFromTrainsByOperator}
            />
          )}
          {activeTab === "earnings" && (
            <EarningsView onBack={() => setActiveTab("dashboard")} />
          )}
          {activeTab === "gastos" && (
            <ExpensesView onBack={() => setActiveTab("dashboard")} />
          )}
          {activeTab === "ofertas" && <OffersView />}
        </div>
      </main>

      {/* Floating PRO Feature Buttons - Hidden in fullDay and trainsFullDay views */}
      <WhereNextSheet />
      {activeTab !== "fullDay" && activeTab !== "trainsFullDay" && (
        <>
          <QuickEarningsSheet />
          <AddExpenseSheet />
        </>
      )}
    </div>
  );
};

export default Index;
