// Simple running-player pictogram — reads as an active footballer rather
// than a generic person icon.
export default function FootballerIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="14.5" cy="4.2" r="2.1" />
      <path d="M12.8 7.3c-.5-.2-1-.1-1.4.3l-2.6 2.6-3.4.6a1 1 0 00.3 2l3.9-.7c.3-.1.6-.2.8-.4l1.7-1.7.6 2-3 2.3-1.6 5.1a1 1 0 001.9.6l1.5-4.7 2.1-1.6 1 2.9-1.6 4.1a1 1 0 001.9.7l1.8-4.7a1.6 1.6 0 00-.1-1.3l-1.3-2.7 1.1-3.4 2.6 1.2a1 1 0 10.9-1.8l-3.3-1.6a1.3 1.3 0 00-1.6.4l-1.2 1.7-1.9-.6z" />
    </svg>
  );
}
