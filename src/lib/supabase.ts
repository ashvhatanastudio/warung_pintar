import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

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
      // Return a dummy function for common calls to prevent immediate crashes
      return (...args: any[]) => {
        console.error(`Supabase call to "${String(prop)}" failed: Client not initialized. Check your environment variables.`);
        return { data: null, error: new Error('Supabase not initialized') };
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
