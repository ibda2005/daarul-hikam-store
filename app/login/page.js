'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [laqob, setLaqob] = useState('');
  const [tingkat, setTingkat] = useState('1');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert("Gagal Login: " + error.message);
      } else {
        alert("Login Berhasil!");
        router.push('/'); 
      }
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        alert("Gagal Registrasi: " + authError.message);
      } else if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            email: email,
            nama_lengkap: nama,
            laqob: laqob,
            tingkat: tingkat,
            role: 'client'
          }
        ]);

        if (profileError) {
          alert("Gagal menyimpan profil: " + profileError.message);
        } else {
          alert("Registrasi berhasil! Silakan login.");
          setIsLogin(true); 
          setPassword(''); 
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-green-700 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.jpeg" alt="Logo Daarul Hikam" className="w-20 h-20 mx-auto mb-3 rounded-full object-cover" />
          <h2 className="text-2xl font-bold text-green-800">
            {isLogin ? 'Login Pemesanan' : 'Daftar Akun Baru'}
          </h2>
          <p className="text-sm text-gray-900 mt-1">Pondok Pesantren Daarul Hikam</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-900">Nama Lengkap</label>
                <input type="text" required value={nama} onChange={(e) => setNama(e.target.value)} className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Contoh: Ahmad Abdullah" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">Laqob (Panggilan)</label>
                <input type="text" required value={laqob} onChange={(e) => setLaqob(e.target.value)} className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Contoh: Kang Mamat" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">Tingkat</label>
                <select value={tingkat} onChange={(e) => setTingkat(e.target.value)} className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-green-500">
                  <option value="1">Tingkat 1</option>
                  <option value="2">Tingkat 2</option>
                  <option value="3">Tingkat 3</option>
                  <option value="Asmad">Asmad</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="email@contoh.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Minimal 6 karakter" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-green-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800 transition disabled:opacity-50">
            {loading ? 'Memproses...' : (isLogin ? 'Masuk' : 'Daftar Sekarang')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-yellow-600 font-bold hover:underline">
            {isLogin ? 'Daftar di sini' : 'Login di sini'}
          </button>
        </p>
      </div>
    </div>
  );
}