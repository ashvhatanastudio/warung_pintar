import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { LayoutDashboard, ShoppingCart, Package, BarChart3, LogOut, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { profile, signOut } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard, roles: ['admin', 'kasir'] },
    { id: 'cashier', label: 'Kasir', icon: ShoppingCart, roles: ['admin', 'kasir'] },
    { id: 'inventory', label: 'Stok', icon: Package, roles: ['admin'] },
    { id: 'reports', label: 'Laporan', icon: BarChart3, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    profile && item.roles.includes(profile.role)
  );

  return (
    <div className="flex flex-col min-h-screen bg-bg-app pb-20">
      {/* Header */}
      <header className="bg-white text-slate-900 h-16 border-b border-slate-200 sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-7xl mx-auto h-full px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold">
              W
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900">Warung Pintar</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="status-pill bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Online
            </div>
            <button 
              onClick={() => signOut()}
              className="p-2 text-slate-400 hover:text-danger hover:bg-danger/5 rounded-full transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-20 w-full max-w-7xl mx-auto md:left-1/2 md:-translate-x-1/2 md:rounded-t-3xl md:shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "bottom-nav-item",
              activeTab === item.id ? "text-primary" : "text-slate-400"
            )}
          >
            <item.icon size={24} className={cn(
              "transition-transform",
              activeTab === item.id && "scale-110"
            )} />
            <span className="text-[10px] font-bold uppercase mt-1 tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
