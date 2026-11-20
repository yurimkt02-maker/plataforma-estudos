"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ReadingFontFamily = "serif" | "sans";
export type ReadingFontSize = "sm" | "md" | "lg" | "xl";
export type ReadingLineHeight = "normal" | "relaxed" | "loose";
export type ReadingMaxWidth = "narrow" | "standard" | "wide";

export type ReadingPreferences = {
  fontFamily: ReadingFontFamily;
  fontSize: ReadingFontSize;
  lineHeight: ReadingLineHeight;
  maxWidth: ReadingMaxWidth;
};

const STORAGE_KEY = "pe_reading_prefs";

export const DEFAULT_READING_PREFS: ReadingPreferences = {
  fontFamily: "serif",
  fontSize: "md",
  lineHeight: "relaxed",
  maxWidth: "standard",
};

type ReadingPrefsContextValue = {
  prefs: ReadingPreferences;
  updatePrefs: (partial: Partial<ReadingPreferences>) => void;
  resetPrefs: () => void;
  /** Classes utilitárias prontas para o container de leitura do Modo Foco */
  readingClasses: {
    fontClass: string;
    sizeClass: string;
    leadingClass: string;
    widthClass: string;
  };
};

const ReadingPrefsContext = createContext<ReadingPrefsContextValue | null>(null);

const SIZE_MAP: Record<ReadingFontSize, string> = {
  sm: "text-[14.5px] sm:text-[15.5px]",
  md: "text-[15.5px] sm:text-[17px]",
  lg: "text-[17px] sm:text-[18.5px]",
  xl: "text-[18.5px] sm:text-[20px]",
};

const LEADING_MAP: Record<ReadingLineHeight, string> = {
  normal: "leading-[1.58]",
  relaxed: "leading-[1.68] sm:leading-[1.74]",
  loose: "leading-[1.82] sm:leading-[1.88]",
};

const WIDTH_MAP: Record<ReadingMaxWidth, string> = {
  narrow: "max-w-[64ch]",
  standard: "max-w-[70ch]",
  wide: "max-w-[80ch]",
};

export function ReadingPrefsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<ReadingPreferences>(DEFAULT_READING_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReadingPreferences>;
        setPrefs({
          fontFamily:
            parsed.fontFamily === "sans" || parsed.fontFamily === "serif"
              ? parsed.fontFamily
              : DEFAULT_READING_PREFS.fontFamily,
          fontSize:
            parsed.fontSize && parsed.fontSize in SIZE_MAP
              ? parsed.fontSize
              : DEFAULT_READING_PREFS.fontSize,
          lineHeight:
            parsed.lineHeight && parsed.lineHeight in LEADING_MAP
              ? parsed.lineHeight
              : DEFAULT_READING_PREFS.lineHeight,
          maxWidth:
            parsed.maxWidth && parsed.maxWidth in WIDTH_MAP
              ? parsed.maxWidth
              : DEFAULT_READING_PREFS.maxWidth,
        });
      }
    } catch {
      // Ignora JSON inválido no storage
    }
  }, []);

  const updatePrefs = useCallback((partial: Partial<ReadingPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // noop
      }
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_READING_PREFS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
  }, []);

  const value = useMemo<ReadingPrefsContextValue>(
    () => ({
      prefs,
      updatePrefs,
      resetPrefs,
      readingClasses: {
        fontClass: prefs.fontFamily === "serif" ? "font-reading" : "font-sans",
        sizeClass: SIZE_MAP[prefs.fontSize],
        leadingClass: LEADING_MAP[prefs.lineHeight],
        widthClass: WIDTH_MAP[prefs.maxWidth],
      },
    }),
    [prefs, updatePrefs, resetPrefs]
  );

  return (
    <ReadingPrefsContext.Provider value={value}>
      {children}
    </ReadingPrefsContext.Provider>
  );
}

export function useReadingPrefs(): ReadingPrefsContextValue {
  const ctx = useContext(ReadingPrefsContext);
  if (!ctx) {
    throw new Error(
      "useReadingPrefs deve ser usado dentro de <ReadingPrefsProvider>."
    );
  }
  return ctx;
}
