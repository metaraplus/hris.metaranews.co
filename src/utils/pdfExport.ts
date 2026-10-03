import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceRecord } from '../types';

export interface EmployeeWorkSummary {
  employeeId: string;
  employeeNumber: string;
  name: string;
  department: string;
  totalDaysPresent: number;
  totalDaysOnTime: number;
  totalDaysLate: number;
  totalDaysLeave: number; // Sakit, cuti, izin
  totalWorkHours: number;
  avgDailyHours: number;
}

export interface MonthlyPDFOptions {
  monthYearStr: string; // e.g. "2026-10" or "Oktober 2026"
  departmentFilter?: string; // "ALL" or specific
  adminName?: string;
  companyName?: string;
}

/**
 * Calculates per-employee working hours and attendance statistics
 */
export function calculateEmployeeWorkSummaries(
  attendances: AttendanceRecord[]
): EmployeeWorkSummary[] {
  const map = new Map<string, EmployeeWorkSummary>();

  attendances.forEach((att) => {
    const key = att.userId || att.employeeId || att.employeeName;
    if (!map.has(key)) {
      map.set(key, {
        employeeId: att.employeeId || key,
        employeeNumber: att.employeeNumber || '-',
        name: att.employeeName || 'Karyawan',
        department: att.department || 'Operasional',
        totalDaysPresent: 0,
        totalDaysOnTime: 0,
        totalDaysLate: 0,
        totalDaysLeave: 0,
        totalWorkHours: 0,
        avgDailyHours: 0,
      });
    }

    const summary = map.get(key)!;
    const isLeave = ['sick', 'annual_leave', 'permit'].includes(att.status);

    if (isLeave) {
      summary.totalDaysLeave += 1;
    } else {
      summary.totalDaysPresent += 1;
      if (att.checkInStatus === 'on_time') {
        summary.totalDaysOnTime += 1;
      } else if (att.checkInStatus === 'late') {
        summary.totalDaysLate += 1;
      }
    }

    if (typeof att.workHours === 'number' && att.workHours > 0) {
      summary.totalWorkHours += att.workHours;
    }
  });

  // Calculate averages
  const results = Array.from(map.values());
  results.forEach((s) => {
    const daysWithHours = Math.max(1, s.totalDaysPresent);
    s.avgDailyHours = Number((s.totalWorkHours / daysWithHours).toFixed(1));
    s.totalWorkHours = Number(s.totalWorkHours.toFixed(1));
  });

  // Sort alphabetically by employee name
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

/**
 * Generates and downloads a comprehensive Monthly Attendance & Work Hours PDF Report
 */
export function exportMonthlyAttendancePDF(
  attendances: AttendanceRecord[],
  options: MonthlyPDFOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();

  // Format month label in Indonesian
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  let periodDisplay = options.monthYearStr;
  if (options.monthYearStr.includes('-')) {
    const [y, m] = options.monthYearStr.split('-');
    const mIdx = parseInt(m, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      periodDisplay = `${monthNames[mIdx]} ${y}`;
    }
  }

  const printTimestamp = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) + ` pukul ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

  // Compute Employee Summaries
  const summaries = calculateEmployeeWorkSummaries(attendances);
  const totalEmployees = summaries.length;
  const grandTotalWorkHours = Number(
    summaries.reduce((sum, s) => sum + s.totalWorkHours, 0).toFixed(1)
  );
  const avgHoursPerEmployee =
    totalEmployees > 0 ? (grandTotalWorkHours / totalEmployees).toFixed(1) : '0';
  const totalRecordsCount = attendances.length;

  // 1. TOP HEADER & BRANDING
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HRIS METARANEWS.CO', 14, 12);

  // Red dot/accent
  doc.setFillColor(220, 38, 38);
  doc.circle(84, 10.5, 2, 'F');

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('Sistem Informasi Manajemen Presensi & Verifikasi Biometrik GPS', 14, 18);

  // Right Header Info
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(`Periode: ${periodDisplay}`, pageWidth - 14, 11, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Departemen: ${options.departmentFilter || 'Semua Departemen'}`, pageWidth - 14, 16, { align: 'right' });
  doc.text(`Dicetak: ${printTimestamp}`, pageWidth - 14, 21, { align: 'right' });

  // 2. REPORT TITLE & KPI BANNER
  let currentY = 35;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`LAPORAN REKAPITULASI PRESENSI & JAM KERJA BULANAN`, 14, currentY);

  currentY += 4;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Ringkasan kumulatif jam kerja karyawan, absensi harian, kedisiplinan, serta perizinan resmi metaranews.co`,
    14,
    currentY
  );

  // 3. STAT METRICS BOXES
  currentY += 6;
  const boxWidth = (pageWidth - 28 - 15) / 4;
  const boxHeight = 16;

  // Box 1: Total Karyawan
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, boxWidth, boxHeight, 3, 3, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL KARYAWAN AKTIF', 18, currentY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalEmployees} Orang`, 18, currentY + 13);

  // Box 2: Total Jam Kerja
  const b2X = 14 + boxWidth + 5;
  doc.setFillColor(238, 242, 255); // Indigo-50
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(b2X, currentY, boxWidth, boxHeight, 3, 3, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(67, 56, 202);
  doc.text('TOTAL JAM KERJA TERKUMPUL', b2X + 4, currentY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(49, 46, 129);
  doc.text(`${grandTotalWorkHours} Jam`, b2X + 4, currentY + 13);

  // Box 3: Rerata Jam / Karyawan
  const b3X = b2X + boxWidth + 5;
  doc.setFillColor(240, 253, 244); // Emerald-50
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(b3X, currentY, boxWidth, boxHeight, 3, 3, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(21, 128, 61);
  doc.text('RERATA JAM / KARYAWAN', b3X + 4, currentY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 83, 45);
  doc.text(`${avgHoursPerEmployee} Jam/Bulan`, b3X + 4, currentY + 13);

  // Box 4: Total Log Presensi
  const b4X = b3X + boxWidth + 5;
  doc.setFillColor(254, 243, 199); // Amber-50
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(b4X, currentY, boxWidth, boxHeight, 3, 3, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 83, 9);
  doc.text('TOTAL REKAP PRESENSI', b4X + 4, currentY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 53, 15);
  doc.text(`${totalRecordsCount} Data`, b4X + 4, currentY + 13);

  currentY += boxHeight + 8;

  // 4. SUMMARY TABLE: TOTAL WORKING HOURS PER EMPLOYEE
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TABEL 1: RINGKASAN AKUMULASI JAM KERJA TIAP KARYAWAN', 14, currentY);

  const summaryTableRows = summaries.map((s, idx) => [
    idx + 1,
    s.employeeNumber,
    s.name,
    s.department,
    s.totalDaysPresent,
    s.totalDaysOnTime,
    s.totalDaysLate,
    s.totalDaysLeave,
    `${s.totalWorkHours} Jam`,
    `${s.avgDailyHours} Jam/Hari`,
  ]);

  // Add Grand Total row
  summaryTableRows.push([
    '',
    '',
    'TOTAL KESELURUHAN',
    '',
    summaries.reduce((acc, s) => acc + s.totalDaysPresent, 0),
    summaries.reduce((acc, s) => acc + s.totalDaysOnTime, 0),
    summaries.reduce((acc, s) => acc + s.totalDaysLate, 0),
    summaries.reduce((acc, s) => acc + s.totalDaysLeave, 0),
    `${grandTotalWorkHours} Jam`,
    `${avgHoursPerEmployee} Jam`,
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [[
      'No',
      'NIP',
      'Nama Karyawan',
      'Departemen',
      'Hadir (Hari)',
      'Tepat Waktu',
      'Terlambat',
      'Izin/Cuti/Sakit',
      'Total Jam Kerja',
      'Rata-rata/Hari',
    ]],
    body: summaryTableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
      2: { cellWidth: 50, fontStyle: 'bold' },
      3: { cellWidth: 35 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'center', cellWidth: 24, textColor: [16, 149, 106] },
      6: { halign: 'center', cellWidth: 22, textColor: [217, 119, 6] },
      7: { halign: 'center', cellWidth: 26, textColor: [147, 51, 234] },
      8: { halign: 'right', cellWidth: 28, fontStyle: 'bold', textColor: [37, 99, 235] },
      9: { halign: 'right', cellWidth: 26 },
    },
    didParseCell: (data) => {
      // Highlight the total summary row at the bottom
      if (data.row.index === summaryTableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    margin: { left: 14, right: 14 },
  });

  // 5. SECOND TABLE: DETAILED DAILY LOGS (Starts on new page or follows)
  doc.addPage();

  // Page 2 Header Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('HRIS METARANEWS.CO • LOG RINCIAN PRESENSI HARIAN', 14, 10.5);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Periode: ${periodDisplay}`, pageWidth - 14, 10.5, { align: 'right' });

  let detailY = 22;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TABEL 2: LOG RINCIAN PRESENSI HARIAN & JAM KERJA KARYAWAN', 14, detailY);

  const sortedAttendances = [...attendances].sort((a, b) => {
    // Sort by date ascending, then employee name
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.employeeName.localeCompare(b.employeeName);
  });

  const detailRows = sortedAttendances.map((att, idx) => {
    const isLeave = ['sick', 'annual_leave', 'permit'].includes(att.status);
    let statusLabel = 'Tepat Waktu';
    if (att.status === 'sick') statusLabel = 'Sakit';
    else if (att.status === 'annual_leave') statusLabel = 'Cuti Tahunan';
    else if (att.status === 'permit') statusLabel = 'Izin Khusus';
    else if (att.checkInStatus === 'late') statusLabel = 'Terlambat';
    else if (att.checkInStatus === 'out_of_range') statusLabel = 'Luar Radius';

    const checkInStr = isLeave ? 'Izin Resmi' : att.checkInTime ? `${att.checkInTime} WIB` : '-';
    const checkOutStr = isLeave ? 'Bebas Tugas' : att.checkOutTime ? `${att.checkOutTime} WIB` : 'Belum Pulang';
    const hoursStr = att.workHours ? `${att.workHours} Jam` : isLeave ? '0 Jam' : '-';
    const distanceStr = att.checkInLocation?.distanceMeters !== undefined ? `${att.checkInLocation.distanceMeters}m` : '-';

    const fullStatus = att.category && !isLeave ? `${att.category} - ${statusLabel}` : statusLabel;

    return [
      idx + 1,
      att.date,
      att.employeeNumber || '-',
      att.employeeName,
      att.department || '-',
      checkInStr,
      checkOutStr,
      hoursStr,
      distanceStr,
      fullStatus,
    ];
  });

  autoTable(doc, {
    startY: detailY + 3,
    head: [[
      'No',
      'Tanggal',
      'NIP',
      'Nama Karyawan',
      'Departemen',
      'Jam Masuk',
      'Jam Pulang',
      'Jam Kerja',
      'Jarak GPS',
      'Status Kehadiran',
    ]],
    body: detailRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85], // Slate-700
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 22 },
      3: { cellWidth: 48, fontStyle: 'bold' },
      4: { cellWidth: 32 },
      5: { halign: 'center', cellWidth: 24 },
      6: { halign: 'center', cellWidth: 24 },
      7: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      8: { halign: 'center', cellWidth: 20 },
      9: { halign: 'center', cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
  });

  // 6. SIGN-OFF BLOCK AT LAST PAGE
  // Check if we have room on the last page or add another page for signatures
  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  let signY = finalY + 12;

  if (signY + 40 > pageHeight) {
    doc.addPage();
    signY = 30;
  }

  const signWidth = 60;
  const leftSignX = 25;
  const rightSignX = pageWidth - 25 - signWidth;

  // Left Sign: HR Officer
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Dibuat & Diverifikasi Oleh,', leftSignX + signWidth / 2, signY, { align: 'center' });
  doc.text('Divisi Human Resources (HR)', leftSignX + signWidth / 2, signY + 4, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(options.adminName || 'HR Administrator', leftSignX + signWidth / 2, signY + 28, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.line(leftSignX, signY + 30, leftSignX + signWidth, signY + 30);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('metaranews.co HR Department', leftSignX + signWidth / 2, signY + 34, { align: 'center' });

  // Right Sign: Management / Directorship
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Mengetahui & Menyetujui,', rightSignX + signWidth / 2, signY, { align: 'center' });
  doc.text('Pimpinan / Manajemen Redaksi', rightSignX + signWidth / 2, signY + 4, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('( ................................................ )', rightSignX + signWidth / 2, signY + 28, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.line(rightSignX, signY + 30, rightSignX + signWidth, signY + 30);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Direksi PT Metara Siber Media', rightSignX + signWidth / 2, signY + 34, { align: 'center' });

  // 7. PAGE NUMBERING FOOTER ON ALL PAGES
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `HRIS metaranews.co • Laporan Resmi Presensi Bulanan • Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  // 8. SAVE & TRIGGER DOWNLOAD
  const cleanFileName = `Laporan_Presensi_Bulanan_${options.monthYearStr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(cleanFileName);
}
