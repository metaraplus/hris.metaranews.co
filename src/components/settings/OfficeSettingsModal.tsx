import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Save,
  Navigation,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { OfficeSetting, GPSCoordinate } from '../../types';
import { getCurrentGPSPosition, DEFAULT_OFFICE_SETTING } from '../../utils/geolocation';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface OfficeSettingsProps {
  currentSetting: OfficeSetting;
  onSettingUpdated: (setting: OfficeSetting) => void;
}

export const OfficeSettingsView: React.FC<OfficeSettingsProps> = ({
  currentSetting,
  onSettingUpdated,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<OfficeSetting>({ ...currentSetting });
  const [calibrating, setCalibrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calibrate to current user GPS
  const handleUseCurrentLocation = async () => {
    setCalibrating(true);
    setSuccessMessage(null);
    try {
      const pos: GPSCoordinate = await getCurrentGPSPosition();
      setFormData((prev) => ({
        ...prev,
        latitude: Number(pos.latitude.toFixed(7)),
        longitude: Number(pos.longitude.toFixed(7)),
      }));
      setSuccessMessage('Koordinat berhasil dikalibrasi sesuai posisi GPS perangkat Anda saat ini.');
    } catch (err: any) {
      alert(err.message || 'Gagal membaca koordinat GPS perangkat.');
    } finally {
      setCalibrating(false);
    }
  };

  const handleResetDefault = () => {
    setFormData({ ...DEFAULT_OFFICE_SETTING });
    setSuccessMessage('Pengaturan dikembalikan ke koordinat standar.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);

    try {
      const settingToSave: OfficeSetting = {
        name: formData.name,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        radiusMeters: Number(formData.radiusMeters),
        workStartTime: formData.workStartTime,
        workEndTime: formData.workEndTime,
        lateToleranceMinutes: Number(formData.lateToleranceMinutes || 15),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'admin',
      };

      await setDoc(doc(db, 'settings', 'office'), settingToSave);
      onSettingUpdated(settingToSave);
      setSuccessMessage('Pengaturan lokasi kantor & geofence berhasil disimpan ke Firestore!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/office');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Pengaturan Lokasi GPS & Jam Kerja Kantor
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Tentukan titik koordinat kantor, batas radius geofencing presensi, dan jam operasional
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Geolocation Section */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Titik Koordinat & Geofence</h3>
                <p className="text-xs text-slate-500">Batas area presensi karyawan yang diperbolehkan</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={calibrating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-all border border-blue-200 cursor-pointer"
            >
              {calibrating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>Gunakan Lokasi GPS Saya</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Kantor / Lokasi Kerja
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Latitude GPS
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm font-mono border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Longitude GPS
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm font-mono border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Radius Toleransi Geofence: <span className="text-blue-600 font-bold">{formData.radiusMeters} Meter</span>
                </label>
                <span className="text-xs text-slate-400">Jarak maksimal dari titik pusat</span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="10"
                value={formData.radiusMeters}
                onChange={(e) => setFormData({ ...formData, radiusMeters: Number(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>20m (Ketat)</span>
                <span>150m (Standar Kantor)</span>
                <span>500m</span>
                <span>1000m (Kampus/Kawasan Luas)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Work Hours Section */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Jadwal & Jam Kerja</h3>
              <p className="text-xs text-slate-500">Aturan jam masuk, jam pulang, dan toleransi keterlambatan</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jam Masuk (Format HH:mm)
              </label>
              <input
                type="time"
                required
                value={formData.workStartTime}
                onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jam Pulang (Format HH:mm)
              </label>
              <input
                type="time"
                required
                value={formData.workEndTime}
                onChange={(e) => setFormData({ ...formData, workEndTime: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Toleransi Terlambat (Menit)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                required
                value={formData.lateToleranceMinutes || 15}
                onChange={(e) => setFormData({ ...formData, lateToleranceMinutes: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Default Jakarta</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-98 transition-all cursor-pointer"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
