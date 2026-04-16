import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Download, Loader2, TrendingUp, ShoppingBag, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [data, setData] = useState<any[]>([]);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7days');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [period]);

  async function fetchReport() {
    setLoading(true);
    try {
      const startDate = new Date();
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === '7days') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30days') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (period === 'year') {
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
      }

      const [transRes, prodRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id, 
            invoice_no, 
            total_amount, 
            created_at, 
            payment_method,
            transaction_details (
              qty,
              products (name)
            )
          `)
          .gte('created_at', startDate.toISOString())
          .order('created_at'),
        supabase
          .from('products')
          .select('*')
      ]);

      if (transRes.error) throw transRes.error;
      if (prodRes.error) throw prodRes.error;

      setRawTransactions(transRes.data || []);
      setProducts(prodRes.data || []);

      // Process data for chart
      const chartData: any = {};
      
      transRes.data.forEach(t => {
        const date = new Date(t.created_at).toLocaleDateString('id-ID', { 
          day: period === 'year' ? undefined : 'numeric', 
          month: 'short',
          year: period === 'year' ? 'numeric' : undefined
        });
        chartData[date] = (chartData[date] || 0) + Number(t.total_amount);
      });

      setData(Object.keys(chartData).map(date => ({ date, amount: chartData[date] })));
    } catch (err) {
      console.error('Error fetching report:', err);
      toast.error('Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  }

  const totalOmzet = rawTransactions.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
  
  // Calculate Profits
  const totalModalTerjual = rawTransactions.reduce((acc, curr) => {
    return acc + (curr.transaction_details?.reduce((sum: number, d: any) => {
      // Use buy_price from products if available, or fallback to 0
      const buyPrice = products.find(p => p.name === d.products?.name)?.buy_price || 0;
      return sum + (d.qty * buyPrice);
    }, 0) || 0);
  }, 0);

  const grossProfit = totalOmzet - totalModalTerjual;
  // For now, net profit is same as gross profit as we don't track operational expenses yet
  // But we can add a placeholder for future expense tracking
  const netProfit = grossProfit; 

  const totalTransactions = rawTransactions.length;
  const totalItemsSold = rawTransactions.reduce((acc, curr) => {
    return acc + (curr.transaction_details?.reduce((sum: number, d: any) => sum + d.qty, 0) || 0);
  }, 0);

  const lowStockItems = products.filter(p => p.stock <= p.threshold);
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.stock * p.buy_price), 0);

  const downloadReport = async () => {
    if (rawTransactions.length === 0 && products.length === 0) {
      toast.error('Tidak ada data untuk diunduh');
      return;
    }

    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const periodText = {
        'today': 'Harian',
        '7days': 'Mingguan (7 Hari)',
        '30days': 'Bulanan (30 Hari)',
        'year': 'Tahunan'
      }[period];

      doc.setFontSize(18);
      doc.text('LAPORAN LENGKAP - WARUNG PINTAR', 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Periode: ${periodText}`, 105, 22, { align: 'center' });
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 105, 28, { align: 'center' });

      // Sales Summary Section
      doc.setFontSize(14);
      doc.text('1. RINGKASAN PENJUALAN & LABA', 14, 40);
      doc.setFontSize(10);
      doc.text(`Total Omzet: ${formatCurrency(totalOmzet)}`, 14, 48);
      doc.text(`Total Modal Terjual: ${formatCurrency(totalModalTerjual)}`, 14, 54);
      doc.text(`Laba Kotor (Gross Profit): ${formatCurrency(grossProfit)}`, 14, 60);
      doc.text(`Jumlah Transaksi: ${totalTransactions}`, 14, 66);
      doc.text(`Total Produk Terjual: ${totalItemsSold}`, 14, 72);

      // Sales Table
      const salesTableData = rawTransactions.map((t, index) => [
        index + 1,
        new Date(t.created_at).toLocaleString('id-ID'),
        t.invoice_no,
        t.transaction_details?.map((d: any) => `${d.products?.name} (${d.qty})`).join(', '),
        formatCurrency(t.total_amount)
      ]);

      autoTable(doc, {
        startY: 78,
        head: [['No', 'Tanggal', 'No. Invoice', 'Item (Qty)', 'Total']],
        body: salesTableData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
      });

      // Stock Report Section
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('2. LAPORAN STOK & INVENTARIS', 14, finalY);
      doc.setFontSize(10);
      doc.text(`Total Nilai Inventaris (Modal): ${formatCurrency(totalInventoryValue)}`, 14, finalY + 8);
      doc.text(`Produk Stok Menipis: ${lowStockItems.length}`, 14, finalY + 14);

      const stockTableData = products.map((p, index) => [
        index + 1,
        p.name,
        p.stock,
        p.unit,
        formatCurrency(p.buy_price),
        formatCurrency(p.stock * p.buy_price)
      ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['No', 'Nama Produk', 'Stok', 'Unit', 'Harga Beli', 'Subtotal Modal']],
        body: stockTableData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
      });

      doc.save(`Laporan_Lengkap_${periodText}_${Date.now()}.pdf`);
      toast.success('Laporan berhasil diunduh');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Gagal mengunduh laporan');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Laporan & Analisis</h2>
          <p className="text-slate-500 text-sm">Pantau penjualan dan stok warung Anda.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none shadow-sm"
          >
            <option value="today">Hari Ini</option>
            <option value="7days">7 Hari Terakhir</option>
            <option value="30days">30 Hari Terakhir</option>
            <option value="year">Tahun Ini</option>
          </select>
          <button
            onClick={downloadReport}
            disabled={isDownloading || loading}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Unduh Laporan</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sales Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-sleek p-6 bg-indigo-50 border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Omzet</p>
              <h3 className="text-xl font-black text-indigo-700 mt-1">{formatCurrency(totalOmzet)}</h3>
            </div>
            <div className="card-sleek p-6 bg-emerald-50 border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Laba Kotor</p>
              <h3 className="text-xl font-black text-emerald-700 mt-1">{formatCurrency(grossProfit)}</h3>
            </div>
            <div className="card-sleek p-6 bg-blue-50 border-blue-100">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Laba Bersih</p>
              <h3 className="text-xl font-black text-blue-700 mt-1">{formatCurrency(netProfit)}</h3>
            </div>
            <div className="card-sleek p-6 bg-amber-50 border-amber-100">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Produk Terjual</p>
              <h3 className="text-xl font-black text-amber-700 mt-1">{totalItemsSold} <span className="text-sm font-bold">Item</span></h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Chart */}
            <div className="card-sleek p-6">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                Tren Penjualan
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `Rp${val/1000}k`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [formatCurrency(val), 'Penjualan']}
                    />
                    <Bar dataKey="amount" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stock Summary */}
            <div className="card-sleek p-6">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-500" />
                Laporan Stok & Inventaris
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nilai Modal Stok</p>
                    <p className="font-bold text-slate-900">{formatCurrency(totalInventoryValue)}</p>
                  </div>
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <TrendingUp size={20} />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <div>
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Stok Menipis</p>
                    <p className="font-bold text-rose-700">{lowStockItems.length} Produk</p>
                  </div>
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                    <ShoppingBag size={20} />
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Daftar Stok Menipis:</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-hide">
                    {lowStockItems.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Semua stok aman.</p>
                    ) : (
                      lowStockItems.map(p => (
                        <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-white border border-slate-100 rounded-lg">
                          <span className="font-medium text-slate-700">{p.name}</span>
                          <span className="font-bold text-rose-600">{p.stock} {p.unit}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
