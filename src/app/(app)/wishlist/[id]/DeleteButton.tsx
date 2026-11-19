"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    if (!confirm(`Remove “${name}” from your wishlist? Any share links containing it will stop showing it.`)) return;
    setBusy(true);
    const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      return setError("Couldn't delete. Try again.");
    }
    router.push("/wishlist");
    router.refresh();
  }

  return (
    <>
      <button className="btn-danger" onClick={del} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
      {error && <span role="alert" className="self-center text-sm text-red-700">{error}</span>}
    </>
  );
}
