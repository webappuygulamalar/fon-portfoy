export interface DonutChartSegment {
  key: string;
  /** 0-100 aralığında. Toplamın 100 olması çağıranın sorumluluğundadır. */
  percentage: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutChartSegment[];
  /** Dış çap, px. */
  size?: number;
  strokeWidth?: number;
  /** Grafiği özetleyen erişilebilir ad. Verilmezse grafik dekoratif (aria-hidden) sayılır. */
  title?: string;
}

/**
 * Bağımlılıksız, küçük ve erişilebilir SVG donut grafiği. Harici bir
 * grafik kütüphanesi eklemek yerine `stroke-dasharray`/`stroke-dashoffset`
 * tekniğiyle segmentleri iç içe geçmiş `<circle>` halkaları olarak çizer.
 *
 * Erişilebilirlik: grafiğin yanında/altında AYNI bilgiyi gerçek metin
 * olarak gösteren bir legend varsa (bu bileşenin asıl kullanım amacı),
 * `title` verilmemelidir — grafik `aria-hidden` olur ve ekran okuyucu
 * yalnızca legend metnini okur (aynı yüzdelerin iki kez, biri SVG'den
 * biri legend'den anonslanmasını önler). `title` verilirse grafik
 * `role="img"` ile kendi başına anlamlı kabul edilir.
 */
export function DonutChart({ segments, size = 128, strokeWidth = 18, title }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const visible = segments.filter((s) => s.percentage > 0);
  const arcs = visible.map((s, i) => {
    const cumulativeBefore = visible.slice(0, i).reduce((sum, x) => sum + x.percentage, 0);
    const length = (s.percentage / 100) * circumference;
    const dashoffset = -((cumulativeBefore / 100) * circumference);
    return { ...s, length, dashoffset };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      focusable="false"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
      <g transform={`rotate(-90 ${center} ${center})`}>
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={arc.dashoffset}
          />
        ))}
      </g>
    </svg>
  );
}
