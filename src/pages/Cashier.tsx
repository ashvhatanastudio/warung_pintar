import React, { useState, useEffect, useRef } from 'react';
import { supabase, type Product, type Category } from '../lib/supabase';
import { formatCurrency, cn } from '../lib/utils';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, QrCode, Wallet, ReceiptText, Loader2, X, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CartItem extends Product {
  qty: number;
}

export default function Cashier() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [cashAmount, setCashAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('categories').select('*').order('name')
      ]);
      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         (p.barcode && p.barcode.includes(search));
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error('Stok habis!');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.error('Stok tidak mencukupi!');
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
    toast.success(`${product.name} ditambahkan`);
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.sell_price * item.qty), 0);
  const total = subtotal;
  const change = Number(cashAmount) > total ? Number(cashAmount) - total : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'Tunai' && Number(cashAmount) < total) {
      toast.error('Uang bayar kurang!');
      return;
    }

    setIsProcessing(true);
    try {
      const invoiceNo = `INV-${Date.now()}`;
      
      // 1. Create Transaction
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .insert({
          invoice_no: invoiceNo,
          total_amount: total,
          payment_method: paymentMethod,
          cash_amount: paymentMethod === 'Tunai' ? Number(cashAmount) : total,
          change_amount: paymentMethod === 'Tunai' ? change : 0,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (transError) throw transError;

      // 2. Create Transaction Details
      const details = cart.map(item => ({
        transaction_id: transData.id,
        product_id: item.id,
        qty: item.qty,
        price: item.sell_price,
        subtotal: item.sell_price * item.qty
      }));

      const { error: detailsError } = await supabase
        .from('transaction_details')
        .insert(details);

      if (detailsError) throw detailsError;

      toast.success('Transaksi Berhasil!');
      generateReceipt(invoiceNo, transData.created_at);
      setCart([]);
      setIsCheckoutOpen(false);
      setCashAmount('');
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.message || 'Gagal memproses transaksi');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReceipt = (invoiceNo: string, date: string) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [58, 150] // Thermal printer size
    });

    doc.setFontSize(10);
    doc.text('WARUNG PINTAR', 29, 10, { align: 'center' });
    doc.setFontSize(7);
    doc.text('Jl. Raya Warung No. 123', 29, 14, { align: 'center' });
    doc.text('--------------------------------', 29, 18, { align: 'center' });
    doc.text(`No: ${invoiceNo}`, 5, 22);
    doc.text(`Tgl: ${new Date(date).toLocaleString()}`, 5, 26);
    doc.text('--------------------------------', 29, 30, { align: 'center' });

    let y = 34;
    cart.forEach(item => {
      doc.text(`${item.name}`, 5, y);
      doc.text(`${item.qty} x ${formatCurrency(item.sell_price)}`, 5, y + 4);
      doc.text(`${formatCurrency(item.sell_price * item.qty)}`, 53, y + 4, { align: 'right' });
      y += 10;
    });

    doc.text('--------------------------------', 29, y, { align: 'center' });
    doc.setFontSize(9);
    doc.text('TOTAL:', 5, y + 6);
    doc.text(`${formatCurrency(total)}`, 53, y + 6, { align: 'right' });
    
    doc.setFontSize(7);
    doc.text('Metode:', 5, y + 12);
    doc.text(`${paymentMethod}`, 53, y + 12, { align: 'right' });
    
    if (paymentMethod === 'Tunai') {
      doc.text('Bayar:', 5, y + 16);
      doc.text(`${formatCurrency(Number(cashAmount))}`, 53, y + 16, { align: 'right' });
      doc.text('Kembali:', 5, y + 20);
      doc.text(`${formatCurrency(change)}`, 53, y + 20, { align: 'right' });
    }

    doc.text('Terima Kasih!', 29, y + 28, { align: 'center' });
    
    doc.save(`Receipt-${invoiceNo}.pdf`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-12rem)]">
      {/* Left Side: Product Selection */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="space-y-4">
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
              <Search size={22} />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk (Nama, Barcode)..."
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[20px] shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide py-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "px-5 py-2.5 rounded-[14px] text-xs font-bold whitespace-nowrap transition-all border-2",
                selectedCategory === 'all' 
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                  : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
              )}
            >
              Semua
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-5 py-2.5 rounded-[14px] text-xs font-bold whitespace-nowrap transition-all border-2",
                  selectedCategory === cat.id 
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
              <Package size={48} />
              <p className="mt-2">Produk tidak ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className={cn(
                    "card-sleek p-4 text-left flex flex-col gap-3 hover:border-primary transition-all group relative",
                    p.stock <= 0 && "opacity-50 grayscale cursor-not-allowed"
                  )}
                >
                  <div className="w-full aspect-square bg-slate-50 rounded-[20px] flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                    <Package size={40} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm truncate leading-tight uppercase tracking-tight">{p.name}</h4>
                    <p className="text-primary font-black text-base">{formatCurrency(p.sell_price)}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-bold uppercase py-0.5 px-1.5 rounded-md",
                        p.stock < p.threshold ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400"
                      )}>Stok: {p.stock}</span>
                    </div>
                  </div>
                  {p.stock <= 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-[32px] backdrop-blur-[1px]">
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-lg uppercase shadow-lg shadow-rose-200">Habis</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Cart */}
      <div className="w-full lg:w-[420px] lg:sticky lg:top-24 h-fit">
        <div className="flex flex-col bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-primary" size={24} />
              <h3 className="font-bold text-slate-800">Keranjang</h3>
            </div>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-lg">
              {cart.reduce((acc, item) => acc + item.qty, 0)} Item
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                <ShoppingCart size={48} strokeWidth={1.5} />
                <p className="mt-2 text-sm font-medium">Belum ada pesanan</p>
              </div>
            ) : (
              cart.map(item => (
                <motion.div
                  layout
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <Package size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 text-xs truncate">{item.name}</h4>
                    <p className="text-[10px] text-primary font-bold">{formatCurrency(item.sell_price)}</p>
                  </div>
                  
                  <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
                    <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:text-primary transition-colors">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center font-bold text-[10px]">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:text-primary transition-colors">
                      <Plus size={12} />
                    </button>
                  </div>

                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-lg font-black text-slate-900 pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <ReceiptText size={20} />
                <span>Bayar Sekarang</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Pembayaran</h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Tagihan</p>
                  <h2 className="text-3xl font-black text-primary mt-1">{formatCurrency(total)}</h2>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'Tunai', icon: Banknote },
                      { id: 'QRIS', icon: QrCode },
                      { id: 'Transfer', icon: CreditCard },
                      { id: 'E-Wallet', icon: Wallet },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setPaymentMethod(m.id)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-sm font-bold",
                          paymentMethod === m.id 
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-slate-100 text-slate-500 hover:border-slate-200"
                        )}
                      >
                        <m.icon size={20} />
                        <span>{m.id}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'Tunai' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Uang Bayar</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-xl"
                        placeholder="0"
                        autoFocus
                      />
                    </div>
                    {Number(cashAmount) > 0 && (
                      <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-xs font-bold text-emerald-600 uppercase">Kembalian</span>
                        <span className="font-bold text-emerald-700">{formatCurrency(change)}</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      <ReceiptText size={24} />
                      <span>Proses Transaksi</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
