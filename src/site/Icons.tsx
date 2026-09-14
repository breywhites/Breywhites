import React from 'react';

type P = { size?: number; color?: string; stroke?: number; className?: string };
const base = (size = 18, color = 'currentColor', stroke = 1.5) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: stroke,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const IconChat = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M4 19.5l1.3-3.9A8 8 0 1 1 8.4 18.7z" /></svg>
);
export const IconPhone = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1.3 1.3 0 0 1 1.3-.3c1 .3 2 .5 3.1.5a1.3 1.3 0 0 1 1.3 1.3V20a1.3 1.3 0 0 1-1.3 1.3A17.3 17.3 0 0 1 2.7 4.3 1.3 1.3 0 0 1 4 3h3.3a1.3 1.3 0 0 1 1.3 1.3c0 1.1.2 2.1.5 3.1a1.3 1.3 0 0 1-.3 1.3z" /></svg>
);
export const IconMail = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><rect x="3" y="5" width="18" height="14" /><path d="M3 6l9 7 9-7" /></svg>
);
export const IconMenu = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M4 8h16M4 16h16" /></svg>
);
export const IconClose = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconLeft = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconRight = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconArrow = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconPlay = ({ size = 22, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M8 5v14l12-7z" /></svg>
);
export const IconCamera = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".6" fill="currentColor" /></svg>
);
export const IconCheck = ({ size, color, stroke }: P) => (
  <svg {...base(size, color, stroke)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

/* ---- admin ---- */
const mk = (d: React.ReactNode) => ({ size, color, stroke }: P) => <svg {...base(size, color, stroke)}>{d}</svg>;
export const IconHome = mk(<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>);
export const IconInbox = mk(<><path d="M3 13l3-8h12l3 8" /><path d="M3 13v6h18v-6h-5l-1.5 2.5h-5L8 13z" /></>);
export const IconFile = mk(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>);
export const IconReceipt = mk(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>);
export const IconCalendar = mk(<><rect x="3.5" y="5" width="17" height="15.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const IconImage = mk(<><rect x="3.5" y="4.5" width="17" height="15" /><circle cx="9" cy="10" r="1.6" /><path d="M4 18l5-4.5 4 3.5 3-2.5 4 3.5" /></>);
export const IconBox = mk(<><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" /></>);
export const IconSettings = mk(<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>);
export const IconLink = mk(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const IconPlus = mk(<path d="M12 5v14M5 12h14" />);
export const IconMinus = mk(<path d="M5 12h14" />);
export const IconTrash = mk(<><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></>);
export const IconUp = mk(<path d="M6 15l6-6 6 6" />);
export const IconDown = mk(<path d="M6 9l6 6 6-6" />);
export const IconShare = mk(<><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v8h14v-8" /></>);
export const IconOut = mk(<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h11" /></>);
export const IconExternal = mk(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>);
export const IconMore = mk(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>);
export const IconCopy = mk(<><rect x="8" y="8" width="12" height="12" /><path d="M16 8V4H4v12h4" /></>);
export const IconFilm = mk(<><rect x="3" y="5" width="18" height="14" /><path d="M10 9.5v5l4.2-2.5z" /></>);
export const IconStar = mk(<path d="M12 3.5l2.4 5 5.4.7-4 3.8 1 5.4L12 15.8 7.2 18.4l1-5.4-4-3.8 5.4-.7z" />);
