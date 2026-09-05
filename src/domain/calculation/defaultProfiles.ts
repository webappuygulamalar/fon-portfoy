import type { RiskProfileKey } from "../../lib/constants";
import type { AllocationInput } from "./types";

export interface DefaultProfileDefinition {
  key: RiskProfileKey;
  name: string;
  description: string;
  sortOrder: number;
  allocations: AllocationInput[];
}

/**
 * Başlangıç risk profilleri ve model dağılımları. Bu değerler admin
 * panelinden yeni bir model versiyonu olarak düzenlenip yayınlanabilir;
 * burası yalnızca ilk kurulum (seed) referansıdır ve testlerde toplamın
 * %100 olduğunu doğrulamak için kullanılır.
 */
export const DEFAULT_PROFILES: DefaultProfileDefinition[] = [
  {
    key: "dusuk_1",
    name: "Düşük 1",
    description:
      "Ana para istikrarını önceliklendiren, mevduat ağırlıklı düşük riskli model.",
    sortOrder: 1,
    allocations: [
      { assetClass: "DEPOSIT", percentage: 85 },
      { assetClass: "MONEY_MARKET", percentage: 7 },
      { assetClass: "BIST_EQUITY", percentage: 3 },
      { assetClass: "GOLD", percentage: 3 },
      { assetClass: "FX", percentage: 2 },
    ],
  },
  {
    key: "dusuk_2",
    name: "Düşük 2",
    description:
      "Düşük 1 ile aynı fonları kullanan, biraz daha fazla çeşitlendirme içeren düşük riskli model.",
    sortOrder: 2,
    allocations: [
      { assetClass: "DEPOSIT", percentage: 80 },
      { assetClass: "MONEY_MARKET", percentage: 9 },
      { assetClass: "BIST_EQUITY", percentage: 4 },
      { assetClass: "GOLD", percentage: 4 },
      { assetClass: "FX", percentage: 3 },
    ],
  },
  {
    key: "orta",
    name: "Orta",
    description: "Mevduat ve fon dağılımını dengeleyen orta riskli model.",
    sortOrder: 3,
    allocations: [
      { assetClass: "DEPOSIT", percentage: 50 },
      { assetClass: "MONEY_MARKET", percentage: 10 },
      { assetClass: "BIST_EQUITY", percentage: 20 },
      { assetClass: "GOLD", percentage: 10 },
      { assetClass: "FX", percentage: 10 },
    ],
  },
  {
    key: "yuksek",
    name: "Yüksek",
    description: "BIST katılım hisse fonu ağırlıklı, yüksek riskli model.",
    sortOrder: 4,
    allocations: [
      { assetClass: "DEPOSIT", percentage: 15 },
      { assetClass: "MONEY_MARKET", percentage: 5 },
      { assetClass: "BIST_EQUITY", percentage: 65 },
      { assetClass: "GOLD", percentage: 10 },
      { assetClass: "FX", percentage: 5 },
    ],
  },
];
