export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  distanceMeters?: number;
  withinGeofence?: boolean;
}

export interface OfficeSetting {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  workStartTime: string; // e.g. "08:00"
  workEndTime: string; // e.g. "17:00"
  lateToleranceMinutes?: number; // e.g. 15
  updatedAt?: string;
  updatedBy?: string;
}

export interface Employee {
  id: string; // Document ID (usually auth UID or custom EMP id)
  uid: string; // Auth UID
  employeeNumber: string; // NIP
  name: string;
  email: string;
  department: string;
  position: string;
  phone?: string;
  role: 'admin' | 'employee';
  faceRegistered: boolean;
  facePhotoUrl?: string; // Reference image data URL or URL
  faceDescriptor?: string; // Biometric signature string
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  userId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkInTimestamp?: number;
  checkInLocation?: GPSCoordinate;
  checkInPhoto?: string; // Data URL of captured selfie
  checkInFaceMatchScore?: number; // 0 - 100
  checkInStatus?: 'on_time' | 'late' | 'out_of_range';
  checkOutTime?: string;
  checkOutTimestamp?: number;
  checkOutLocation?: GPSCoordinate;
  checkOutPhoto?: string;
  checkOutFaceMatchScore?: number;
  workHours?: number;
  status: 'present' | 'late' | 'half_day' | 'absent';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FaceVerificationResult {
  matched: boolean;
  score: number; // 0 - 100
  photoDataUrl: string;
  message: string;
  isLivenessPassed: boolean;
}
