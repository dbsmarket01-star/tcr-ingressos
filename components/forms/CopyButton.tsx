"use client";

import { useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyButton({
  value,
  label = "Copiar",
  copiedLabel = "Copiado",
  className = "secondaryButton"
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className={className}
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
