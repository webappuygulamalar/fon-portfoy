interface CustomProfileCardProps {
  /** Yalnızca GÖRSEL vurgu içindir (kullanıcının şu an aktif seçimi Özel mi) — bir toggle DEĞİLDİR. */
  selected: boolean;
  onSelect: () => void;
}

/**
 * Hazır risk profili kartlarının (RiskProfileSelector) sonuna eklenen
 * beşinci, sabit kart. Admin tarafından yayınlanan bir risk profili
 * DEĞİLDİR — `ProfileModel` listesine hiçbir zaman girmez, dolayısıyla
 * Supabase'e yeni bir risk profili olarak asla kaydedilmez (bkz.
 * `CUSTOM_PROFILE_ID`).
 *
 * Diğer kartlardan farklı olarak bu kart bir TOGGLE değil, ayrı bir adıma
 * (`#/hesaplama/ozel`) GÖTÜREN bir eylemdir — bu yüzden bilinçli olarak
 * `aria-pressed` KULLANMAZ (o, aynı sayfada kalan bir basılı/basılı-değil
 * durumu ifade eder). Gerçek bir `<button type="button">` olması, Tab ile
 * odaklanabilmeyi ve hem Enter hem Space ile açılabilmeyi (native buton
 * davranışı) garanti eder.
 */
export function CustomProfileCard({ selected, onSelect }: CustomProfileCardProps) {
  return (
    <button
      type="button"
      className={`risk-profile-card custom-profile-card${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <span className="risk-profile-card-name">Özel</span>

      <span className="risk-profile-chart-wrap custom-profile-icon" aria-hidden="true">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <line x1="18" y1="14" x2="18" y2="58" stroke="var(--color-border-strong)" strokeWidth="2" />
          <circle cx="18" cy="30" r="6" fill="var(--color-mint)" />
          <line x1="36" y1="14" x2="36" y2="58" stroke="var(--color-border-strong)" strokeWidth="2" />
          <circle cx="36" cy="46" r="6" fill="var(--color-chart-blue)" />
          <line x1="54" y1="14" x2="54" y2="58" stroke="var(--color-border-strong)" strokeWidth="2" />
          <circle cx="54" cy="24" r="6" fill="var(--color-gold)" />
        </svg>
      </span>

      <span className="risk-profile-card-desc custom-profile-desc">
        Yatırım dağılımınızı kendiniz oluşturun.
        <svg
          className="custom-profile-chevron"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
