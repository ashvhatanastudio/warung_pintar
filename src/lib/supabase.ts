import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://your-project-url.supabase.co') {
    console.warn('Supabase credentials are not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

// Export a proxy or a getter-based object to maintain compatibility with existing imports
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    const client = getSupabase();
    if (!client) {
      // Handle nested properties like auth.signUp
      if (prop === 'auth' || prop === 'from' || prop === 'rpc') {
        const dummy = (...args: any[]) => {
          const errorMsg = 'Konfigurasi Supabase salah. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah terisi di file .env sebelum melakukan build.';
          console.error(errorMsg);
          return { data: null, error: new Error(errorMsg) };
        };
        // If it's auth/from/rpc, return a proxy that returns dummy functions for any sub-prop
        return new Proxy(dummy, {
          get: (target, subProp) => dummy
        });
      }
      
      return (...args: any[]) => {
        const errorMsg = 'Konfigurasi Supabase salah. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah terisi di file .env sebelum melakukan build.';
        console.error(errorMsg);
        return { data: null, error: new Error(errorMsg) };
      };
    }
    return (client as any)[prop];
  }
});

export type Profile = {
  id: string;
  role: 'admin' | 'kasir';
  full_name: string;
};

export type Product = {
  id: number;
  name: string;
  category_id: number;
  buy_price: number;
  sell_price: number;
  stock: number;
  unit: string;
  barcode: string;
  threshold: number;
  is_active?: boolean;
};

export type Category = {
  id: number;
  name: string;
};
