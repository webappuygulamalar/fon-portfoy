import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FundAssetClass } from "../domain/calculation/types";

const STORAGE_KEY = "fonPortfoy.calculatorSelection.v1";

interface StoredState {
  totalAmountInput: string;
  selectedProfileId: string;
  overrides: Partial<Record<FundAssetClass, string>>;
}

const EMPTY_STATE: StoredState = { totalAmountInput: "", selectedProfileId: "", overrides: {} };

function loadStored(): StoredState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      totalAmountInput: typeof parsed.totalAmountInput === "string" ? parsed.totalAmountInput : "",
      selectedProfileId: typeof parsed.selectedProfileId === "string" ? parsed.selectedProfileId : "",
      overrides:
        parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

interface CalculatorSelectionContextValue {
  totalAmountInput: string;
  setTotalAmountInput: (value: string) => void;
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  overrides: Partial<Record<FundAssetClass, string>>;
  setOverride: (assetClass: FundAssetClass, fundId: string | null) => void;
  resetOverrides: () => void;
}

const CalculatorSelectionContext = createContext<CalculatorSelectionContextValue | null>(null);

/**
 * Hesaplama girdilerini (tutar, risk profili, fon değişim override'ları)
 * sekme oturumu boyunca (sessionStorage) saklar. Böylece kullanıcı ayrı fon
 * seçim sayfasına gidip geri döndüğünde girdiği tutar ve profil kaybolmaz.
 * Veritabanına HİÇBİR ŞEY yazılmaz — bu, tamamen tarayıcı oturumuna özel bir
 * gösterim tercihidir.
 */
export function CalculatorSelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(() => loadStored());

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage kullanılamıyorsa (ör. gizli sekme kısıtlaması)
      // sessizce yoksayılır; seçim yalnızca bellekte kalır.
    }
  }, [state]);

  const value = useMemo<CalculatorSelectionContextValue>(
    () => ({
      totalAmountInput: state.totalAmountInput,
      setTotalAmountInput: (totalAmountInput) =>
        setState((prev) => ({ ...prev, totalAmountInput })),
      selectedProfileId: state.selectedProfileId,
      setSelectedProfileId: (selectedProfileId) =>
        setState((prev) => ({ ...prev, selectedProfileId, overrides: {} })),
      overrides: state.overrides,
      setOverride: (assetClass, fundId) =>
        setState((prev) => {
          const next = { ...prev.overrides };
          if (fundId) next[assetClass] = fundId;
          else delete next[assetClass];
          return { ...prev, overrides: next };
        }),
      resetOverrides: () => setState((prev) => ({ ...prev, overrides: {} })),
    }),
    [state],
  );

  return (
    <CalculatorSelectionContext.Provider value={value}>{children}</CalculatorSelectionContext.Provider>
  );
}

export function useCalculatorSelection(): CalculatorSelectionContextValue {
  const ctx = useContext(CalculatorSelectionContext);
  if (!ctx) {
    throw new Error("useCalculatorSelection, CalculatorSelectionProvider içinde kullanılmalı");
  }
  return ctx;
}
