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
import { getOrCreateDeviceId, registerDevice } from "@/lib/deviceId";
import {
  initBackgroundGeolocation,
  shouldRestoreBackgroundTracking,
  isNativePlatform
} from "./services/native/backgroundGeolocation";
import { configureProTracking, startProTracking, isProTrackingActive } from "./services/native/proTracking";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Supabase config from environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Initialize native features when running on Android/iOS
// Uses PRO tracking (ForegroundService + AlarmManager) on native
const initializeNative = async (setPermissionDenied: (denied: boolean) => void) => {
  // Initialize testing mode from localStorage (works on all platforms)
  initTestingMode();

  // Check if testing mode is enabled (for web tracking)
  const isTestingMode = localStorage.getItem('geofence_testing_mode') === 'true';

  if (!Capacitor.isNativePlatform()) {
    // On web, start tracking automatically (browser will ask for permission)
    console.log('[App] Web platform - starting tracking');
    startAutoTracking((zona) => {
      console.log('[App] Zone changed to:', zona);
    });
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

    // ALWAYS start tracking on native platform (no admin action required)
    // User just needs to install the APK and grant location permission
    console.log('[App] Initializing PRO tracking system (auto-start enabled)...');

    {
      // Register device and get simple numeric ID (1, 2, 3, ...)
      const deviceName = localStorage.getItem('geofence_device_name') || 'Taxi';
      const deviceNumber = await registerDevice(deviceName);
      const deviceId = `D${deviceNumber}`; // Simple ID like D1, D2, D3
      console.log(`[App] Registered as device ${deviceId}`);

      // Configure the native service with Supabase credentials
      console.log('[App] Configuring ProTracking with Supabase...');
      const configured = await configureProTracking(
        SUPABASE_URL,
        SUPABASE_KEY,
        deviceId,
        deviceName
      );

      if (configured) {
        console.log('[App] ✅ ProTracking configured');

        // Start the native ForegroundService
        const started = await startProTracking();

        if (started) {
          console.log('[App] ✅ PRO tracking active (ForegroundService + AlarmManager)');
        } else {
          console.log('[App] ⚠️ PRO tracking failed to start, falling back to old method');
          await initBackgroundGeolocation();
        }
      } else {
        console.log('[App] ⚠️ ProTracking config failed, falling back to old method');
        await initBackgroundGeolocation();
      }
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

import PrivacyPolicy from "./pages/PrivacyPolicy";
import SettingsView from "./components/views/SettingsView";

import { LocationDisclosureDialog } from "@/components/LocationDisclosureDialog";
import { getItem, setItem } from "@/lib/storage";

const App = () => {
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);

  useEffect(() => {
    const checkDisclosure = async () => {
      const ack = await getItem('disclosure_ack');
      if (ack !== 'true' && Capacitor.isNativePlatform()) {
        setDisclosureOpen(true);
      } else {
        // Already acked or web, proceed
        initializeNative(setPermissionDenied);
      }
    };
    checkDisclosure();
  }, []);

  const handleDisclosureAccept = async () => {
    await setItem('disclosure_ack', 'true');
    setDisclosureOpen(false);
    initializeNative(setPermissionDenied);
  };

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
        <LocationDisclosureDialog
          open={disclosureOpen}
          onAccept={handleDisclosureAccept}
        />
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
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/settings" element={<SettingsView />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

