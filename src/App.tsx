import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { startAutoTracking, initTestingMode } from "./services/location/AutoLocationService";
import { requestLocationPermission, checkLocationPermission } from "./services/native/geolocation";
import { 
  initBackgroundGeolocation, 
  shouldRestoreBackgroundTracking,
  isNativePlatform 
} from "./services/native/backgroundGeolocation";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Initialize native features when running on Android/iOS
// Uses background geolocation on native, foreground on web
const initializeNative = async (setPermissionDenied: (denied: boolean) => void) => {
  // Initialize testing mode from localStorage (works on all platforms)
  initTestingMode();

  // Check if testing mode is enabled (for web tracking)
  const isTestingMode = localStorage.getItem('geofence_testing_mode') === 'true';

  if (!Capacitor.isNativePlatform()) {
    // On web, only start tracking if testing mode is enabled
    if (isTestingMode) {
      console.log('[App] Web platform with testing mode - starting tracking');
      startAutoTracking((zona) => {
        console.log('[App] Zone changed to:', zona);
      });
    }
    return;
  }

  try {
    // Configure status bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0f172a" });

    // Hide splash screen after app is ready
    await SplashScreen.hide();

    // Request location permission explicitly
    console.log('[App] Requesting location permission...');
    const hasPermission = await requestLocationPermission();

    if (!hasPermission) {
      console.warn('[App] Location permission denied');
      setPermissionDenied(true);
      const currentStatus = await checkLocationPermission();
      if (!currentStatus) {
        console.log('[App] Permission not granted, will retry on user action');
      }
      return;
    }

    console.log('[App] Location permission granted');

    // Check if background tracking should be restored
    const shouldRestoreBackground = shouldRestoreBackgroundTracking();
    
    if (shouldRestoreBackground || isTestingMode) {
      // Use background geolocation for continuous tracking
      console.log('[App] Initializing background geolocation...');
      const bgSuccess = await initBackgroundGeolocation();
      
      if (bgSuccess) {
        console.log('[App] ✅ Background geolocation active');
      } else {
        // Fallback to foreground tracking
        console.log('[App] Falling back to foreground tracking...');
        startAutoTracking((zona) => {
          console.log('[App] Zone changed to:', zona);
        });
      }
    } else {
      // Start foreground tracking by default
      console.log('[App] Starting foreground tracking...');
      startAutoTracking((zona) => {
        console.log('[App] Zone changed to:', zona);
      });
    }
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
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    initializeNative(setPermissionDenied);
  }, []);

  const handleRetryPermission = async () => {
    const hasPermission = await requestLocationPermission();
    if (hasPermission) {
      setPermissionDenied(false);
      startAutoTracking((zona) => {
        console.log('[App] Zone changed to:', zona);
      });
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* Permission denied banner */}
        {permissionDenied && (
          <div
            onClick={handleRetryPermission}
            className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 text-white px-4 py-3 text-center cursor-pointer"
          >
            <p className="text-sm font-medium">
              📍 Se requiere permiso de ubicación para el tracking
            </p>
            <p className="text-xs opacity-80">
              Toca aquí para activar los permisos
            </p>
          </div>
        )}
        <BrowserRouter>
          <BackButtonHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

