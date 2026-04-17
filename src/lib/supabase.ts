import { createClient } from '@supabase/supabase-js';

// URL ini saya ambil dari screenshot Anda
const supabaseUrl = "https://ypgmeblktxfuajvnghct.supabase.co"; 

// GANTI BAGIAN DI BAWAH INI DENGAN ANON KEY ASLI ANDA
// (Ambil dari Dashboard Supabase > Settings > API)
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwZ21lYmxrdHhmdWFqdm5naGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjIyMDMsImV4cCI6MjA5MTc5ODIwM30._feGrr4hciBLS2uEIst_eqjHU_sgxBL_uXiOQNtrh7Y";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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