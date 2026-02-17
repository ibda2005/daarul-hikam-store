'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { cetakNota } from '../../utils/generatePDF';

// MENGIMPOR SIHIR POP-UP CANTIK
import Swal from 'sweetalert2'; 

export default function AdminDashboard() {
  const [daftarPesanan, setDaftarPesanan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modeRekap, setModeRekap] = useState(false); 
  const router = useRouter();

  useEffect(() => {
    cekAksesAdmin();
  }, []);

  async function cekAksesAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') {
      // POP-UP CANTIK ERROR
      Swal.fire({ icon: 'error', title: 'Akses Ditolak!', text: 'Halaman ini khusus Admin.' });
      return router.push('/'); 
    }
    fetchPesanan();
  }

  async function fetchPesanan() {
    const { data, error } = await supabase.from('pesanan').select(`*, profiles (nama_lengkap, laqob, tingkat)`).order('tanggal', { ascending: false });
    if (error) Swal.fire({ icon: 'error', title: 'Gagal!', text: error.message });
    else setDaftarPesanan(data);
    setLoading(false);
  }

  // FUNGSI BAYAR MENGGUNAKAN PROMPT CANTIK
  const tambahPembayaran = async (pesanan) => {
    const sisaTagihan = pesanan.total_harga - (pesanan.sudah_bayar || 0);
    if (sisaTagihan <= 0) return Swal.fire({ icon: 'info', title: 'Sudah Lunas', text: 'Pesanan ini sudah tidak memiliki sisa tagihan.' });

    const { value: inputBayar } = await Swal.fire({
      title: 'Input Pembayaran',
      html: `Sisa tagihan: <b>Rp ${sisaTagihan.toLocaleString('id-ID')}</b><br/><br/>Masukkan nominal pembayaran baru (angka saja):`,
      input: 'text',
      inputPlaceholder: 'Contoh: 50000',
      showCancelButton: true,
      confirmButtonColor: '#15803d', // Hijau
      cancelButtonColor: '#d33',     // Merah
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal'
    });

    if (!inputBayar) return; // Jika klik Batal

    const nominalBaru = parseInt(inputBayar.replace(/\./g, ''));
    if (isNaN(nominalBaru) || nominalBaru <= 0) return Swal.fire({ icon: 'error', title: 'Salah Input', text: 'Masukkan angka yang benar!' });
    if (nominalBaru > sisaTagihan) return Swal.fire({ icon: 'error', title: 'Kelebihan', text: 'Nominal melebihi sisa tagihan!' });

    const totalBayarSekarang = (pesanan.sudah_bayar || 0) + nominalBaru;
    const statusFix = totalBayarSekarang >= pesanan.total_harga ? 'Lunas' : 'Cicilan';

    const { error } = await supabase.from('pesanan').update({ sudah_bayar: totalBayarSekarang, status_pembayaran: statusFix }).eq('id', pesanan.id);

    if (error) {
      Swal.fire({ icon: 'error', title: 'Gagal Update', text: error.message });
    } else {
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `Input Rp ${nominalBaru.toLocaleString('id-ID')} tersimpan. Status: ${statusFix}` });
      fetchPesanan();
    }
  };

  const handleCetakNotaAdmin = (pesanan) => {
    if (!pesanan.detail_pesanan || pesanan.detail_pesanan.length === 0) {
      return Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Detail kitab untuk pesanan ini tidak tersimpan.' });
    }
    const dataUser = { nama: pesanan.profiles?.nama_lengkap || 'Santri', laqob: pesanan.profiles?.laqob || '-', tingkat: pesanan.profiles?.tingkat || '-' };
    cetakNota(dataUser, pesanan.detail_pesanan, pesanan.total_harga, 'view');
  };

  // FUNGSI HAPUS MENGGUNAKAN CONFIRM CANTIK (Warna Merah)
  const hapusPesanan = async (id, namaSantri) => {
    const result = await Swal.fire({
      title: 'Hapus Permanen?',
      html: `Yakin ingin menghapus pesanan milik <b>${namaSantri}</b>?<br/>Data yang dihapus tidak bisa dikembalikan!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33', // Merah
      cancelButtonColor: '#6b7280', // Abu-abu
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return; // Jika klik batal

    const { error } = await supabase.from('pesanan').delete().eq('id', id);
    if (error) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
    } else {
      Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Pesanan berhasil dihapus dari Database.' });
      fetchPesanan(); 
    }
  };

  const rekapSemuaNota = [];
  daftarPesanan.forEach((p) => {
    if (p.detail_pesanan) {
      p.detail_pesanan.forEach((item) => {
        rekapSemuaNota.push({
          ...item, id_pesanan: p.id, tanggal: p.tanggal, nama_santri: p.profiles?.nama_lengkap, tingkat: p.profiles?.tingkat, status_bayar: p.status_pembayaran
        });
      });
    }
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-green-700">Mengecek Akses Admin...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-green-700 pb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-green-800">Panel Admin - Keuangan</h1>
          <p className="text-gray-600 mt-1">Kelola cicilan, pelunasan, dan data pemesanan kitab</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModeRekap(!modeRekap)} className={`px-4 py-2 rounded font-bold transition shadow-md whitespace-nowrap ${modeRekap ? 'bg-yellow-500 text-yellow-900 hover:bg-yellow-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {modeRekap ? '🔙 Kembali ke Mode Normal' : '📋 Lihat Nota Kesatuan'}
          </button>
          <button onClick={() => router.push('/')} className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 transition whitespace-nowrap font-bold shadow">
            Kembali ke Katalog
          </button>
        </div>
      </header>

      {modeRekap ? (
        <div className="bg-white rounded-lg shadow-xl border overflow-auto max-h-[75vh]">
          <table className="min-w-full text-left text-sm relative">
            <thead className="bg-yellow-500 text-yellow-900 sticky top-0 z-10 shadow-md">
              <tr>
                <th className="px-4 py-4 whitespace-nowrap">Tanggal Pesan</th><th className="px-4 py-4">Nama Santri</th><th className="px-4 py-4">Nama Kitab</th><th className="px-4 py-4 text-center">Jumlah</th><th className="px-4 py-4">Harga Satuan</th><th className="px-4 py-4">Subtotal</th><th className="px-4 py-4 text-center">Status Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rekapSemuaNota.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500 italic text-lg font-medium">Belum ada rincian pesanan.</td></tr>
              ) : (
                rekapSemuaNota.map((item, idx) => (
                  <tr key={idx} className="hover:bg-yellow-50 transition">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{item.nama_santri} <span className="text-xs text-gray-500 font-normal block">(Tingkat {item.tingkat})</span></td>
                    <td className="px-4 py-3 font-semibold text-green-700">{item.nama_kitab}</td>
                    <td className="px-4 py-3 text-center font-black">{item.jumlah}</td>
                    <td className="px-4 py-3 text-gray-700">Rp {item.harga.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">Rp {(item.harga * item.jumlah).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${item.status_bayar === 'Lunas' ? 'bg-green-100 text-green-800' : item.status_bayar === 'Cicilan' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{item.status_bayar}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-xl border overflow-auto max-h-[75vh]">
          <table className="min-w-full text-left text-sm relative">
            <thead className="bg-green-700 text-white sticky top-0 z-10 shadow-md">
              <tr>
                <th className="px-4 py-4 whitespace-nowrap">Tanggal</th><th className="px-4 py-4 min-w-[150px]">Santri</th><th className="px-4 py-4 whitespace-nowrap">Tagihan Total</th><th className="px-4 py-4 whitespace-nowrap">Sudah Dibayar</th><th className="px-4 py-4 whitespace-nowrap">Sisa</th><th className="px-4 py-4 text-center whitespace-nowrap">Status</th><th className="px-4 py-4 text-center whitespace-nowrap">Aksi Admin</th>
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
                      <td className="px-4 py-4 text-center whitespace-nowrap flex gap-2 justify-center items-center">
                        {p.status_pembayaran !== 'Lunas' && <button onClick={() => tambahPembayaran(p)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition shadow">💳 Bayar</button>}
                        {p.detail_pesanan && <button onClick={() => handleCetakNotaAdmin(p)} className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-900 transition shadow">👁️ Nota</button>}
                        <button onClick={() => hapusPesanan(p.id, p.profiles?.nama_lengkap)} className="bg-red-100 text-red-700 border border-red-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-600 hover:text-white transition shadow">🗑️ Hapus</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}