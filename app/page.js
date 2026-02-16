'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { cetakNota } from '../utils/generatePDF';

export default function Dashboard() {
  const [daftarKitab, setDaftarKitab] = useState([]);
  const [keranjang, setKeranjang] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Mengecek apakah user sudah login dan mengambil data profilnya
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Jika belum login, lempar kembali ke halaman login
        router.push('/login');
      } else {
        // Ambil data Nama, Laqob, Tingkat dari tabel profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        setUserData(profile);
        fetchKitab();
      }
    }
    checkUser();
  }, [router]);

  // Mengambil daftar kitab dari database
  async function fetchKitab() {
    const { data } = await supabase.from('kitab').select('*').order('id', { ascending: true });
    if (data) setDaftarKitab(data);
    setLoading(false);
  }

  const tambahKeKeranjang = (kitab) => {
    const ada = keranjang.find((item) => item.id === kitab.id);
    if (ada) {
      setKeranjang(keranjang.map(item => item.id === kitab.id ? { ...item, jumlah: item.jumlah + 1 } : item));
    } else {
      setKeranjang([...keranjang, { ...kitab, jumlah: 1 }]);
    }
  };

  const totalHarga = keranjang.reduce((total, item) => total + (item.harga * item.jumlah), 0);

  const prosesPesanan = async () => {
    if (keranjang.length === 0) return alert("Pilih kitab terlebih dahulu!");
    
    // 1. Simpan riwayat pesanan ke database Supabase (Tabel: pesanan)
    const { error } = await supabase.from('pesanan').insert([
      {
        user_id: userData.id,
        total_harga: totalHarga,
        status_pembayaran: 'Belum Lunas'
      }
    ]);

    if (error) {
      alert("Terjadi kesalahan saat membuat pesanan: " + error.message);
      return;
    }

    // 2. Sesuaikan format data untuk PDF
    const dataUntukPDF = {
      nama: userData.nama_lengkap,
      laqob: userData.laqob,
      tingkat: userData.tingkat
    };
    
    // 3. Download Nota PDF
    cetakNota(dataUntukPDF, keranjang, totalHarga);
    
    // 4. Redirect ke WhatsApp Admin
    const noWaAdmin = "6285289031817"; // TODO: Ganti dengan nomor WhatsApp Admin yang asli
    const pesan = `Assalamu'alaikum Admin. Saya *${userData.nama_lengkap}* (Laqob: ${userData.laqob}, Tingkat ${userData.tingkat}) telah memesan kitab dengan total *Rp ${totalHarga.toLocaleString('id-ID')}*. Berikut saya lampirkan Nota PDF pemesanan saya.`;
    const waLink = `https://wa.me/${noWaAdmin}?text=${encodeURIComponent(pesan)}`;
    
    alert("Pesanan berhasil dicatat! Nota akan diunduh. Silakan kirim nota tersebut ke WhatsApp Admin.");
    window.open(waLink, '_blank');
    
    // Kosongkan keranjang setelah selesai
    setKeranjang([]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat data...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-700 text-white p-6 shadow-md flex flex-col items-center relative">
        <button onClick={handleLogout} className="absolute top-4 right-4 bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-700 transition">
          Keluar (Logout)
        </button>
        <img src="/logo.jpeg" alt="Logo Daarul Hikam" className="w-24 h-24 mb-4 bg-white rounded-full p-1 object-cover" />
        <h1 className="text-3xl font-bold">Pemesanan Kitab Pondok Pesantren Daarul Hikam</h1>
        <p className="mt-2 text-green-100">Kp. Cibeureum Pasir Ds.Sukamekar Kec Sukaraja Sukabumi</p>
        <p className="mt-2 text-green-100">Ahlan wa Sahlan, {userData?.nama_lengkap} ({userData?.laqob})</p>
      </header>


      <div className="container mx-auto p-6 flex flex-col md:flex-row gap-8">
        {/* Katalog Kitab */}
        <div className="md:w-2/3">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-green-500 pb-2">Daftar Harga Kitab</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {daftarKitab.map((kitab) => (
              <div key={kitab.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">{kitab.nama_kitab}</h3>
                  <p className="text-green-600 font-bold">Rp {kitab.harga.toLocaleString('id-ID')}</p>
                </div>
                <button 
                  onClick={() => tambahKeKeranjang(kitab)}
                  className="bg-green-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-green-700 transition font-bold text-xl"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Keranjang & Checkout */}
        <div className="md:w-1/3 bg-white p-6 rounded-lg shadow h-fit border-t-4 border-green-700 sticky top-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Keranjang Saya</h2>
          {keranjang.length === 0 ? (
            <p className="text-gray-500 italic">Belum ada kitab dipilih.</p>
          ) : (
            <ul className="space-y-3 mb-6">
              {keranjang.map((item, idx) => (
                <li key={idx} className="flex justify-between border-b pb-2 text-sm text-gray-700">
                  <span>{item.nama_kitab} (x{item.jumlah})</span>
                  <span>Rp {(item.harga * item.jumlah).toLocaleString('id-ID')}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between font-bold text-lg mb-6 text-gray-800 border-t pt-4">
            <span>Total:</span>
            <span>Rp {totalHarga.toLocaleString('id-ID')}</span>
          </div>
          <button 
            onClick={prosesPesanan}
            className="w-full bg-yellow-500 text-green-900 font-bold py-3 rounded hover:bg-yellow-400 transition shadow-md"
          >
            Buat Nota & Chat Admin
          </button>
        </div>
      </div>
    </div>
  );
}