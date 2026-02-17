'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { cetakNota } from '../../utils/generatePDF';

export default function AdminDashboard() {
  const [daftarPesanan, setDaftarPesanan] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    cekAksesAdmin();
  }, []);

  async function cekAksesAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') {
      alert("Akses Ditolak! Halaman ini khusus Admin.");
      return router.push('/'); 
    }
    fetchPesanan();
  }

  async function fetchPesanan() {
    const { data, error } = await supabase
      .from('pesanan')
      .select(`*, profiles (nama_lengkap, laqob, tingkat)`)
      .order('tanggal', { ascending: false });

    if (error) alert("Gagal mengambil data: " + error.message);
    else setDaftarPesanan(data);
    
    setLoading(false);
  }

  const tambahPembayaran = async (pesanan) => {
    const sisaTagihan = pesanan.total_harga - (pesanan.sudah_bayar || 0);
    if (sisaTagihan <= 0) return alert("Pesanan ini sudah LUNAS.");

    const inputBayar = prompt(`Sisa tagihan: Rp ${sisaTagihan.toLocaleString('id-ID')}\n\nMasukkan nominal pembayaran baru:`, "0");
    if (inputBayar === null) return;

    const nominalBaru = parseInt(inputBayar.replace(/\./g, ''));
    if (isNaN(nominalBaru) || nominalBaru <= 0) return alert("Masukkan angka yang benar!");
    if (nominalBaru > sisaTagihan) return alert("Nominal melebihi sisa tagihan! Maksimal: " + sisaTagihan);

    const totalBayarSekarang = (pesanan.sudah_bayar || 0) + nominalBaru;
    const statusFix = totalBayarSekarang >= pesanan.total_harga ? 'Lunas' : 'Cicilan';

    const { error } = await supabase.from('pesanan').update({ sudah_bayar: totalBayarSekarang, status_pembayaran: statusFix }).eq('id', pesanan.id);

    if (error) alert("Gagal update: " + error.message);
    else {
      alert(`Berhasil input Rp ${nominalBaru.toLocaleString('id-ID')}. Status sekarang: ${statusFix}`);
      fetchPesanan();
    }
  };

  const handleCetakNotaAdmin = (pesanan) => {
    if (!pesanan.detail_pesanan || pesanan.detail_pesanan.length === 0) {
      return alert("Maaf, detail kitab untuk pesanan ini tidak tersimpan di database.");
    }
    const dataUser = {
      nama: pesanan.profiles?.nama_lengkap || 'Santri',
      laqob: pesanan.profiles?.laqob || '-',
      tingkat: pesanan.profiles?.tingkat || '-'
    };
    cetakNota(dataUser, pesanan.detail_pesanan, pesanan.total_harga, 'view');
  };

  // ---- FUNGSI BARU UNTUK ADMIN MENGHAPUS PESANAN ----
  const hapusPesanan = async (id, namaSantri) => {
    if (!confirm(`⚠️ PERINGATAN BUKAN MAIN-MAIN!\n\nApakah Anda YAKIN ingin menghapus pesanan milik "${namaSantri}" secara PERMANEN dari Database? Data yang dihapus tidak bisa dikembalikan.`)) return;

    const { error } = await supabase
      .from('pesanan')
      .delete()
      .eq('id', id);

    if (error) {
      alert("Gagal menghapus pesanan: " + error.message);
    } else {
      alert("🗑️ Pesanan berhasil dihapus dari Database!");
      fetchPesanan(); // Segarkan tabel otomatis
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-green-700">Mengecek Akses Admin...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-green-700 pb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-green-800">Panel Admin - Keuangan</h1>
          <p className="text-gray-600 mt-1">Kelola cicilan, pelunasan, dan data pemesanan kitab</p>
        </div>
        <button onClick={() => router.push('/')} className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 transition whitespace-nowrap font-bold shadow">
          Kembali ke Katalog
        </button>
      </header>

      <div className="bg-white rounded-lg shadow-xl border overflow-auto max-h-[75vh]">
        <table className="min-w-full text-left text-sm relative">
          <thead className="bg-green-700 text-white sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-4 whitespace-nowrap">Tanggal</th>
              <th className="px-4 py-4 min-w-[150px]">Santri</th>
              <th className="px-4 py-4 whitespace-nowrap">Tagihan Total</th>
              <th className="px-4 py-4 whitespace-nowrap">Sudah Dibayar</th>
              <th className="px-4 py-4 whitespace-nowrap">Sisa</th>
              <th className="px-4 py-4 text-center whitespace-nowrap">Status</th>
              <th className="px-4 py-4 text-center whitespace-nowrap">Aksi Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {daftarPesanan.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500 italic text-lg font-medium">Belum ada pesanan masuk.</td></tr>
            ) : (
              daftarPesanan.map((p) => {
                const sisa = p.total_harga - (p.sudah_bayar || 0);
                const persen = Math.min(100, Math.round(((p.sudah_bayar || 0) / p.total_harga) * 100));
                
                return (
                  <tr key={p.id} className="hover:bg-green-50 transition">
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap font-medium">{new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-4 py-4"><div className="font-bold text-gray-900 text-base">{p.profiles?.nama_lengkap}</div><div className="text-xs text-gray-500 font-semibold">{p.profiles?.laqob} (Tingkat {p.profiles?.tingkat})</div></td>
                    <td className="px-4 py-4 font-bold text-gray-800 whitespace-nowrap">Rp {p.total_harga.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 font-bold text-green-700 whitespace-nowrap">Rp {(p.sudah_bayar || 0).toLocaleString('id-ID')}<div className="w-full bg-gray-200 rounded-full h-2 mt-1.5"><div className="bg-green-600 h-2 rounded-full" style={{ width: `${persen}%` }}></div></div></td>
                    <td className="px-4 py-4 font-black text-red-600 whitespace-nowrap">{sisa <= 0 ? '-' : `Rp ${sisa.toLocaleString('id-ID')}`}</td>
                    <td className="px-4 py-4 text-center"><span className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap shadow-sm ${p.status_pembayaran === 'Lunas' ? 'bg-green-200 text-green-900' : p.status_pembayaran === 'Cicilan' ? 'bg-yellow-200 text-yellow-900' : 'bg-red-200 text-red-900'}`}>{p.status_pembayaran}</span></td>
                    
                    {/* KOLOM AKSI (BAYAR, NOTA, HAPUS) */}
                    <td className="px-4 py-4 text-center whitespace-nowrap flex gap-2 justify-center items-center">
                      {p.status_pembayaran !== 'Lunas' && (
                        <button onClick={() => tambahPembayaran(p)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition shadow">💳 Bayar</button>
                      )}
                      
                      {p.detail_pesanan && (
                         <button onClick={() => handleCetakNotaAdmin(p)} className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-900 transition shadow">👁️ Nota</button>
                      )}

                      {/* TOMBOL HAPUS DATABASE */}
                      <button onClick={() => hapusPesanan(p.id, p.profiles?.nama_lengkap)} className="bg-red-100 text-red-700 border border-red-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-600 hover:text-white transition shadow">
                        🗑️ Hapus
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}