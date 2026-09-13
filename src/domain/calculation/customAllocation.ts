import { ASSET_CLASSES, type AssetClass } from "../../lib/constants";
import type { ProfileModel } from "../model/publishedModel";
import type { FundAssetClass } from "./types";

/**
 * Gerçek (Supabase'ten yayınlanmış) bir risk profiliyle asla çakışmayacak
 * sabit kimlik — profil id'leri veritabanında UUID'dir. `selectedProfileId`
 * bu değere eşitse kullanıcı "Özel" kartını seçmiştir; hiçbir zaman
 * `model_preferred_funds`/`risk_profiles` tablolarına yazılmaz.
 */
export const CUSTOM_PROFILE_ID = "custom";

export const CUSTOM_PROFILE_NAME = "Özel Dağılım";

export const CUSTOM_PROFILE_DESCRIPTION = "Yatırım dağılımınızı kendiniz oluşturun.";

/** Tüm sınıflar %0 ile başlar — kullanıcı hiç dokunmazsa toplam %0'dır. */
export const EMPTY_CUSTOM_ALLOCATIONS: Record<AssetClass, number> = {
  DEPOSIT: 0,
  MONEY_MARKET: 0,
  BIST_EQUITY: 0,
  GOLD: 0,
  FX: 0,
};

/** 0-100 aralığına kırpar ve en yakın tam sayıya yuvarlar. Sonlu olmayan (NaN/Infinity) girdide değişiklik yapılmaz. */
export function clampPercentage(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function customAllocationTotal(allocations: Record<AssetClass, number>): number {
  return ASSET_CLASSES.reduce((sum, ac) => sum + (allocations[ac] ?? 0), 0);
}

export function isCustomAllocationComplete(allocations: Record<AssetClass, number>): boolean {
  return customAllocationTotal(allocations) === 100;
}

/**
 * TEK merkezi görünürlük kuralı: Özel dağılımda kullanıcının bir kategoriye
 * (Mevduat, PPF, Hisse, Altın, Döviz — hepsi aynı kurala tabi) tam %0
 * verdiği durumda o kategori Model Dağılımı ve Pay Hesaplama Özeti'nin
 * HİÇBİR görünümünde (masaüstü tablo, mobil kart) gösterilmez — fon kartı,
 * fiyatı, getirisi, "Fonu değiştir" butonu dahil hiçbir parçası render
 * edilmez. Yalnızca CSS ile saklama DEĞİLDİR; çağıran taraf bu satırı hiç
 * render ETMEMELİDİR (bkz. AllocationEditor, CalculationSummary).
 *
 * Bu kural YALNIZCA Özel dağılım için geçerlidir (`isCustom=true` iken) —
 * hazır (yayınlanmış) risk profillerinde `isCustom` her zaman `false`
 * olduğundan bu fonksiyon onlar için her zaman `false` döner; görünümleri/
 * hesaplama davranışları hiçbir koşulda etkilenmez.
 *
 * Not: Para Piyasası Katılım Fonu (PPF) satırının kendi ayrı bir istisnası
 * VARDI (varsayılan politikada diğer fonların yuvarlama artığını taşıyıp
 * %0 planlansa bile gerçek tutar barındırabildiği için yalnızca hedef+
 * gerçekleşen tutar ikisi de sıfırsa gizlenir — bkz. CalculationSummary).
 * Bu, `isCustom=true` iken (yani `roundingRemainderPolicy=
 * CASH_IF_MONEY_MARKET_ZERO` devredeyken) PPF hedefi/gerçekleşeni her
 * zaman planlanan yüzdeyle birlikte sıfırlanır, bu yüzden PLANLANAN
 * yüzdeye bakan BU fonksiyonla tutarlıdır — ayrı bir dal GEREKMEZ.
 */
export function isHiddenZeroPercentCategory(isCustom: boolean, plannedPercentage: number): boolean {
  return isCustom && plannedPercentage <= 0;
}

/**
 * sessionStorage'dan okunan ham (tipsiz) veriyi güvenle doğrulanmış bir
 * dağılıma çevirir. Nesnenin tamamı ya da tek bir alanı beklenen şekilde
 * değilse (bozulmuş/elle değiştirilmiş veri), TÜMÜ sessizce reddedilip
 * %0'lardan oluşan güvenli başlangıç durumuna dönülür — kısmi/yanlış onarım
 * yapılmaz.
 */
export function sanitizeCustomAllocations(value: unknown): Record<AssetClass, number> {
  if (typeof value !== "object" || value === null) {
    return { ...EMPTY_CUSTOM_ALLOCATIONS };
  }

  const raw = value as Record<string, unknown>;
  const result: Record<AssetClass, number> = { ...EMPTY_CUSTOM_ALLOCATIONS };
  for (const ac of ASSET_CLASSES) {
    const v = raw[ac];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100) {
      return { ...EMPTY_CUSTOM_ALLOCATIONS };
    }
    result[ac] = v;
  }
  return result;
}

/**
 * Özel dağılımı, mevcut hesaplama akışının (`buildCalculationInput`,
 * `resolveFundSelections`, `AllocationEditor`, `CalculationSummary`,
 * `FundSubstitutionPage`) beklediği `ProfileModel` şekline dönüştürür.
 * Böylece motor/UI katmanlarında "özel" için ayrı bir kod yolu YOKTUR —
 * tek fark, bu profilin hiçbir zaman `data.profiles` (yayınlanmış model)
 * içinde bulunmaması ve Supabase'e asla yazılmamasıdır.
 *
 * Standart fon çözümü: fon değişimi yapılmamış her varlık sınıfı için,
 * admin panelinin "varsayılan, tüm profiller" (profile_id NULL) olarak
 * tanımladığı fon kullanılır — bkz. `buildDefaultPreferredFundIdByAssetClass`.
 * Bu, profile özel olmayan TEK merkezi tercih kaynağıdır ve bir model
 * yayınlanabilmesi için zaten dolu olması zorunludur (bkz.
 * AdminModelEditorPage `missingPreferredFunds`), bu yüzden profiller arası
 * keyfi bir seçim yapılmaz.
 */
export function buildCustomProfileModel(
  allocations: Record<AssetClass, number>,
  defaultPreferredFundIdByAssetClass: Partial<Record<FundAssetClass, string>>,
): ProfileModel {
  return {
    profileId: CUSTOM_PROFILE_ID,
    key: "custom",
    name: CUSTOM_PROFILE_NAME,
    description: CUSTOM_PROFILE_DESCRIPTION,
    sortOrder: Number.MAX_SAFE_INTEGER,
    allocations,
    preferredFundIdByAssetClass: defaultPreferredFundIdByAssetClass,
  };
}
