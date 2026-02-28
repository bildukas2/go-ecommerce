"use client";

/**
 * Theme Demo Page — user-owned safe zone.
 *
 * This file lives in web/theme/overrides/components/ — it will never be
 * touched by upstream. Edit freely to showcase or test your theme.
 *
 * Demonstrates:
 *  - brand tokens  (web/theme/brand.ts)
 *  - ui() resolver (web/core/ui.tsx)
 *  - Slot system   (web/plugins/slots.tsx)
 */

import React from "react";
import Image from "next/image";
import { brand } from "@/theme/brand";
import { Slot, SLOTS } from "@/plugins/slots";

// ─── Section: Hero ────────────────────────────────────────────────────────────

function DemoHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 px-6 py-24 text-white">
      {/* Glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #0072f5 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-5xl">
        {/* Badge */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Theme Override System · Live Demo
        </span>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
          {/* Left: copy */}
          <div>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              <span className="text-white">{brand.name}</span>
              <br />
              <span
                className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent"
              >
                Theme System
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-neutral-400">
              Override any core component. Inject UI via plugin slots. Keep
              upgrades conflict-free — all from your own safe zone.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Browse Products
              </a>
              <a
                href="https://github.com/bildukas2/go-ecommerce"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                GitHub ↗
              </a>
            </div>

            {/* Slot injection demo */}
            <div className="mt-6 flex items-center gap-2">
              <span className="text-xs text-neutral-500">Slot: layout.header.actions →</span>
              <Slot name={SLOTS.LAYOUT_HEADER_ACTIONS} />
            </div>
          </div>

          {/* Right: logo card */}
          <div className="relative flex items-center justify-center">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,114,245,0.08) 0%, rgba(124,58,237,0.08) 100%)",
                }}
              />
              <Image
                src="/img/Volm logo small.png"
                alt={brand.name}
                width={280}
                height={280}
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

// ─── Section: Feature cards ────────────────────────────────────────────────────

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
}

const features: FeatureCard[] = [
  {
    icon: "🎨",
    title: "brand.ts",
    description:
      "One file to rule all tokens — name, logo, primary & secondary colors. Never conflicts with upstream.",
    tag: "web/theme/brand.ts",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    icon: "🔀",
    title: "ui() resolver",
    description:
      "Drop a file in theme/overrides/components/ and export it with the stable name. The resolver picks it up automatically.",
    tag: "web/core/ui.tsx",
    tagColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
  {
    icon: "🧩",
    title: "Plugin Slots",
    description:
      "Named injection points — header actions, product sidebar, checkout steps. Plugins register components, slots render them.",
    tag: "web/plugins/slots.tsx",
    tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
];

function FeatureCards() {
  return (
    <section className="bg-neutral-950 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
          How it works
        </h2>
        <p className="mb-10 text-center text-2xl font-bold text-white">
          Three primitives, zero lock-in
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-6 transition hover:border-white/15 hover:bg-white/5"
            >
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="mb-2 text-base font-semibold text-white">{f.title}</h3>
              <p className="mb-4 text-sm leading-relaxed text-neutral-400">{f.description}</p>
              <span
                className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] ${f.tagColor}`}
              >
                {f.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Code snippets ────────────────────────────────────────────────────

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-neutral-900">
      <div className="border-b border-white/8 px-4 py-2">
        <span className="font-mono text-xs text-neutral-500">{label}</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-sm leading-relaxed text-neutral-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const snippets = [
  {
    label: "1. Edit your brand tokens",
    code: `// web/theme/brand.ts
export const brand = {
  name: "VOLM",
  logo: "/img/Volm logo small.png",
  colors: {
    primary: "#0072f5",
    secondary: "#7c3aed",
  },
} as const;`,
  },
  {
    label: "2. Override a core component",
    code: `// web/theme/overrides/components/MyHeader.tsx
export function MyHeader(props) {
  return <header>My custom header</header>;
}

// web/theme/overrides/components/index.ts
export { MyHeader as StorefrontHeader } from "./MyHeader";`,
  },
  {
    label: "3. Register a plugin",
    code: `// web/plugins/enabled.ts
import { myPlugin } from "./_examples/my-plugin";
export const enabledPlugins = [myPlugin];

// web/plugins/_examples/my-plugin/index.tsx
export const myPlugin: Plugin = {
  id: "my-plugin",
  slots: {
    [SLOTS.LAYOUT_HEADER_ACTIONS]: [MyBadge],
  },
};`,
  },
];

function HowToSection() {
  return (
    <section className="bg-neutral-950 px-6 pb-20 pt-4">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Quick start
        </h2>
        <p className="mb-10 text-center text-2xl font-bold text-white">
          Customize in minutes
        </p>

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          {snippets.map((s) => (
            <CodeBlock key={s.label} label={s.label} code={s.code} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Slot inventory ────────────────────────────────────────────────────

const slotList = [
  {
    name: SLOTS.LAYOUT_HEADER_ACTIONS,
    where: "storefront-header.tsx",
    status: "wired",
  },
  {
    name: SLOTS.PRODUCT_PAGE_SIDEBAR,
    where: "products/[slug]/page.tsx",
    status: "available",
  },
  {
    name: SLOTS.CHECKOUT_STEPS,
    where: "checkout/page.tsx",
    status: "available",
  },
];

function SlotInventory() {
  return (
    <section className="border-t border-white/8 bg-neutral-950 px-6 pb-20 pt-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Injection points
        </h2>
        <p className="mb-10 text-center text-2xl font-bold text-white">
          Available slots
        </p>

        <div className="overflow-hidden rounded-2xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="px-5 py-3 text-left font-medium text-neutral-400">Slot name</th>
                <th className="px-5 py-3 text-left font-medium text-neutral-400">Component</th>
                <th className="px-5 py-3 text-left font-medium text-neutral-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {slotList.map((s, i) => (
                <tr
                  key={s.name}
                  className={i < slotList.length - 1 ? "border-b border-white/5" : ""}
                >
                  <td className="px-5 py-4 font-mono text-xs text-blue-400">{s.name}</td>
                  <td className="px-5 py-4 font-mono text-xs text-neutral-400">{s.where}</td>
                  <td className="px-5 py-4">
                    {s.status === "wired" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                        <span className="h-1 w-1 rounded-full bg-emerald-400" />
                        Wired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-500/20 bg-neutral-500/10 px-2 py-0.5 text-xs text-neutral-400">
                        <span className="h-1 w-1 rounded-full bg-neutral-400" />
                        Available
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── Footer CTA ────────────────────────────────────────────────────────────────

function DemoCta() {
  return (
    <section className="border-t border-white/8 bg-neutral-950 px-6 pb-24 pt-20 text-center">
      <div className="mx-auto max-w-xl">
        <Image
          src="/img/Volm logo small.png"
          alt={brand.name}
          width={64}
          height={64}
          className="mx-auto mb-6 opacity-80"
        />
        <h2 className="mb-3 text-3xl font-bold text-white">
          Ready to customize?
        </h2>
        <p className="mb-8 text-neutral-400">
          Start in <code className="rounded bg-white/8 px-1 py-0.5 text-sm text-blue-400">web/theme/brand.ts</code>.
          Everything else follows.
        </p>
        <a
          href="/products"
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Go to storefront →
        </a>
      </div>
    </section>
  );
}

// ─── Page assembly ─────────────────────────────────────────────────────────────

export function ThemeDemoPage() {
  return (
    <div className="min-h-screen">
      <DemoHero />
      <FeatureCards />
      <HowToSection />
      <SlotInventory />
      <DemoCta />
    </div>
  );
}
