/** Thin-stroke nav icons matching Teamify-style sidebar */

const paths = {
  usage: (
    <>
      <path d="M4 18V10M10 18V6M16 18v-8M22 18V4" strokeLinecap="round" />
    </>
  ),
  queue: (
    <>
      <path d="M8 6h13M8 12h13M8 18h9" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  add: (
    <>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7v12a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
    </>
  ),
  license: (
    <>
      <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
    </>
  ),
  results: (
    <>
      <path d="M4 6h16M4 12h10" strokeLinecap="round" />
      <circle cx="17" cy="15" r="4" />
      <path d="M15.5 15l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function NavIcon({ name, size = 22 }) {
  return (
    <svg
      className="nav-svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
