export const ASSET_CLASSES = [
  "DEPOSIT",
  "MONEY_MARKET",
  "BIST_EQUITY",
  "GOLD",
  "FX",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

// Para piyasası katılım fonu dışındaki, pay hesabına giren varlık sınıfları.
// Sıra, hesaplama motorunun hedef/kalan işleme sırasıyla eşleşir.
export const SHARE_BASED_ASSET_CLASSES: readonly AssetClass[] = [
  "BIST_EQUITY",
  "GOLD",
  "FX",
];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  DEPOSIT: "Mevduat",
  MONEY_MARKET: "Para Piyasası Katılım Fonu",
  BIST_EQUITY: "BIST Katılım Hisse Fonu",
  GOLD: "Altın Katılım Fonu",
  FX: "Döviz Katılım/Borçlanma Fonu",
};

// Bir fon fiyatının "eski" sayılması için geçmesi gereken takvim günü.
// Kolayca değiştirilebilir tek bir sabit; hem admin panelinde hem de
// hesaplama ekranında bu değer kullanılır.
export const STALE_PRICE_THRESHOLD_DAYS = 4;

export const DISCLAIMER_TEXT =
  "Bilgilendirme ve hesaplama amaçlıdır; yatırım tavsiyesi değildir.";

export const RISK_PROFILE_KEYS = ["dusuk_1", "dusuk_2", "orta", "yuksek"] as const;
export type RiskProfileKey = (typeof RISK_PROFILE_KEYS)[number];
