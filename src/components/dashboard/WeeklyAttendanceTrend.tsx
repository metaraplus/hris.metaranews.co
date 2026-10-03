import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { AttendanceRecord } from '../../types';
import {
  TrendingUp,
  Clock,
  UserCheck,
  AlertTriangle,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';

interface WeeklyAttendanceTrendProps {
  attendances: AttendanceRecord[];
  selectedDepartment?: string;
}

interface DayTrendData {
  date: string;
  dayName: string;
  shortLabel: string;
  fullDateLabel: string;
  clockIns: number; // Total employee clock-ins
  onTime: number; // Tepat waktu
  lateArrivals: number; // Terlambat
  outOfRange: number; // Luar radius
  leaves: number; // Izin / Cuti / Sakit
  punctualityRate: number; // % tepat waktu
}

export const WeeklyAttendanceTrend: React.FC<WeeklyAttendanceTrendProps> = ({
  attendances,
  selectedDepartment = 'ALL',
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14>(7);
  const [chartType, setChartType] = useState<'composed' | 'stacked'>('composed');

  // Compute the last N days trend data
  const trendData = useMemo(() => {
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const fullDayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];

    const result: DayTrendData[] = [];
    const today = new Date();

    // Filter attendances by department if specified
    const deptFiltered = selectedDepartment === 'ALL'
      ? attendances
      : attendances.filter((a) => a.department === selectedDepartment);

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayIndex = d.getDay();
      const dayName = fullDayNames[dayIndex];
      const shortLabel = `${dayNames[dayIndex]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
      const fullDateLabel = `${dayName}, ${d.getDate()} ${monthNames[d.getMonth()]} ${year}`;

      // Get records for this day
      const dayRecords = deptFiltered.filter((a) => a.date === dateStr);

      let clockIns = 0;
      let onTime = 0;
      let lateArrivals = 0;
      let outOfRange = 0;
      let leaves = 0;

      dayRecords.forEach((att) => {
        const isLeave = ['sick', 'annual_leave', 'permit'].includes(att.status);
        if (isLeave) {
          leaves += 1;
        } else {
          // Employee clocked in
          clockIns += 1;
          if (att.checkInStatus === 'on_time') {
            onTime += 1;
          } else if (att.checkInStatus === 'late') {
            lateArrivals += 1;
          }

          if (att.checkInStatus === 'out_of_range') {
            outOfRange += 1;
          }
        }
      });

      const punctualityRate = clockIns > 0 ? Math.round((onTime / clockIns) * 100) : 100;

      result.push({
        date: dateStr,
        dayName,
        shortLabel,
        fullDateLabel,
        clockIns,
        onTime,
        lateArrivals,
        outOfRange,
        leaves,
        punctualityRate,
      });
    }

    return result;
  }, [attendances, selectedDepartment, rangeDays]);

  // Aggregate KPI Highlights for the selected period
  const totalClockInsPeriod = useMemo(
    () => trendData.reduce((sum, d) => sum + d.clockIns, 0),
    [trendData]
  );

  const totalLatePeriod = useMemo(
    () => trendData.reduce((sum, d) => sum + d.lateArrivals, 0),
    [trendData]
  );

  const totalOnTimePeriod = useMemo(
    () => trendData.reduce((sum, d) => sum + d.onTime, 0),
    [trendData]
  );

  const avgPunctualityPeriod = useMemo(() => {
    if (totalClockInsPeriod === 0) return 100;
    return Math.round((totalOnTimePeriod / totalClockInsPeriod) * 100);
  }, [totalClockInsPeriod, totalOnTimePeriod]);

  // Find day with highest punctuality and day with most lates
  const bestDay = useMemo(() => {
    const daysWithData = trendData.filter((d) => d.clockIns > 0);
    if (daysWithData.length === 0) return null;
    return [...daysWithData].sort((a, b) => b.punctualityRate - a.punctualityRate)[0];
  }, [trendData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: DayTrendData = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[210px] space-y-2">
          <div className="border-b border-slate-700/80 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-200">{data.fullDateLabel}</span>
            <span className="text-[10px] font-mono text-slate-400">{data.date}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-blue-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 shrink-0" />
                <span>Total Presensi Masuk:</span>
              </span>
              <span className="font-bold font-mono text-white text-sm">{data.clockIns}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0" />
                <span>Tepat Waktu:</span>
              </span>
              <span className="font-bold font-mono text-emerald-400">{data.onTime}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
                <span>Terlambat Datang:</span>
              </span>
              <span className="font-bold font-mono text-amber-400">{data.lateArrivals}</span>
            </div>

            {data.leaves > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-purple-500 shrink-0" />
                  <span>Izin / Cuti / Sakit:</span>
                </span>
                <span className="font-bold font-mono text-purple-300">{data.leaves}</span>
              </div>
            )}

            <div className="pt-1.5 border-t border-slate-700/80 flex items-center justify-between">
              <span className="text-slate-400">Tingkat Ketepatan:</span>
              <span className={`font-bold font-mono text-xs ${
                data.punctualityRate >= 90 ? 'text-emerald-400' : data.punctualityRate >= 75 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {data.punctualityRate}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs mb-6 space-y-5">
      {/* Component Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Tren Mingguan: Presensi Masuk vs. Keterlambatan
              </h2>
              <p className="text-xs text-slate-500">
                Visualisasi dinamika kehadiran harian karyawan dibandingkan dengan angka keterlambatan
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Range selector & Chart Style */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* 7 vs 14 Days Switcher */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setRangeDays(7)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                rangeDays === 7 ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setRangeDays(14)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                rangeDays === 14 ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              14 Hari
            </button>
          </div>

          {/* Chart Type Toggle */}
          <button
            type="button"
            onClick={() => setChartType(chartType === 'composed' ? 'stacked' : 'composed')}
            title="Ganti Mode Tampilan Grafik"
            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs flex items-center gap-1 font-medium transition-colors"
          >
            {chartType === 'composed' ? (
              <>
                <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden md:inline">Mode Perbandingan</span>
              </>
            ) : (
              <>
                <LineChartIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Mode Tumpuk</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Metric Strips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Masuk</span>
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-slate-900">{totalClockInsPeriod}</div>
          <span className="text-[10px] text-slate-400">Selama {rangeDays} hari terakhir</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Terlambat</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-amber-600">{totalLatePeriod}</div>
          <span className="text-[10px] text-slate-400">
            {totalClockInsPeriod > 0
              ? `${Math.round((totalLatePeriod / totalClockInsPeriod) * 100)}% dari total masuk`
              : '0% keterlambatan'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ketepatan Waktu</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-emerald-600">{avgPunctualityPeriod}%</div>
          <span className="text-[10px] text-slate-400">{totalOnTimePeriod} presensi tepat waktu</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Hari Paling Tertib</span>
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="text-sm font-bold text-slate-800 truncate">
            {bestDay ? `${bestDay.dayName} (${bestDay.punctualityRate}%)` : 'Belum Ada Data'}
          </div>
          <span className="text-[10px] text-slate-400">
            {bestDay ? `${bestDay.lateArrivals} terlambat` : 'Menunggu presensi'}
          </span>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={trendData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="clockInGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="lateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="onTimeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="shortLabel"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />

            {/* Left Y Axis: Jumlah Karyawan */}
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />

            {/* Right Y Axis: Persentase Ketepatan Waktu % */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#10b981' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              iconType="circle"
              iconSize={8}
            />

            {chartType === 'composed' ? (
              <>
                {/* Total Presensi Masuk Bar */}
                <Bar
                  yAxisId="left"
                  dataKey="clockIns"
                  name="Total Presensi Masuk"
                  fill="url(#clockInGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />

                {/* Terlambat Masuk Bar */}
                <Bar
                  yAxisId="left"
                  dataKey="lateArrivals"
                  name="Terlambat Datang"
                  fill="url(#lateGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />

                {/* Line for punctuality trend rate (%) */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="punctualityRate"
                  name="Tingkat Ketepatan Waktu (%)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#10b981', strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </>
            ) : (
              <>
                {/* Stacked Bars: Tepat Waktu + Terlambat */}
                <Bar
                  yAxisId="left"
                  dataKey="onTime"
                  name="Tepat Waktu"
                  stackId="attendanceStack"
                  fill="url(#onTimeGradient)"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={42}
                />
                <Bar
                  yAxisId="left"
                  dataKey="lateArrivals"
                  name="Terlambat Datang"
                  stackId="attendanceStack"
                  fill="url(#lateGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                />
                {/* Line for punctuality trend rate */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="punctualityRate"
                  name="Tingkat Ketepatan Waktu (%)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb' }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
