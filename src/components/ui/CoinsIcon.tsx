interface IconProps {
  className?: string;
}

/** "Fonlar" sekmesi için sade çizgisel, üst üste madeni paralar ikonu. */
export function CoinsIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="15" r="6" />
      <circle cx="16.5" cy="9" r="6" />
    </svg>
  );
}
