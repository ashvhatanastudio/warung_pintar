import { createClient } from '@supabase/supabase-js';

// URL & KEY LANGSUNG DI SINI (HARDCODE)
const supabaseUrl = "https://ypgmeblktxfuajvnghct.supabase.co"; 
const supabaseAnonKey = "MASUKKAN_ANON_KEY_ANDA_DI_SINI"; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export type Profile = {
  id: string;
  role: 'admin' | 'kasir';
  full_name: string;
};

// ... baris lainnya (Product, Category) biarkan saja

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
