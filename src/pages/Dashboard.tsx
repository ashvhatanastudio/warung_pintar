import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { TrendingUp, Users, Package, AlertTriangle, PlusCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const [stats, setStats] = useState({
    omzet: 0,
    transactions: 0,
    lowStock: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch Omzet & Transactions
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('total_amount')
        .gte('created_at', today.toISOString());

      if (transError) throw transError;

      const omzet = transData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      const transactions = transData.length;

      // Fetch Low Stock
      const { count, error: stockError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .lt('stock', 5); // Using 5 as default threshold

      if (stockError) throw stockError;

      setStats({
        omzet,
        transactions,
        lowStock: count || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    { 
      title: 'Omzet Hari Ini', 
      value: formatCurrency(stats.omzet), 
      icon: TrendingUp, 
      color: 'bg-emerald-50 text-emerald-600',
      desc: 'Total penjualan kotor'
    },
    { 
      title: 'Jumlah Transaksi', 
      value: stats.transactions, 
      icon: Users, 
      color: 'bg-blue-50 text-blue-600',
      desc: 'Pelanggan hari ini'
    },
    { 
      title: 'Stok Menipis', 
      value: stats.lowStock, 
      icon: AlertTriangle, 
      color: stats.lowStock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400',
      desc: 'Perlu restock segera'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Halo, Selamat Datang!</h2>
          <p className="text-slate-500 text-sm">Berikut ringkasan warung Anda hari ini.</p>
        </div>
        <button 
          onClick={() => setActiveTab('cashier')}
          className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 flex items-center gap-2 font-bold text-sm active:scale-95 transition-all"
        >
          <PlusCircle size={20} />
          <span>Transaksi Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="card-sleek p-5 flex items-center gap-4"
          >
            <div className={cn("p-4 rounded-2xl", card.color)}>
              <card.icon size={28} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.title}</p>
              <h3 className="text-xl font-bold text-slate-900">{card.value}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{card.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card-sleek p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-900">Aksi Cepat</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setActiveTab('inventory')}
            className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors gap-2"
          >
            <Package className="text-primary" size={24} />
            <span className="text-xs font-bold text-slate-600">Update Stok</span>
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors gap-2"
          >
            <TrendingUp className="text-primary" size={24} />
            <span className="text-xs font-bold text-slate-600">Lihat Laporan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
