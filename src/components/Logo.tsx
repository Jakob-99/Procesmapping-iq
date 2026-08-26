/*
  Mærket: et hjørne der lukker sig om en kerne. Hjørnestenen som stadig
  mangler at blive lagt — og det den beskytter.
*/
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 9.5V3.5h6"
        stroke="var(--color-clay)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M21 14.5v6h-6"
        stroke="var(--color-clay)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect
        x="8.25"
        y="8.25"
        width="7.5"
        height="7.5"
        rx="1.2"
        stroke="var(--color-text)"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/*
  Samme mærke, men i currentColor — så det kan farves per forslag i menuen
  (fx et pinnet AIOS-forslag) i stedet for altid at bære brand-farven.
*/
export function LogoMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 9.5V3.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21 14.5v6h-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="8.25" y="8.25" width="7.5" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      {!compact && (
        <span className="whitespace-nowrap text-[15px] font-medium tracking-tight">
          Corner<span className="text-(--color-clay)">IQ</span>
        </span>
      )}
    </div>
  );
}
