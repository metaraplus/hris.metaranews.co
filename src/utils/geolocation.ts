import { GPSCoordinate, OfficeSetting } from '../types';

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Formats distance in meters to readable Indonesian text
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} meter`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Retrieves user's current GPS position with high accuracy
 */
export function getCurrentGPSPosition(): Promise<GPSCoordinate> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat atau browser tidak mendukung fitur Geolocation GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        let address = '';

        // Attempt reverse geocoding asynchronously without blocking
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: { 'Accept-Language': 'id' },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          if (response.ok) {
            const data = await response.json();
            address = data.display_name?.split(',').slice(0, 3).join(', ') || '';
          }
        } catch {
          address = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
        }

        resolve({
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          address: address || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
        });
      },
      (error) => {
        let msg = 'Gagal mendeteksi lokasi GPS.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Izin akses lokasi GPS ditolak oleh pengguna/browser. Mohon izinkan akses lokasi.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = 'Sinyal GPS tidak tersedia atau perangkat sedang offline.';
            break;
          case error.TIMEOUT:
            msg = 'Waktu permintaan lokasi GPS habis (timeout). Silakan coba lagi.';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Evaluates whether coordinates fall within office geofence radius
 */
export function evaluateGeofence(
  currentPos: GPSCoordinate,
  office: OfficeSetting
): {
  distanceMeters: number;
  withinGeofence: boolean;
  message: string;
} {
  const distance = calculateDistanceMeters(
    currentPos.latitude,
    currentPos.longitude,
    office.latitude,
    office.longitude
  );

  const withinGeofence = distance <= office.radiusMeters;
  const message = withinGeofence
    ? `Berada di dalam radius kantor (${distance}m dari pusat, batas maks: ${office.radiusMeters}m)`
    : `Di luar radius kantor (${distance}m dari pusat, toleransi: ${office.radiusMeters}m)`;

  return {
    distanceMeters: distance,
    withinGeofence,
    message,
  };
}

/**
 * Default standard office settings (Jakarta CBD sample)
 */
export const DEFAULT_OFFICE_SETTING: OfficeSetting = {
  name: 'Kantor Pusat Metara (Jakarta)',
  latitude: -6.2087634,
  longitude: 106.845599,
  radiusMeters: 150, // 150 meters radius
  workStartTime: '08:00',
  workEndTime: '17:00',
  lateToleranceMinutes: 15,
};
