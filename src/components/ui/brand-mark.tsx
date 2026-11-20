import { cn } from "@/lib/utils/cn";

type BrandMarkSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<BrandMarkSize, { box: string; svg: string }> = {
  sm: { box: "w-7 h-7 rounded-md", svg: "w-4 h-4" },
  md: { box: "w-8 h-8 rounded-lg", svg: "w-4 h-4" },
  lg: { box: "w-11 h-11 rounded-xl", svg: "w-6 h-6" },
};

/**
 * Símbolo oficial padronizado da plataforma — mesma geometria em Desktop, Mobile e Login.
 * Geometria: fólio editorial aberto com marca-página de precisão sobre o degradê assinatura (#392C67 → #612C67).
 */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: BrandMarkSize;
  className?: string;
}) {
  const s = SIZE_CLASSES[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center shrink-0 bg-brand-gradient text-white shadow-subtle select-none",
        s.box,
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={s.svg}
      >
        {/* Fólio esquerdo e direito simétricos */}
        <path
          d="M4.5 6.25C4.5 5.56 5.06 5 5.75 5H9.5C10.88 5 12 6.12 12 7.5V18.5C12 17.67 11.33 17 10.5 17H5.75C5.06 17 4.5 16.44 4.5 15.75V6.25Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M19.5 6.25C19.5 5.56 18.94 5 18.25 5H14.5C13.12 5 12 6.12 12 7.5V18.5C12 17.67 12.67 17 13.5 17H18.25C18.94 17 19.5 16.44 19.5 15.75V6.25Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Marcador vertical de precisão no eixo central */}
        <path
          d="M12 18.5V20.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
