interface IconProps {
  className?: string;
}

/**
 * "Hesaplama" sekmesi ikonu. Kaynak: src/assets/navigation/hesaplama-pasta-ikon.svg
 * — şekil verisi (path/stroke-width/linecap) birebir korunmuştur, yalnızca
 * kök `color="#37d6ad"` niteliği kaldırılmıştır: bu nitelik `currentColor`ı
 * kilitleyip aktif/pasif sekme rengine göre otomatik değişmesini engellerdi
 * (bkz. UserLayout.tsx — .nav-link/.mobile-tabbar-item'ın `color`ı miras alınır).
 */
export function HesaplamaPastaIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M14.5 3.5A12.5 12.5 0 1 0 28.5 17H14.5V3.5Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 3.5A10.5 10.5 0 0 1 28.5 14H18V3.5Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
