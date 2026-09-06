import { describe, expect, it } from "vitest";
import {
  decodeNextRscChunks,
  extractFundDetailArray,
  extractRiskFromFundDetail,
  founderMatches,
  type KapFundDetailItem,
} from "./kapRiskParser.ts";

// Kullanıcının verdiği iki gerçek örnek KAP sayfasından (risk=7 ve risk=2)
// AYNEN çekilmiş `fundDetail` verisi — bunlar EMEKLİLİK (EYF) fonları,
// kapsamımız dışında, ama kullanıcı bunları KAP'ın risk verisi taşıdığına
// dair kanıt olarak verdiği için ayrıştırıcının bu şemayı da doğru
// okuduğunu kanıtlamak amacıyla test sabiti olarak kullanılıyor.
const RISK7_ITEMS: KapFundDetailItem[] = [
  {
    itemName: "Fonun Risk Aralığı",
    itemKey: "kpy81_acc1_fonun_risk_araligi",
    value: "Agresif (5-7)",
    creationDate: "21/08/2019 09:28:23",
  },
  {
    itemName: "Fonun Risk Değeri",
    itemKey: "kpy81_acc1_fonun_risk_degeri",
    value: "7",
    creationDate: "10/07/2026 14:35:23",
  },
];

const RISK2_ITEMS: KapFundDetailItem[] = [
  {
    itemName: "Fonun Risk Aralığı",
    itemKey: "kpy81_acc1_fonun_risk_araligi",
    value: "Muhafazakar/Temkinli (1-2) ",
    creationDate: "22/08/2019 17:12:34",
  },
  {
    itemName: "Fonun Risk Değeri",
    itemKey: "kpy81_acc1_fonun_risk_degeri",
    value: "2",
    creationDate: "17/06/2019 15:03:54",
  },
];

function strategyItem(riskDegeriValues: (string | null)[]): KapFundDetailItem {
  return {
    itemName: "Fonun Yatırım Amacı veya Stratejisi  ",
    itemKey: "kpy81_acc1_amac_strateji",
    value: riskDegeriValues.map((r, i) => ({
      fonunYatirimAmaci: `$2${String.fromCharCode(97 + i)}`,
      ...(r !== null ? { riskDegeri: r } : {}),
    })),
  };
}

describe("decodeNextRscChunks + extractFundDetailArray — RSC akışı ayrıştırma", () => {
  it("self.__next_f.push parçalarını birleştirip fundDetail dizisini bulur", () => {
    const part1 = JSON.stringify('{"a":1,"fundDetail":[{"itemName":"X",');
    const part2 = JSON.stringify('"value":"1"}]}');
    const html = `<script>self.__next_f.push([1, ${part1}])</script><script>self.__next_f.push([1, ${part2}])</script>`;
    const decoded = decodeNextRscChunks(html);
    const arr = extractFundDetailArray(decoded);
    expect(arr).toEqual([{ itemName: "X", value: "1" }]);
  });

  it("fundDetail bulunamazsa null döner (uydurma yapmaz)", () => {
    const decoded = decodeNextRscChunks("<script>self.__next_f.push([1, " + JSON.stringify('{"noMatch":true}') + "])</script>");
    expect(extractFundDetailArray(decoded)).toBeNull();
  });
});

describe("extractRiskFromFundDetail — üst düzey şema (emeklilik fonu örnekleri)", () => {
  it("kullanıcının risk=7 örnek sayfasından doğru değeri çıkarır", () => {
    const result = extractRiskFromFundDetail(RISK7_ITEMS, "TRY");
    expect(result.status).toBe("found");
    expect(result.riskValue).toBe(7);
    expect(result.sourceDetail).toBe("kap_top_level_risk_value");
  });

  it("kullanıcının risk=2 örnek sayfasından doğru değeri çıkarır", () => {
    const result = extractRiskFromFundDetail(RISK2_ITEMS, "TRY");
    expect(result.status).toBe("found");
    expect(result.riskValue).toBe(2);
  });

  it("Risk Değeri ile Risk Aralığı çelişkiliyse (ör. aralık 1-2 ama değer 6) hiçbirini kullanmaz", () => {
    const items: KapFundDetailItem[] = [
      { itemName: "Fonun Risk Aralığı", value: "Muhafazakar/Temkinli (1-2)" },
      { itemName: "Fonun Risk Değeri", value: "6" },
    ];
    const result = extractRiskFromFundDetail(items, "TRY");
    expect(result.status).toBe("ambiguous");
    expect(result.riskValue).toBeNull();
    expect(result.note).toMatch(/Çelişkili/);
  });

  it("Risk Değeri 1-7 dışındaysa (bozuk veri) ambiguous döner, uydurmaz", () => {
    const items: KapFundDetailItem[] = [{ itemName: "Fonun Risk Değeri", value: "9" }];
    const result = extractRiskFromFundDetail(items, "TRY");
    expect(result.status).toBe("ambiguous");
    expect(result.riskValue).toBeNull();
  });
});

describe("extractRiskFromFundDetail — katılım fonu şeması (gerçek gözlemlenen desenler)", () => {
  it("BKY/PKT/AIS gibi risk alanı hiç olmayan fonlarda no_risk_field döner (uydurmaz)", () => {
    const items: KapFundDetailItem[] = [
      {
        itemName: "Fonun Yatırım Amacı veya Stratejisi  ",
        value: [{ fonunYatirimAmaci: "Kurucu, fonun katılma payı sahiplerinin haklarını koruyacak şekilde..." }],
      },
    ];
    const result = extractRiskFromFundDetail(items, "USD");
    expect(result.status).toBe("no_risk_field");
    expect(result.riskValue).toBeNull();
  });

  it("BKY gerçek verisi: 'TL : 6 ' / 'USD:3' — fon USD ise 3 seçilir (TL değil)", () => {
    const items = [strategyItem(["TL : 6 ", "USD:3"])];
    const result = extractRiskFromFundDetail(items, "USD");
    expect(result.status).toBe("found");
    expect(result.riskValue).toBe(3);
    expect(result.sourceDetail).toBe("kap_currency_group_usd");
  });

  it("aynı veri fon TRY ise 6 seçilir (USD değil)", () => {
    const items = [strategyItem(["TL:6", "USD:3"])];
    const result = extractRiskFromFundDetail(items, "TRY");
    expect(result.riskValue).toBe(6);
  });

  it("aynı veri fon EUR ise (hiçbir grup eşleşmiyor) ambiguous döner", () => {
    const items = [strategyItem(["TL:6", "USD:3"])];
    const result = extractRiskFromFundDetail(items, "EUR");
    expect(result.status).toBe("ambiguous");
    expect(result.riskValue).toBeNull();
  });

  it("HML deseni: tek metinde iki para birimi etiketli değer — '(TL) Paylar: 6 (USD) Paylar: 3'", () => {
    const items = [strategyItem(["(TL) Paylar: 6 (USD) Paylar: 3"])];
    expect(extractRiskFromFundDetail(items, "USD").riskValue).toBe(3);
    expect(extractRiskFromFundDetail(items, "TRY").riskValue).toBe(6);
  });

  it("KDT deseni: yalnızca harf grubu (A/B), para birimi YOK — ambiguous, tahmin etmez", () => {
    const items = [strategyItem(["A grubu paylar için 5", "B grubu paylar için 3"])];
    const result = extractRiskFromFundDetail(items, "USD");
    expect(result.status).toBe("ambiguous");
    expect(result.riskValue).toBeNull();
    expect(result.note).toMatch(/para birimi etiketi taşımıyor/);
  });

  it("NME/NZU deseni: tekrarlanan (3x) aynı harf-grubu metni tekilleştirilir, yine de ambiguous kalır", () => {
    const items = [strategyItem(["A Grubu:6 / B Grubu:2", "A Grubu:6 / B Grubu:2", "A Grubu:6 / B Grubu:2"])];
    const result = extractRiskFromFundDetail(items, "USD");
    expect(result.status).toBe("ambiguous");
  });

  it("ZK1 deseni: etiketsiz değer + açıkça USD etiketli değer — fon USD ise etiketli değer seçilir", () => {
    const items = [strategyItem(["6", "B Grubu Paylar (USD) Risk Değeri: 1"])];
    const result = extractRiskFromFundDetail(items, "USD");
    expect(result.status).toBe("found");
    expect(result.riskValue).toBe(1);
  });

  it("ZK1 deseni: fon TRY ise etiketsiz (örtük TL) değer seçilir", () => {
    const items = [strategyItem(["6", "B Grubu Paylar (USD) Risk Değeri: 1"])];
    const result = extractRiskFromFundDetail(items, "TRY");
    expect(result.riskValue).toBe(6);
  });

  it("ZK1 deseni: fon EUR ise (ne örtük TL ne açık USD eşleşir) ambiguous döner", () => {
    const items = [strategyItem(["6", "B Grubu Paylar (USD) Risk Değeri: 1"])];
    const result = extractRiskFromFundDetail(items, "EUR");
    expect(result.status).toBe("ambiguous");
  });

  it("ELZ deseni: tam cümle içindeki tek değeri doğru ayrıştırır", () => {
    const items = [strategyItem(["Fonun risk değeri 6 olarak belirlenmiştir"])];
    const result = extractRiskFromFundDetail(items, "TRY");
    expect(result.status).toBe("found");
    expect(result.riskValue).toBe(6);
    expect(result.sourceDetail).toBe("kap_single_value");
  });

  it("OTK deseni: risk metni var ama sayısal değere ayrışmıyor (kaldıraç/VaR paragrafı) — %25'i risk sanıp uydurmaz", () => {
    const items = [
      strategyItem([
        "Kaldıraç yaratan işlemlerden kaynaklanan riskin ölçümünde Rehber'de belirlenen esaslar çerçevesinde Mutlak RMD yöntemi kullanılacaktır. Fonun mutlak riske maruz değeri fon toplam değerinin %25'ini aşamaz.",
      ]),
    ];
    const result = extractRiskFromFundDetail(items, "TRY");
    expect(result.status).toBe("ambiguous");
    expect(result.riskValue).toBeNull();
  });

  it("saf fonksiyon: aynı girdiyle her zaman aynı sonucu üretir (idempotent)", () => {
    const items = [strategyItem(["TL:6", "USD:3"])];
    const r1 = extractRiskFromFundDetail(items, "USD");
    const r2 = extractRiskFromFundDetail(items, "USD");
    expect(r1).toEqual(r2);
  });
});

describe("founderMatches — yanlış fon eşleştirmesini önleme", () => {
  it("aynı kurucu şirketin farklı yazımlarını (bizim kısaltılmış vs KAP'ın tam unvanı) eşleştirir", () => {
    expect(founderMatches("Yapı Kredi Portföy", "YAPI KREDİ PORTFÖY YÖNETİMİ A.Ş.")).toBe(true);
  });

  it("tamamen farklı kurucu şirketleri EŞLEŞTİRMEZ (yanlış fon koruması)", () => {
    expect(founderMatches("Ziraat Portföy", "GARANTİ PORTFÖY YÖNETİMİ A.Ş.")).toBe(false);
  });

  it("yalnızca jenerik kelimelerin (PORTFÖY, A.Ş., YÖNETİMİ) örtüşmesiyle YANLIŞLIKLA eşleşmez", () => {
    expect(founderMatches("Astra Portföy", "Deniz Portföy Yönetimi A.Ş.")).toBe(false);
  });

  it("kısa marka isimlerini (2 karakter, ör. İş Portföy) YANLIŞLIKLA jenerik gürültü sayıp reddetmez (canlıda CKS ile bulunan gerçek hata)", () => {
    expect(founderMatches("İş Portföy", "İŞ PORTFÖY YÖNETİMİ A.Ş.")).toBe(true);
  });

  it("tek harfli gerçek marka isimlerini (ör. V Portföy) reddetmez ama 'A.Ş.' kalıntı harflerini ('A'/'Ş') jenerik sayar (canlıda VFO/VHK/VTL ile bulunan gerçek hata)", () => {
    expect(founderMatches("V Portföy", "V PORTFÖY YÖNETİMİ A.Ş.")).toBe(true);
    // "A.Ş." kalıntısı tek başına ASLA eşleşme sağlamamalı — neredeyse her
    // şirket "A.Ş."dir, bu yanlış pozitif üretirdi.
    expect(founderMatches("Zeytin Portföy A.Ş.", "Deniz Portföy Yönetimi A.Ş.")).toBe(false);
  });

  it("bilgi eksikse (null) eşleşme iddia etmez", () => {
    expect(founderMatches(null, "YAPI KREDİ PORTFÖY YÖNETİMİ A.Ş.")).toBe(false);
    expect(founderMatches("Yapı Kredi Portföy", null)).toBe(false);
  });
});
