export default function Setup() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="font-display text-3xl">Wishly needs a database</h1>
      <p className="mt-3 text-ink/70">
        Supabase isn&apos;t configured yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill in
        <code> NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, run the migrations in{" "}
        <code>supabase/migrations</code> and <code>supabase/seed.sql</code>, then restart the dev server. The README has
        step-by-step instructions.
      </p>
    </main>
  );
}
