interface IconProps {
  className?: string;
}

/** "Hesaplama" sekmesi için sade çizgisel pasta grafik ikonu. */
export function PieChartIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12 L12 3" />
      <path d="M12 12 L20.9 13.6" />
      <path d="M12 12 L6.2 18.9" />
    </svg>
  );
}
