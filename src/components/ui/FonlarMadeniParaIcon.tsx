interface IconProps {
  className?: string;
}

/**
 * "Fonlar" sekmesi ikonu. Kaynak: src/assets/navigation/fonlar-madeni-para-ikon.svg
 * — şekil verisi (path/ellipse/stroke-width/linecap) birebir korunmuştur,
 * yalnızca kök `color="#37d6ad"` niteliği kaldırılmıştır: bu nitelik
 * `currentColor`ı kilitleyip aktif/pasif sekme rengine göre otomatik
 * değişmesini engellerdi (bkz. UserLayout.tsx).
 */
export function FonlarMadeniParaIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <ellipse cx="16" cy="7" rx="10.5" ry="4" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M5.5 7v6c0 2.2 4.7 4 10.5 4s10.5-1.8 10.5-4V7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 13v6c0 2.2 4.7 4 10.5 4s10.5-1.8 10.5-4v-6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 19v6c0 2.2 4.7 4 10.5 4s10.5-1.8 10.5-4v-6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
