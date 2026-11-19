"use client";

import { ProductForm, type FormValues } from "@/components/ProductForm";

export function EditForm({ id, initial }: { id: string; initial: FormValues }) {
  return <ProductForm initial={initial} itemId={id} submitLabel="Save changes" />;
}
