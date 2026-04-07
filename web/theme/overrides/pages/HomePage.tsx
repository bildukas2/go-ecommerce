import Image from "next/image";
import Link from "next/link";
import { brand } from "@/theme/brand";

// ─── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-neutral-100 via-white to-neutral-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800 px-6 py-28 text-neutral-900 dark:text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full opacity-10 dark:opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #0072f5 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full opacity-10 dark:opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            100% Open Source · Go + Next.js · Made for Vibers
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            BETA · v0.5.4
          </span>
        </div>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
              <span className="text-neutral-900 dark:text-white">{brand.name}</span>
              <br />
              <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
                Ecommerce
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
              A fast, modern, open-source ecommerce starter. Go API + Next.js storefront.
              Simple to set up. Easy to extend. Built for AI to easy handling.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Browse Products →
              </Link>
              <a
                href="https://github.com/bildukas2/go-ecommerce"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-800 dark:text-white backdrop-blur-sm transition hover:bg-neutral-200 dark:hover:bg-white/10"
              >
                GitHub ↗
              </a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 p-10 shadow-xl dark:shadow-2xl backdrop-blur-md">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(0,114,245,0.06) 0%, rgba(124,58,237,0.06) 100%)",
                }}
              />
              <Image
                src="/img/Volm logo small.png"
                alt={brand.name}
                width={380}
                height={380}
                className="relative drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

const stats = [
  { value: "47+", label: "REST endpoints" },
  { value: "38", label: "DB migrations" },
  { value: "7", label: "Feature modules" },
  { value: "100%", label: "Open Source" },
];

function Stats() {
  return (
    <section className="border-b border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-neutral-900 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">{s.value}</p>
              <p className="mt-1 text-sm text-neutral-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ──────────────────────────────────────────────────────────────────

const features = [
  {
    icon: "⚡",
    title: "Go Backend",
    description: "Chi router, raw database/sql, goose migrations, Redis caching. No ORMs, no bloat. Just fast, idiomatic Go.",
    tag: "Go 1.24 · PostgreSQL 16 · Redis 7",
    tagColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    icon: "🎨",
    title: "Next.js Storefront",
    description: "App Router, React 19, Tailwind 4, shadcn/ui + HeroUI. Server components by default. Feels instant.",
    tag: "Next.js 16 · React 19 · TypeScript",
    tagColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  {
    icon: "🧩",
    title: "Modular Architecture",
    description: "7 feature modules: catalog, cart, checkout, orders, customers, shipping, admin. Plugin-style registration. Add features without touching core.",
    tag: "KISS · Modular Monolith",
    tagColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  {
    icon: "🛒",
    title: "Full Cart & Checkout",
    description: "Cookie-based cart, multi-step checkout, Stripe payments, shipping zones with Omniva integration.",
    tag: "Stripe · Omniva · LP Express",
    tagColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  },
  {
    icon: "🔐",
    title: "Admin Panel",
    description: "Session auth + CSRF + Cloudflare Turnstile captcha. Manage products, orders, customers, CMS pages, email templates.",
    tag: "Secure by default",
    tagColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  {
    icon: "🎭",
    title: "Theme Override System",
    description: "Override any page or component from your safe zone. Never conflicts with upstream updates. Brand tokens in one file.",
    tag: "web/theme/",
    tagColor: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  },
];

function Features() {
  return (
    <section className="bg-white dark:bg-neutral-950 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          What's inside
        </h2>
        <p className="mb-12 text-center text-2xl font-bold text-neutral-900 dark:text-white">
          Everything you need, nothing you don't
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-white/3 p-6 transition hover:border-neutral-300 dark:hover:border-white/15 hover:bg-neutral-100 dark:hover:bg-white/5"
            >
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="mb-2 text-base font-semibold text-neutral-900 dark:text-white">{f.title}</h3>
              <p className="mb-4 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{f.description}</p>
              <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] ${f.tagColor}`}>
                {f.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stack ─────────────────────────────────────────────────────────────────────

const stack = [
  { label: "Go", sub: "1.24" },
  { label: "Next.js", sub: "16" },
  { label: "PostgreSQL", sub: "16" },
  { label: "Redis", sub: "7" },
  { label: "Tailwind", sub: "4" },
  { label: "Docker", sub: "Compose" },
  { label: "Stripe", sub: "Payments" },
  { label: "TypeScript", sub: "5.9" },
];

function Stack() {
  return (
    <section className="border-t border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-neutral-900 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          Tech stack
        </h2>
        <p className="mb-10 text-center text-2xl font-bold text-neutral-900 dark:text-white">
          Boring tech that just works
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {stack.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center rounded-xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 px-5 py-3 text-center transition hover:border-neutral-300 dark:hover:border-white/15"
            >
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">{s.label}</span>
              <span className="mt-0.5 text-xs text-neutral-500">{s.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Quick Start ───────────────────────────────────────────────────────────────

function QuickStart() {
  return (
    <section className="bg-white dark:bg-neutral-950 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          Get started
        </h2>
        <p className="mb-10 text-center text-2xl font-bold text-neutral-900 dark:text-white">
          Up and running in minutes
        </p>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 dark:border-white/8 px-5 py-3">
            <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">terminal</span>
          </div>
          <pre className="overflow-x-auto px-5 py-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            <code>{`# 1. Clone
git clone https://github.com/bildukas2/go-ecommerce
cd go-ecommerce

# 2. Start infrastructure
cp .env.example .env
docker compose up -d

# 3. Run migrations
go run ./cmd/migrate up

# 4. Start API
air

# 5. Start frontend (new terminal)
cd web && pnpm install && pnpm dev`}</code>
          </pre>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <a
            href="https://github.com/bildukas2/go-ecommerce"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            View on GitHub ↗
          </a>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-800 dark:text-white backdrop-blur-sm transition hover:bg-neutral-200 dark:hover:bg-white/10"
          >
            Browse Demo Store
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── CTA ───────────────────────────────────────────────────────────────────────

function Cta() {
  return (
    <section className="border-t border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-neutral-950 px-6 pb-24 pt-20 text-center">
      <div className="mx-auto max-w-xl">
        <Image
          src="/img/Volm logo small.png"
          alt={brand.name}
          width={64}
          height={64}
          className="mx-auto mb-6 opacity-80"
        />
        <h2 className="mb-3 text-3xl font-bold text-neutral-900 dark:text-white">
          Build your store with VOLM
        </h2>
        <p className="mb-8 text-neutral-500 dark:text-neutral-400">
          100% open source. Made for Vibers. Fork it, customize it, ship it.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://github.com/bildukas2/go-ecommerce"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Star on GitHub ↗
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Page assembly ─────────────────────────────────────────────────────────────

export default async function HomePage() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Stats />
      <Features />
      <Stack />
      <QuickStart />
      <Cta />
    </div>
  );
}
