import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.itaxibcn.app',
  appName: 'iTaxiBcn',
  webDir: 'dist',
  server: {
    // For production, remove this block
    // For development with live reload, uncomment:
    // url: 'http://YOUR_LOCAL_IP:8080',
    // cleartext: true
  },
  android: {
    // Required for background geolocation to work properly
    // Allows the watcher to continue running after 5 minutes
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      backgroundColor: '#0f172a',
      style: 'DARK',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    BackgroundGeolocation: {
      // Configuration for background location tracking
    },
  },
};

export default config;
