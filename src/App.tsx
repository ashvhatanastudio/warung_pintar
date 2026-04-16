import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cashier from './pages/Cashier';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import { Toaster } from 'sonner';
import { Package } from 'lucide-react';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const isConfigured = process.env.VITE_SUPABASE_URL && 
                      process.env.VITE_SUPABASE_URL !== 'https://your-project-url.supabase.co' &&
                      process.env.VITE_SUPABASE_ANON_KEY;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-app">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-app p-6">
        <div className="card-sleek p-8 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
            <Package size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Konfigurasi Diperlukan</h2>
            <p className="text-sm text-slate-500">
              Silakan atur variabel lingkungan <strong>VITE_SUPABASE_URL</strong> dan <strong>VITE_SUPABASE_ANON_KEY</strong> di panel Secrets AI Studio untuk menghubungkan database Anda.
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Petunjuk:</p>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal ml-4">
              <li>Buka proyek Supabase Anda</li>
              <li>Pergi ke Project Settings &gt; API</li>
              <li>Salin Project URL dan anon public key</li>
              <li>Tempelkan ke panel Secrets di AI Studio</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'cashier':
        return <Cashier />;
      case 'inventory':
        return profile.role === 'admin' ? <Inventory /> : <Dashboard setActiveTab={setActiveTab} />;
      case 'reports':
        return profile.role === 'admin' ? <Reports /> : <Dashboard setActiveTab={setActiveTab} />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
