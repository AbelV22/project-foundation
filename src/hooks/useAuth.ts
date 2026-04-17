import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UseAuthResult {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
}

/**
 * Lightweight auth hook. Tracks the Supabase session and exposes
 * whether the user is signed in. Used to gate features that persist
 * user-owned data (earnings, expenses) so unregistered users do not
 * read or write to shared/device-scoped rows.
 */
export function useAuth(): UseAuthResult {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        supabase.auth.getUser().then(({ data }) => {
            if (!mounted) return;
            setUser(data.user ?? null);
            setLoading(false);
        }).catch(() => {
            if (!mounted) return;
            setUser(null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return { user, loading, isAuthenticated: !!user };
}
