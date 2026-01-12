import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Initialize native features when running on Android/iOS
const initializeNative = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Configure status bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0f172a" });

    // Hide splash screen after app is ready
    await SplashScreen.hide();
  } catch (error) {
    console.error("Error initializing native features:", error);
  }
};

// Component to handle Android hardware back button
const BackButtonHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapacitorApp.addListener(
      "backButton",
      ({ canGoBack }) => {
        if (canGoBack) {
          navigate(-1);
        } else {
          // If we can't go back, minimize the app (don't exit)
          CapacitorApp.minimizeApp();
        }
      }
    );

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, [navigate]);

  return null;
};

const App = () => {
  useEffect(() => {
    initializeNative();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BackButtonHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

