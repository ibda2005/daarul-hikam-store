import jsPDF from 'jspdf';

export const cetakNota = (user, keranjang, totalHarga) => {
  const doc = new jsPDF();
  
  // Header Nota
  doc.setFontSize(18);
  doc.setTextColor(21, 128, 61); // Warna Hijau
  doc.text("NOTA PEMESANAN KITAB", 105, 20, null, null, "center");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Pondok Pesantren Daarul Hikam,Kp.Cibeureum Pair Ds Sukamekar Kec Sukaraja Sukabumi", 105, 28, null, null, "center");
  
  doc.line(20, 32, 190, 32);

  // Data User
  const tanggal = new Date().toLocaleDateString('id-ID');
  doc.text(`Tanggal     : ${tanggal}`, 20, 45);
  doc.text(`Nama        : ${user.nama}`, 20, 52);
  doc.text(`Laqob       : ${user.laqob}`, 20, 59);
  doc.text(`Tingkat     : ${user.tingkat}`, 20, 66);

  // Tabel Header
  doc.setFillColor(21, 128, 61);
  doc.rect(20, 75, 170, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text("Nama Kitab", 25, 82);
  doc.text("Jml", 120, 82);
  doc.text("Harga", 135, 82);
  doc.text("Subtotal", 165, 82);

  // Isi Keranjang
  doc.setTextColor(0, 0, 0);
  let y = 92;
  keranjang.forEach((item) => {
    doc.text(item.nama_kitab.substring(0, 35), 25, y);
    doc.text(item.jumlah.toString(), 122, y);
    doc.text(`Rp ${item.harga.toLocaleString('id-ID')}`, 135, y);
    doc.text(`Rp ${(item.harga * item.jumlah).toLocaleString('id-ID')}`, 165, y);
    y += 10;
  });

  doc.line(20, y + 2, 190, y + 2);
  doc.setFontSize(14);
  doc.text(`Total Bayar : Rp ${totalHarga.toLocaleString('id-ID')}`, 120, y + 12);

  // Simpan File
  doc.save(`Nota_${user.nama}_${tanggal}.pdf`);
};