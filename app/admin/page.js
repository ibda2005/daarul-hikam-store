'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const [daftarPesanan, setDaftarPesanan] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    cekAksesAdmin();
  }, []);

  // FUNGSI GEMBOK: Cek apakah user sudah login dan apakah rolenya 'admin'
  async function cekAksesAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return router.push('/login'); // Belum login, lempar ke halaman login
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      alert("Akses Ditolak! Halaman ini khusus Admin.");
      return router.push('/'); // Bukan admin, lempar ke halaman katalog
    }

    // Jika dia benar-benar admin, baru ambil data pesanannya
    fetchPesanan();
  }

  async function fetchPesanan() {
    const { data, error } = await supabase
      .from('pesanan')
      .select(`
        *,
        profiles (nama_lengkap, laqob, tingkat)
      `)
      .order('tanggal', { ascending: false });

    if (error) {
      alert("Gagal mengambil data: " + error.message);
    } else {
      setDaftarPesanan(data);
    }
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

    const { error } = await supabase
      .from('pesanan')
      .update({ sudah_bayar: totalBayarSekarang, status_pembayaran: statusFix })
      .eq('id', pesanan.id);

    if (error) {
      alert("Gagal update: " + error.message);
    } else {
      alert(`Berhasil input Rp ${nominalBaru.toLocaleString('id-ID')}. Status sekarang: ${statusFix}`);
      fetchPesanan();
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-green-700">Mengecek Akses Admin...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 flex justify-between items-center border-b-4 border-green-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-green-800">Panel Admin - Keuangan</h1>
          <p className="text-gray-600 mt-1">Kelola cicilan dan pelunasan kitab</p>
        </div>
        <button onClick={() => router.push('/')} className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 transition">
          Kembali ke Katalog
        </button>
      </header>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-green-700 text-white">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Santri</th>
              <th className="px-4 py-3">Tagihan Total</th>
              <th className="px-4 py-3">Sudah Dibayar</th>
              <th className="px-4 py-3">Sisa</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {daftarPesanan.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500 italic">Belum ada data.</td></tr>
            ) : (
              daftarPesanan.map((p) => {
                const sisa = p.total_harga - (p.sudah_bayar || 0);
                const persen = Math.min(100, Math.round(((p.sudah_bayar || 0) / p.total_harga) * 100));
                
                return (
                  <tr key={p.id} className="hover:bg-green-50 transition">
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{p.profiles?.nama_lengkap}</div>
                      <div className="text-xs text-gray-500">{p.profiles?.laqob} (Tingkat {p.profiles?.tingkat})</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">Rp {p.total_harga.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">
                      Rp {(p.sudah_bayar || 0).toLocaleString('id-ID')}
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${persen}%` }}></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600">
                      {sisa <= 0 ? '-' : `Rp ${sisa.toLocaleString('id-ID')}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold 
                        ${p.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-800' : 
                          p.status_pembayaran === 'Cicilan' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}`}>
                        {p.status_pembayaran}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.status_pembayaran !== 'Lunas' && (
                        <button onClick={() => tambahPembayaran(p)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition">
                          + Bayar
                        </button>
                      )}
                      {p.status_pembayaran === 'Lunas' && <span className="text-green-600 text-xs font-bold">✓ Selesai</span>}
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