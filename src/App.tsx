import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cashier from './pages/Cashier';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import { Toaster } from 'sonner';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Loading state
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-app">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Cek apakah user sudah login
  if (!user) {
    return <Login />;
  }

  // Fallback jika profil belum ada di database
  const userRole = profile?.role || 'kasir';

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'cashier':
        return <Cashier />;
      case 'inventory':
        return userRole === 'admin' ? <Inventory /> : <Dashboard setActiveTab={setActiveTab} />;
      case 'reports':
        return userRole === 'admin' ? <Reports /> : <Dashboard setActiveTab={setActiveTab} />;
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