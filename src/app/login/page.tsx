import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-6 py-12 md:grid-cols-2">
      <section>
        <p className="font-display text-4xl tracking-tight">Wishly</p>
        <h1 className="mt-6 font-display text-3xl leading-tight md:text-4xl">
          Found a bag you love? Find the ones like it.
        </h1>
        <p className="mt-4 text-ink/70">
          Save handbags from any retailer, tell us what&apos;s non-negotiable, and see the closest alternatives,
          with a plain-English reason for every pick.
        </p>
      </section>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
