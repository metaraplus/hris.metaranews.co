import * as XLSX from 'xlsx';
import { AttendanceRecord } from '../types';

export function exportAttendancesToExcel(
  attendances: AttendanceRecord[],
  fileNamePrefix = 'Rekap_Presensi_Karyawan'
) {
  // Format Date for filename
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const fullFileName = `${fileNamePrefix}_${dateStr}.xlsx`;

  // 1. Prepare Main Attendance Table
  const tableData = attendances.map((att, idx) => {
    // Translate status to Indonesian
    let statusText = 'Hadir';
    if (att.status === 'late') statusText = 'Terlambat';
    if (att.status === 'half_day') statusText = 'Setengah Hari';
    if (att.status === 'absent') statusText = 'Tidak Hadir';

    let inStatusText = 'Tepat Waktu';
    if (att.checkInStatus === 'late') inStatusText = 'Terlambat';
    if (att.checkInStatus === 'out_of_range') inStatusText = 'Luar Radius Kantor';

    const checkInDistance = att.checkInLocation?.distanceMeters !== undefined
      ? `${att.checkInLocation.distanceMeters} m`
      : '-';

    const checkOutDistance = att.checkOutLocation?.distanceMeters !== undefined
      ? `${att.checkOutLocation.distanceMeters} m`
      : '-';

    return {
      'No': idx + 1,
      'Tanggal': att.date,
      'NIP': att.employeeNumber || '-',
      'Nama Karyawan': att.employeeName,
      'Departemen': att.department || '-',
      'Kategori': att.category || 'WFO',
      'Jam Masuk': att.checkInTime || '-',
      'Status Masuk': inStatusText,
      'Jarak GPS Masuk': checkInDistance,
      'Skor Wajah Masuk': att.checkInFaceMatchScore ? `${att.checkInFaceMatchScore}%` : '-',
      'Jam Pulang': att.checkOutTime || 'Belum Checkout',
      'Jarak GPS Pulang': checkOutDistance,
      'Total Jam Kerja': att.workHours ? `${att.workHours.toFixed(1)} Jam` : '-',
      'Status Kehadiran': statusText,
      'Catatan': att.notes || '-',
    };
  });

  // Create Workbook
  const wb = XLSX.utils.book_new();

  // Create Sheet 1: Detail Presensi
  const wsDetail = XLSX.utils.json_to_sheet(tableData);

  // Set column widths for Sheet 1
  wsDetail['!cols'] = [
    { wch: 5 },  // No
    { wch: 12 }, // Tanggal
    { wch: 15 }, // NIP
    { wch: 25 }, // Nama
    { wch: 18 }, // Departemen
    { wch: 12 }, // Jam Masuk
    { wch: 16 }, // Status Masuk
    { wch: 16 }, // Jarak GPS Masuk
    { wch: 16 }, // Skor Wajah
    { wch: 15 }, // Jam Pulang
    { wch: 16 }, // Jarak Pulang
    { wch: 16 }, // Total Jam Kerja
    { wch: 18 }, // Status Kehadiran
    { wch: 30 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Rekapitulasi Presensi');

  // 2. Prepare Summary Sheet
  const totalRecords = attendances.length;
  const onTimeCount = attendances.filter((a) => a.checkInStatus === 'on_time').length;
  const lateCount = attendances.filter((a) => a.checkInStatus === 'late').length;
  const outOfRangeCount = attendances.filter((a) => a.checkInStatus === 'out_of_range').length;
  const checkedOutCount = attendances.filter((a) => !!a.checkOutTime).length;

  const departmentCounts: Record<string, number> = {};
  attendances.forEach((a) => {
    const dept = a.department || 'Lainnya';
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
  });

  const summaryData = [
    { 'Indikator': 'Total Presensi Tercatat', 'Nilai': totalRecords },
    { 'Indikator': 'Tepat Waktu', 'Nilai': onTimeCount },
    { 'Indikator': 'Terlambat Masuk', 'Nilai': lateCount },
    { 'Indikator': 'Absen di Luar Radius', 'Nilai': outOfRangeCount },
    { 'Indikator': 'Sudah Clock-Out', 'Nilai': checkedOutCount },
    { 'Indikator': 'Tingkat Ketepatan Waktu', 'Nilai': totalRecords > 0 ? `${Math.round((onTimeCount / totalRecords) * 100)}%` : '0%' },
    { 'Indikator': '', 'Nilai': '' },
    { 'Indikator': '--- Distribusi Departemen ---', 'Nilai': '' },
    ...Object.entries(departmentCounts).map(([dept, count]) => ({
      'Indikator': `Departemen ${dept}`,
      'Nilai': count,
    })),
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 30 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Statistik');

  // Trigger browser download
  XLSX.writeFile(wb, fullFileName);
}
