import React, { useState, useEffect, useRef } from 'react';
import { supabase, type Product, type Category } from '../lib/supabase';
import { formatCurrency, cn } from '../lib/utils';
import { Search, Plus, Edit2, Trash2, Package, Filter, X, Loader2, AlertTriangle, ChevronRight, Scan, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isScanning) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [isScanning]);

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
        },
        (decodedText) => {
          setEditingProduct(prev => ({ ...prev, barcode: decodedText }));
          setIsScanning(false);
          toast.success('Barcode terdeteksi!');
        },
        () => {}
      );
    } catch (err) {
      console.error('Scanner error:', err);
      toast.error('Gagal mengakses kamera');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
    }
  };

  async function fetchData() {
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
      toast.error('Gagal memuat data');
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingProduct?.id) {
        const { error } = await supabase
          .from('products')
          .update(editingProduct)
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Produk diperbarui');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([editingProduct]);
        if (error) throw error;
        toast.success('Produk ditambahkan');
      }
      setIsModalOpen(false);
      setIsScanning(false);
      fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Gagal menyimpan produk');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ name: newCategoryName.trim() }]);
      if (error) throw error;
      toast.success('Kategori ditambahkan');
      setNewCategoryName('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambah kategori');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          throw new Error('Kategori tidak bisa dihapus karena masih digunakan oleh beberapa produk.');
        }
        throw error;
      }
      toast.success('Kategori dihapus');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus kategori');
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  const handleDelete = async () => {
    if (!productToDelete) return;
    setIsSaving(true);
    try {
      // Use "Soft Delete" by updating is_active to false
      // This allows deletion even if product has existing transactions
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productToDelete);

      if (error) {
        if (error.message.includes('permission denied') || error.code === '42501') {
          throw new Error('Anda tidak memiliki izin untuk menghapus produk. Pastikan kebijakan RLS di Supabase sudah diatur untuk mengizinkan UPDATE.');
        }
        throw error;
      }
      toast.success('Produk berhasil dihapus dari daftar aktif');
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      fetchData();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Gagal menghapus produk');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manajemen Stok</h2>
          <p className="text-slate-500 text-sm">Kelola inventaris warung Anda.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="bg-white text-slate-600 p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2 font-bold text-sm active:scale-95 transition-all"
          >
            <Filter size={20} />
            <span className="hidden sm:inline">Kategori</span>
          </button>
          <button 
            onClick={() => { setEditingProduct({}); setIsModalOpen(true); }}
            className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 flex items-center gap-2 font-bold text-sm active:scale-95 transition-all"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Produk Baru</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau barcode..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
              selectedCategory === 'all' 
                ? "bg-primary text-white border-primary" 
                : "bg-white text-slate-500 border-slate-200"
            )}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                selectedCategory === cat.id 
                  ? "bg-primary text-white border-primary" 
                  : "bg-white text-slate-500 border-slate-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Package size={48} className="mx-auto opacity-20 mb-4" />
            <p>Tidak ada produk ditemukan</p>
          </div>
        ) : (
          filteredProducts.map(p => (
            <motion.div
              layout
              key={p.id}
              className="card-sleek p-4 flex items-center gap-4"
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                p.stock < p.threshold ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
              )}>
                <Package size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 truncate">{p.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.barcode || 'No Barcode'}</span>
                  <span className="text-[10px] text-slate-300">•</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase",
                    p.stock < p.threshold ? "text-rose-600" : "text-emerald-600"
                  )}>Stok: {p.stock} {p.unit}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900 text-sm">{formatCurrency(p.sell_price)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <button 
                    onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}
                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => { setProductToDelete(p.id); setIsDeleteModalOpen(true); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsModalOpen(false); setIsScanning(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingProduct?.id ? 'Edit Produk ✨' : 'Tambah Produk ✨'}
                </h3>
                <button onClick={() => { setIsModalOpen(false); setIsScanning(false); }} className="p-2 hover:bg-slate-50 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama Produk</label>
                  <input
                    required
                    type="text"
                    value={editingProduct?.name || ''}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Contoh: Indomie Goreng"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kategori</label>
                    <div className="flex gap-2">
                      <select
                        value={editingProduct?.category_id || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, category_id: Number(e.target.value) }))}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      >
                        <option value="">Pilih Kategori</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-primary hover:border-primary transition-all"
                        title="Tambah Kategori Baru"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Barcode</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingProduct?.barcode || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, barcode: e.target.value }))}
                          className="flex-1 min-w-0 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          placeholder="Scan Barcode..."
                        />
                        <button
                          type="button"
                          onClick={() => setIsScanning(!isScanning)}
                          className={cn(
                            "shrink-0 px-4 py-3 rounded-xl border transition-all flex items-center gap-2 font-bold text-xs",
                            isScanning ? "bg-rose-500 text-white border-rose-600" : "bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-200"
                          )}
                        >
                          <Scan size={18} />
                          <span>SCAN</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isScanning && (
                  <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video border-2 border-primary/30">
                    <div id="reader" className="w-full h-full"></div>
                    <div className="absolute inset-0 pointer-events-none border-2 border-primary/50 m-8 rounded-lg"></div>
                    <button 
                      type="button"
                      onClick={() => setIsScanning(false)}
                      className="absolute top-2 right-2 p-1 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Harga Beli</label>
                    <input
                      required
                      type="number"
                      value={editingProduct?.buy_price || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, buy_price: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Harga Jual</label>
                    <input
                      required
                      type="number"
                      value={editingProduct?.sell_price || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, sell_price: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Stok</label>
                    <input
                      required
                      type="number"
                      value={editingProduct?.stock || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, stock: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Satuan</label>
                    <input
                      type="text"
                      value={editingProduct?.unit || 'pcs'}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Min. Stok</label>
                    <input
                      type="number"
                      value={editingProduct?.threshold || 5}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : "Simpan Produk"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Produk?</h3>
              <p className="text-sm text-slate-500 mb-8">
                Tindakan ini tidak dapat dibatalkan. Produk akan dihapus permanen dari daftar stok.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="py-3 px-4 bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Ya, Hapus"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Kelola Kategori</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <form onSubmit={handleSaveCategory} className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nama kategori baru..."
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isSavingCategory || !newCategoryName.trim()}
                    className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
                  >
                    {isSavingCategory ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  </button>
                </form>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4 italic">Belum ada kategori.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
