/**
 * Runs the REAL migrations + seed in an in-process Postgres (PGlite) with Supabase-style roles
 * (anon / authenticated / service_role) and an auth.uid() shim, then checks RLS isolation,
 * the atomic quota function, and the shared-wishlist access path.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const sql = (f: string) => readFileSync(path.resolve(__dirname, "../supabase", f), "utf8");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOKEN_HASH = "h".repeat(64);

let db: PGlite;

async function as<T>(role: "anon" | "authenticated" | "service_role", uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const q = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows as Record<string, unknown>[];
const fails = async (text: string, params: unknown[] = []) => {
  try {
    await db.query(text, params);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};

let itemA1: string;
let itemA2: string;
let shareId: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on auth.users to authenticated, service_role;
    -- Supabase grants table privileges to these roles by default; RLS + our revokes do the real work.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  await db.exec(sql("migrations/20260101000000_schema.sql"));
  await db.exec(sql("migrations/20260101000100_rls_and_functions.sql"));
  await db.exec(sql("seed.sql"));
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');`);
}, 60_000);

describe("schema, seed, profiles", () => {
  it("seeds the catalog reproducibly (idempotent)", async () => {
    expect((await q("select count(*)::int c from catalog_products"))[0].c).toBe(44);
    await db.exec(sql("seed.sql"));
    expect((await q("select count(*)::int c from catalog_products"))[0].c).toBe(44);
  });
  it("creates a profile on sign-up", async () => {
    expect((await q("select display_name from profiles where id = $1", [A]))[0].display_name).toBe("a");
  });
});

describe("RLS: user isolation", () => {
  it("lets users create and read only their own wishlist items", async () => {
    await as("authenticated", A, async () => {
      itemA1 = (await q(`insert into wishlist_items (user_id, product_name, color) values ('${A}', 'A bag one', 'Black') returning id`))[0].id as string;
      itemA2 = (await q(`insert into wishlist_items (user_id, product_name) values ('${A}', 'A bag two (private)') returning id`))[0].id as string;
      expect(await q("select id from wishlist_items")).toHaveLength(2);
    });
    await as("authenticated", B, async () => {
      expect(await q("select id from wishlist_items")).toHaveLength(0);
      expect(await q("update wishlist_items set product_name = 'hacked' where id = $1 returning id", [itemA1])).toHaveLength(0);
      expect(await q("delete from wishlist_items where id = $1 returning id", [itemA1])).toHaveLength(0);
      expect(await fails(`insert into wishlist_items (user_id, product_name) values ('${A}', 'spoof')`)).toMatch(/row-level security/);
    });
    expect((await q("select product_name from wishlist_items where id = $1", [itemA1]))[0].product_name).toBe("A bag one");
  });

  it("denies signed-out (anon) access to private tables", async () => {
    await as("anon", null, async () => {
      expect(await q("select id from wishlist_items")).toHaveLength(0);
      for (const t of ["recommendation_searches", "recommendation_results", "recommendation_feedback", "shared_wishlists", "shared_wishlist_items", "profiles"])
        expect(await q(`select 1 from ${t}`), t).toHaveLength(0);
      expect(await fails("select 1 from catalog_products")).toMatch(/permission denied/);
      expect(await fails(`insert into wishlist_items (user_id, product_name) values ('${A}', 'anon spoof')`)).toMatch(/row-level security/);
    });
  });

  it("isolates recommendation searches, results and feedback", async () => {
    let resultId = "";
    await as("authenticated", A, async () => {
      const s = (await q(`insert into recommendation_searches (user_id, wishlist_item_id, source, preferences) values ('${A}', '${itemA1}', 'catalog', '{}') returning id`))[0].id as string;
      resultId = (await q("insert into recommendation_results (search_id, product_data, similarity_score) values ($1, '{}', 80.5) returning id", [s]))[0].id as string;
      await q(`insert into recommendation_feedback (user_id, recommendation_result_id, feedback_type) values ('${A}', $1, 'helpful')`, [resultId]);
    });
    await as("authenticated", B, async () => {
      expect(await q("select id from recommendation_searches")).toHaveLength(0);
      expect(await q("select id from recommendation_results")).toHaveLength(0);
      expect(await q("select id from recommendation_feedback")).toHaveLength(0);
      expect(await fails(`insert into recommendation_feedback (user_id, recommendation_result_id, feedback_type) values ('${B}', $1, 'helpful')`, [resultId])).toMatch(/row-level security/);
      expect(await fails(`insert into recommendation_searches (user_id, wishlist_item_id, source, preferences) values ('${B}', '${itemA1}', 'catalog', '{}')`)).toMatch(/row-level security/);
    });
  });

  it("makes the catalog read-only for users", async () => {
    await as("authenticated", A, async () => {
      expect((await q("select count(*)::int c from catalog_products"))[0].c).toBe(44);
      expect(await fails("insert into catalog_products (name) values ('x')")).toMatch(/row-level security/);
      expect(await q("update catalog_products set name = 'x' returning id")).toHaveLength(0);
      expect(await q("delete from catalog_products returning id")).toHaveLength(0);
    });
  });
});

describe("SerpAPI quota is server-only and atomic", () => {
  it("is invisible and uncallable for browser roles", async () => {
    for (const [role, uid] of [["authenticated", A], ["anon", null]] as const) {
      await as(role, uid, async () => {
        expect(await fails("select * from serpapi_usage")).toMatch(/permission denied/);
        expect(await fails("select * from serpapi_cache")).toMatch(/permission denied/);
        expect(await fails("select * from reserve_serpapi_search(250)")).toMatch(/permission denied/);
        expect(await fails("select * from get_shared_wishlist('x')")).toMatch(/permission denied/);
      });
    }
  });

  it("grants exactly 250 reservations per month, even under concurrency and with an inflated limit", async () => {
    const results = await as("service_role", null, () =>
      Promise.all(Array.from({ length: 300 }, () => q("select * from reserve_serpapi_search(9999)"))),
    );
    const allowed = results.filter((r) => r[0].allowed).length;
    expect(allowed).toBe(250);
    expect(results.filter((r) => !r[0].allowed)).toHaveLength(50);
    const [row] = await q("select searches_reserved from serpapi_usage");
    expect(row.searches_reserved).toBe(250);
    const after = await as("service_role", null, () => q("select * from reserve_serpapi_search(250)"));
    expect(after[0]).toMatchObject({ allowed: false, used: 250 });
  });

  it("starts a fresh counter in a new (UTC) month", async () => {
    await db.exec("update serpapi_usage set month_start = (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date");
    const r = await as("service_role", null, () => q("select * from reserve_serpapi_search(250)"));
    expect(r[0]).toMatchObject({ allowed: true, used: 1 });
    expect((await q("select count(*)::int c from serpapi_usage"))[0].c).toBe(2);
  });
});

describe("share links", () => {
  it("lets the owner share selected items; visitors get only whitelisted fields of those items", async () => {
    await as("authenticated", A, async () => {
      shareId = (await q(`insert into shared_wishlists (owner_user_id, token_hash) values ('${A}', '${TOKEN_HASH}') returning id`))[0].id as string;
      await q("insert into shared_wishlist_items (shared_wishlist_id, wishlist_item_id) values ($1, $2)", [shareId, itemA1]);
    });
    const rows = await as("service_role", null, () => q("select * from get_shared_wishlist($1)", [TOKEN_HASH]));
    expect(rows).toHaveLength(1);
    expect(rows[0].product_name).toBe("A bag one");
    const keys = Object.keys(rows[0]);
    for (const forbidden of ["id", "user_id", "owner_user_id", "email", "created_at", "wishlist_item_id", "token_hash"])
      expect(keys).not.toContain(forbidden);
    expect(JSON.stringify(rows)).not.toContain("private");
  });

  it("returns nothing for unknown tokens", async () => {
    expect(await as("service_role", null, () => q("select * from get_shared_wishlist('nope')"))).toHaveLength(0);
  });

  it("blocks other users from managing or hijacking the link", async () => {
    await as("authenticated", B, async () => {
      expect(await q("select id from shared_wishlists")).toHaveLength(0);
      expect(await q("update shared_wishlists set revoked_at = now() where id = $1 returning id", [shareId])).toHaveLength(0);
      const mine = (await q(`insert into shared_wishlists (owner_user_id, token_hash) values ('${B}', '${"z".repeat(64)}') returning id`))[0].id as string;
      expect(await fails("insert into shared_wishlist_items (shared_wishlist_id, wishlist_item_id) values ($1, $2)", [mine, itemA2])).toMatch(/row-level security/);
      expect(await fails("insert into shared_wishlist_items (shared_wishlist_id, wishlist_item_id) values ($1, $2)", [shareId, itemA2])).toMatch(/row-level security/);
    });
  });

  it("stops serving the link once revoked, and when the item is deleted", async () => {
    await as("authenticated", A, async () => {
      expect(await q("update shared_wishlists set revoked_at = now() where id = $1 returning id", [shareId])).toHaveLength(1);
    });
    expect(await as("service_role", null, () => q("select * from get_shared_wishlist($1)", [TOKEN_HASH]))).toHaveLength(0);

    await as("authenticated", A, async () => {
      await q("update shared_wishlists set revoked_at = null where id = $1", [shareId]);
      await q("delete from wishlist_items where id = $1", [itemA1]);
    });
    expect(await as("service_role", null, () => q("select * from get_shared_wishlist($1)", [TOKEN_HASH]))).toHaveLength(0);
  });
});
