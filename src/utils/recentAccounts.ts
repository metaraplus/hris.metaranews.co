export interface SavedAccount {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  department?: string;
  role?: string;
  lastLogin: string;
}

const STORAGE_KEY = 'hris_metaranews_recent_accounts';

export const getRecentAccounts = (): SavedAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Pre-seed with default user account
      return [
        {
          uid: 'default-admin',
          name: 'Metara Plus HR',
          email: 'metaraplus.metaranews@gmail.com',
          role: 'admin',
          department: 'Manajemen & HR',
          lastLogin: new Date().toISOString(),
        },
      ];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [
      {
        uid: 'default-admin',
        name: 'Metara Plus HR',
        email: 'metaraplus.metaranews@gmail.com',
        role: 'admin',
        department: 'Manajemen & HR',
        lastLogin: new Date().toISOString(),
      },
    ];
  } catch (e) {
    return [];
  }
};

export const saveRecentAccount = (account: SavedAccount): void => {
  try {
    const existing = getRecentAccounts().filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase()
    );
    const updated = [account, ...existing].slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving recent account', e);
  }
};

export const removeRecentAccount = (email: string): SavedAccount[] => {
  try {
    const filtered = getRecentAccounts().filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase()
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (e) {
    return [];
  }
};
