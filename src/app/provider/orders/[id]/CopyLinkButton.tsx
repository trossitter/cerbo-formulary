"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="btn-secondary px-4 py-2 text-sm"
    >
      {copied ? (
        <Check size={16} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <Copy size={16} strokeWidth={2.4} aria-hidden="true" />
      )}
      {copied ? "Copied!" : "Copy payment link"}
    </button>
  );
}
