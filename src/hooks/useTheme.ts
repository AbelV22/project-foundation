import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'auto';

// Barcelona coordinates for sunrise/sunset calculation
const BARCELONA_LAT = 41.3851;
const BARCELONA_LNG = 2.1734;

/**
 * Calculate sunrise and sunset times for Barcelona
 * Using simplified sunrise equation
 */
function getBarcelonaSunTimes(): { sunrise: number; sunset: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Simplified sunrise/sunset calculation for Barcelona
    // Using approximate formula based on day of year
    const declinationAngle = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
    const latRad = BARCELONA_LAT * (Math.PI / 180);
    const decRad = declinationAngle * (Math.PI / 180);

    // Hour angle at sunrise/sunset
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
    const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * (180 / Math.PI);

    // Convert to hours (solar noon at 12:00 + timezone offset for Barcelona CET/CEST)
    const isDST = isDaylightSavingTime(now);
    const tzOffset = isDST ? 2 : 1; // CEST (+2) or CET (+1)

    const solarNoon = 12 + tzOffset - (BARCELONA_LNG / 15); // Adjust for longitude
    const sunriseHour = solarNoon - (hourAngle / 15);
    const sunsetHour = solarNoon + (hourAngle / 15);

    return {
        sunrise: sunriseHour,
        sunset: sunsetHour
    };
}

/**
 * Check if current date is in DST (Europe/Madrid rules)
 */
function isDaylightSavingTime(date: Date): boolean {
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    return date.getTimezoneOffset() < stdOffset;
}

/**
 * Determine if it's daytime in Barcelona right now
 */
function isBarcelonaDaytime(): boolean {
    const now = new Date();
    // Get Barcelona time
    const barcelonaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const currentHour = barcelonaTime.getHours() + barcelonaTime.getMinutes() / 60;

    const { sunrise, sunset } = getBarcelonaSunTimes();

    return currentHour >= sunrise && currentHour < sunset;
}

/**
 * Get the theme that should be applied based on settings and time
 */
function getEffectiveTheme(themeSetting: Theme): 'light' | 'dark' {
    if (themeSetting === 'auto') {
        return isBarcelonaDaytime() ? 'light' : 'dark';
    }
    return themeSetting;
}

/**
 * Update the theme-color meta tag
 */
function updateThemeColorMeta(theme: 'light' | 'dark') {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', theme === 'light' ? '#faf9f7' : '#0f1419');
    }
}

/**
 * Custom hook for theme management with Barcelona time-based auto-detection
 */
export function useTheme() {
    const [themeSetting, setThemeSetting] = useState<Theme>(() => {
        // Check localStorage for saved preference
        const saved = localStorage.getItem('itaxibcn-theme') as Theme | null;
        return saved || 'auto'; // Default to auto (Barcelona time-based)
    });

    const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => {
        return getEffectiveTheme(themeSetting);
    });

    // Apply theme to document
    const applyTheme = useCallback((theme: 'light' | 'dark') => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        updateThemeColorMeta(theme);
        setEffectiveTheme(theme);
    }, []);

    // Update theme when setting changes
    useEffect(() => {
        const newEffective = getEffectiveTheme(themeSetting);
        applyTheme(newEffective);
        localStorage.setItem('itaxibcn-theme', themeSetting);
    }, [themeSetting, applyTheme]);

    // For auto mode: check and update theme every minute
    useEffect(() => {
        if (themeSetting !== 'auto') return;

        const checkAndUpdateTheme = () => {
            const newEffective = getEffectiveTheme('auto');
            if (newEffective !== effectiveTheme) {
                applyTheme(newEffective);
            }
        };

        // Check every minute
        const interval = setInterval(checkAndUpdateTheme, 60 * 1000);

        return () => clearInterval(interval);
    }, [themeSetting, effectiveTheme, applyTheme]);

    // Theme toggle functions
    const setTheme = useCallback((theme: Theme) => {
        setThemeSetting(theme);
    }, []);

    const toggleTheme = useCallback(() => {
        // Cycle through: auto -> light -> dark -> auto
        setThemeSetting(current => {
            switch (current) {
                case 'auto': return 'light';
                case 'light': return 'dark';
                case 'dark': return 'auto';
                default: return 'auto';
            }
        });
    }, []);

    return {
        themeSetting,      // 'light' | 'dark' | 'auto'
        effectiveTheme,    // 'light' | 'dark' (actual applied theme)
        setTheme,          // Set specific theme
        toggleTheme,       // Cycle through themes
        isAuto: themeSetting === 'auto',
        isDark: effectiveTheme === 'dark',
        isLight: effectiveTheme === 'light',
    };
}
