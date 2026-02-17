'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { cetakNota } from '../utils/generatePDF';
import Swal from 'sweetalert2'; // <--- Sihir Pop-up Cantik

export default function Dashboard() {
  const [daftarKitab, setDaftarKitab] = useState([]);
  const [keranjang, setKeranjang] = useState([]);
  const [pesananSaya, setPesananSaya] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setUserData(profile);
        fetchKitab(profile.tipe_santri); 
        fetchPesananSaya(session.user.id);
      }
    }
    checkUser();
  }, [router]);

  // LOGIKA BARU YANG DIBALIK UNTUK SANTRI PASARAN
  async function fetchKitab(tipeSantri) {
    const { data } = await supabase.from('kitab').select('*').order('id', { ascending: true });
    
    if (data) {
      if (tipeSantri === 'Pasaran') {
        // HANYA TAMPILKAN kitab yang DICENTANG (true) di database
        const kitabPasaran = data.filter(k => k.khusus_muqim === true);
        setDaftarKitab(kitabPasaran);
      } else {
        // Jika Muqim, tampilkan SEMUA kitab (tidak peduli dicentang atau tidak)
        setDaftarKitab(data);
      }
    }
  }

  async function fetchPesananSaya(userId) {
    const { data } = await supabase.from('pesanan').select('*').eq('user_id', userId).order('tanggal', { ascending: false });
    if (data) setPesananSaya(data);
    setLoading(false);
  }

  const tambahKeKeranjang = (kitab) => {
    const ada = keranjang.find((item) => item.id === kitab.id);
    if (ada) setKeranjang(keranjang.map(item => item.id === kitab.id ? { ...item, jumlah: item.jumlah + 1 } : item));
    else setKeranjang([...keranjang, { ...kitab, jumlah: 1 }]);
  };

  const kurangiKeranjang = (id) => {
    const item = keranjang.find((i) => i.id === id);
    if (item.jumlah > 1) setKeranjang(keranjang.map(i => i.id === id ? { ...i, jumlah: i.jumlah - 1 } : i));
    else setKeranjang(keranjang.filter(i => i.id !== id));
  };

  const kosongkanKeranjang = async () => {
    const res = await Swal.fire({
      title: 'Kosongkan Keranjang?',
      text: "Semua pilihan kitab akan dihapus dari keranjang.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Kosongkan',
      cancelButtonText: 'Batal'
    });
    if (res.isConfirmed) setKeranjang([]);
  };

  const totalHarga = keranjang.reduce((total, item) => total + (item.harga * item.jumlah), 0);

  const prosesPesanan = async () => {
    if (keranjang.length === 0) return Swal.fire('Kosong!', 'Pilih kitab terlebih dahulu!', 'warning');
    
    const konfirmasi = await Swal.fire({
      title: 'Proses Pesanan?',
      text: "Pastikan kitab yang Anda pilih sudah benar.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Pesan Sekarang!',
      cancelButtonText: 'Batal'
    });

    if (!konfirmasi.isConfirmed) return;
    
    const { error } = await supabase.from('pesanan').insert([{
      user_id: userData.id,
      total_harga: totalHarga,
      status_pembayaran: 'Belum Lunas',
      detail_pesanan: keranjang
    }]);

    if (error) return Swal.fire('Error', error.message, 'error');

    fetchPesananSaya(userData.id);
    
    // POP-UP SUKSES & ARAH KAN KE WA
    Swal.fire({
      title: 'Pesanan Berhasil! 🎉',
      text: 'Nota sudah masuk sistem. Klik tombol di bawah untuk mengabari Admin.',
      icon: 'success',
      confirmButtonColor: '#25D366', // Warna Hijau WhatsApp
      confirmButtonText: 'Chat Admin via WhatsApp'
    }).then(() => {
      const noWaAdmin = "6281234567890"; // GANTI NOMOR WA ASLI
      const pesan = `Assalamu'alaikum Admin. Saya *${userData.nama_lengkap}* (Santri ${userData.tipe_santri || 'Muqim'}) baru saja memesan kitab dengan total *Rp ${totalHarga.toLocaleString('id-ID')}*. Mohon dicek di sistem ya.`;
      const waLink = `https://wa.me/${noWaAdmin}?text=${encodeURIComponent(pesan)}`;
      window.open(waLink, '_blank');
      setKeranjang([]); 
    });
  };

  const batalkanPesanan = async (pesananId) => {
    const res = await Swal.fire({
      title: 'Batalkan Pesanan?',
      text: "Aksi ini tidak dapat dibatalkan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Batalkan!'
    });

    if (!res.isConfirmed) return;

    const { error } = await supabase.from('pesanan').delete().eq('id', pesananId);
    if (!error) {
      Swal.fire('Dibatalkan!', 'Pesanan Anda telah dibatalkan.', 'success');
      fetchPesananSaya(userData.id);
    }
  };

  const handleCetakNota = (pesanan, aksi) => {
    if (!pesanan.detail_pesanan) return Swal.fire('Maaf', 'Detail kitab tidak ditemukan.', 'error');
    const dataUser = { nama: userData.nama_lengkap, laqob: userData.laqob, tingkat: userData.tingkat };
    cetakNota(dataUser, pesanan.detail_pesanan, pesanan.total_harga, aksi);
  };

  const handleLogout = async () => {
    const res = await Swal.fire({
      title: 'Ingin Keluar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Ya, Logout'
    });
    if (res.isConfirmed) {
      await supabase.auth.signOut();
      router.push('/login');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-green-700">Memuat data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-green-700 text-white p-6 shadow-md flex flex-col items-center relative">
        <button onClick={handleLogout} className="absolute top-4 right-4 bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-700 transition font-bold shadow-md">Keluar</button>
        <img src="/logo.jpeg" alt="Logo Daarul Hikam" className="w-24 h-24 mb-4 bg-white rounded-full p-1 object-cover" />
        <h1 className="text-3xl font-bold text-center">Pemesanan Kitab Daarul Hikam</h1>
        
        <div className="mt-3 bg-green-800 px-4 py-1.5 rounded-full border border-green-500 shadow-sm">
          <p className="text-green-100 font-medium text-sm">
            Ahlan wa Sahlan, <span className="font-bold text-white">{userData?.nama_lengkap}</span> 
            <span className="text-yellow-400 font-bold ml-1">({userData?.tipe_santri || 'Muqim'})</span>
          </p>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-6 flex flex-col gap-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-2/3">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-green-500 pb-2">Daftar Harga Kitab</h2>
            
            {/* PESAN INFO UNTUK SANTRI PASARAN */}
            {userData?.tipe_santri === 'Pasaran' && (
              <div className="mb-4 bg-blue-50 text-blue-800 p-3 rounded-lg text-sm font-semibold border border-blue-200">
                ℹ️ Anda login sebagai Santri Pasaran. Menampilkan daftar kitab yang diizinkan untuk Anda.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {daftarKitab.length === 0 ? (
                 <p className="text-gray-500 italic col-span-2">Belum ada kitab yang tersedia.</p>
              ) : (
                daftarKitab.map((kitab) => (
                  <div key={kitab.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500 flex justify-between items-center hover:shadow-md transition">
                    <div>
                      <h3 className="font-bold text-gray-800">{kitab.nama_kitab}</h3>
                      <p className="text-green-700 font-bold">Rp {kitab.harga.toLocaleString('id-ID')}</p>
                    </div>
                    <button onClick={() => tambahKeKeranjang(kitab)} className="bg-green-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-green-700 transition font-bold text-xl shadow">+</button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="md:w-1/3 bg-white p-6 rounded-lg shadow h-fit border-t-4 border-green-700 sticky top-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Keranjang Saya</h2>
            {keranjang.length === 0 ? <p className="text-gray-500 italic font-medium">Belum ada kitab dipilih.</p> : (
              <div className="space-y-3 mb-6">
                {keranjang.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b pb-2 text-sm text-gray-700">
                    <div className="font-semibold">{item.nama_kitab}</div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => kurangiKeranjang(item.id)} className="bg-red-100 text-red-600 w-6 h-6 rounded font-bold hover:bg-red-200">-</button>
                      <span className="font-bold">{item.jumlah}</span>
                      <button onClick={() => tambahKeKeranjang(item)} className="bg-green-100 text-green-700 w-6 h-6 rounded font-bold hover:bg-green-200">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-black text-lg mb-4 text-gray-800 border-t pt-4"><span>Total:</span><span className="text-green-700">Rp {totalHarga.toLocaleString('id-ID')}</span></div>
            {keranjang.length > 0 && <button onClick={kosongkanKeranjang} className="w-full text-red-600 font-bold text-sm mb-4 hover:underline">🗑️ Batalkan & Kosongkan Keranjang</button>}
            <button onClick={prosesPesanan} className="w-full bg-yellow-500 text-green-900 font-black py-3 rounded-lg hover:bg-yellow-400 transition shadow-md">Proses Pesanan & Chat Admin</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-blue-600 mt-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-blue-500 pb-2">Riwayat Pesanan Saya</h2>
          {pesananSaya.length === 0 ? <p className="text-gray-500 italic">Anda belum memiliki riwayat pesanan.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pesananSaya.map((p) => {
                const selisihJam = (new Date() - new Date(p.tanggal)) / (1000 * 60 * 60);
                const bisaDibatalkan = selisihJam < 24 && p.status_pembayaran === 'Belum Lunas';
                return (
                  <div key={p.id} className="border border-gray-200 p-4 rounded-lg flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-2">{new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</div>
                      <div className="font-bold text-gray-800 mb-1">Total: Rp {p.total_harga.toLocaleString('id-ID')}</div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold mb-3 ${p.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-800' : p.status_pembayaran === 'Cicilan' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>Status: {p.status_pembayaran}</span>
                    </div>
                    <div className="flex flex-col gap-2 mt-2 border-t pt-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleCetakNota(p, 'view')} className="flex-1 bg-gray-100 text-gray-800 text-xs font-bold py-2 rounded border border-gray-300 hover:bg-gray-200 transition shadow-sm">👁️ Lihat Nota</button>
                        <button onClick={() => handleCetakNota(p, 'download')} className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded hover:bg-green-700 transition shadow-sm">⬇️ Download</button>
                      </div>
                      {bisaDibatalkan && <button onClick={() => batalkanPesanan(p.id)} className="w-full text-red-600 text-xs font-bold py-2 rounded border border-red-200 hover:bg-red-50 transition mt-1">❌ Batalkan Pesanan</button>}
                      {!bisaDibatalkan && p.status_pembayaran === 'Belum Lunas' && <p className="text-[10px] text-gray-400 text-center italic mt-1">Lewat dari 24 jam. Hubungi admin untuk membatalkan.</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}