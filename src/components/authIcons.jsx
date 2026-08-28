import { tokens } from "./styles.js";

// Shared between SignIn.jsx and SaveTeamSheet.jsx — both screens offer the
// same two sign-in options (Google, Email), and pulling the marks out here
// avoids the circular import that having one screen reach into the other
// for its icon would create. Same reasoning as matchDayIcons.jsx/
// strokeIcons.jsx being their own shared files rather than duplicated.

// Standard 4-color "G" mark, drawn inline so neither screen depends on an
// external image/icon font.
export function GoogleIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.98A9 9 0 000 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

// The envelope mark for "Continue with Email" / "Sign in with Email" —
// ours to draw (unlike Google/Apple's own published marks): 18px, stroke
// #3E5148 at 2.1px, round caps and joins, per the spec.
export function EnvelopeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tokens.color.groupLabel} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.5 6.5 12 13 20.5 6.5" />
    </svg>
  );
}

// A plain person mark for "Continue as Guest" (SignIn.jsx only — this
// option only ever shows on the sign-out-recovery screen, never
// SaveTeamSheet, which is reached specifically to stop being a guest).
// Same stroke convention as EnvelopeIcon above, nothing new invented.
export function GuestIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tokens.color.groupLabel} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
