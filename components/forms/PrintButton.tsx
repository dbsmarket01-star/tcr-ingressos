"use client";

type PrintButtonProps = {
  label?: string;
  className?: string;
};

export function PrintButton({ label = "Imprimir", className = "secondaryButton" }: PrintButtonProps) {
  return (
    <button className={className} type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
