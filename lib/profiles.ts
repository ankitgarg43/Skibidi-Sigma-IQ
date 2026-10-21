import { Profile, SavedSession } from '../types';

// On-device user profiles. GitHub Pages is static hosting — there is no server
// to run real accounts on — so a "login" here means a named profile stored in
// this browser, with its own history and saved (paused / in-progress) quizzes.
// An optional PIN is a convenience lock to keep profiles separate on a shared
// device; its hash is stored locally and it is NOT account security. Real
// cross-device accounts would need a backend (e.g. Supabase/Firebase).

const PROFILES_KEY = 'sigma-plus-profiles-v1';
const ACTIVE_KEY = 'sigma-plus-active-profile-v1';
export const GUEST_ID = 'guest';

function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) + h + pin.charCodeAt(i)) >>> 0;
  return `h${h.toString(36)}`;
}

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function storeProfiles(profiles: Profile[]): void {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
}

export function createProfile(name: string, pin?: string): Profile {
  const profile: Profile = {
    id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: name.trim(),
    pinHash: pin ? hashPin(pin) : undefined,
    createdAt: Date.now(),
  };
  storeProfiles([...loadProfiles(), profile]);
  return profile;
}

export function checkPin(profile: Profile, pin: string): boolean {
  return !profile.pinHash || profile.pinHash === hashPin(pin);
}

export function getActiveProfileId(): string {
  try { return localStorage.getItem(ACTIVE_KEY) || GUEST_ID; } catch { return GUEST_ID; }
}

export function setActiveProfileId(id: string): void {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
}

export function profileDisplayName(id: string, profiles: Profile[]): string {
  if (id === GUEST_ID) return 'Guest';
  return profiles.find((p) => p.id === id)?.name || 'Guest';
}

// ---- Per-profile saved (paused / in-progress) quiz session ----
function sessionKey(profileId: string): string {
  return `sigma-plus-session-${profileId}-v1`;
}

export function loadSession(profileId: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.questions) ? (parsed as SavedSession) : null;
  } catch { return null; }
}

export function saveSession(profileId: string, session: SavedSession): void {
  try { localStorage.setItem(sessionKey(profileId), JSON.stringify(session)); } catch { /* ignore */ }
}

export function clearSession(profileId: string): void {
  try { localStorage.removeItem(sessionKey(profileId)); } catch { /* ignore */ }
}
