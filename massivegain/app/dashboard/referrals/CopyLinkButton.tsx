"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fail quietly.
    }
  }

  return (
    <Button variant="outline" onClick={handleCopy} className="shrink-0">
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}
