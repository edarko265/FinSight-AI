type IconProps = { className?: string; filled?: boolean };

function Svg({
  className = "size-6",
  filled,
  children,
}: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const InfoIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);
export const DashboardIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" />
  </Svg>
);
export const ChatIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 5h16v11H9l-5 4V5z" />
  </Svg>
);
export const BellIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16z" />
    <path d="M10 20a2 2 0 004 0" fill="none" />
  </Svg>
);
export const SettingsIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p} filled={false}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 00-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 00-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 002.2 1.3L10 21h4l.4-2.4a7 7 0 002.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z" />
  </Svg>
);
export const TargetIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p} filled={false}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </Svg>
);
export const EyeIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const EyeOffIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6A16.6 16.6 0 002 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 004.2 4.2" />
  </Svg>
);
export const MicIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" />
  </Svg>
);
export const SpeakerIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
  </Svg>
);
export const StopIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p} filled>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Svg>
);
export const PhoneIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  </Svg>
);
export const ExpandIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
export const CollapseIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
);
export const SendIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 12l16-8-6 16-3-7-7-1z" />
  </Svg>
);
export const CloseIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const PlusIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

/** The FinSight mark: rising bars inside a speech bubble. Matches the app icon. */
export function Logo({ className = "size-9" }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#004628" />
      <path
        d="M112 132h288a40 40 0 0 1 40 40v152a40 40 0 0 1-40 40H250l-82 62v-62h-56a40 40 0 0 1-40-40V172a40 40 0 0 1 40-40z"
        fill="#0a5a36"
      />
      <rect x="140" y="252" width="52" height="76" rx="14" fill="#91fa9b" />
      <rect x="230" y="206" width="52" height="122" rx="14" fill="#91fa9b" />
      <rect x="320" y="160" width="52" height="168" rx="14" fill="#91fa9b" />
    </svg>
  );
}
