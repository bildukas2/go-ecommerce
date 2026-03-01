import {
  Rocket,
  Globe,
  ShoppingBag,
  Users,
  Award,
  Zap,
  Star,
  TrendingUp,
} from "lucide-react";

const milestones = [
  {
    year: "2022",
    quarter: "Q1",
    icon: Rocket,
    title: "Launch Day",
    description:
      "Volm goes live with its first storefront, offering a curated selection of home essentials and a checkout experience built for speed.",
    highlight: "Day one",
    color: "bg-violet-100 text-violet-600",
    dotColor: "bg-violet-500",
  },
  {
    year: "2022",
    quarter: "Q3",
    icon: ShoppingBag,
    title: "1,000 Orders Shipped",
    description:
      "Our first major milestone — 1,000 orders successfully delivered to happy customers across the region.",
    highlight: "1,000+ orders",
    color: "bg-blue-100 text-blue-600",
    dotColor: "bg-blue-500",
  },
  {
    year: "2023",
    quarter: "Q1",
    icon: Globe,
    title: "Multi-region Expansion",
    description:
      "Extended shipping coverage to 8 new countries, bringing Volm's fast delivery promise to an international audience.",
    highlight: "8 countries",
    color: "bg-emerald-100 text-emerald-600",
    dotColor: "bg-emerald-500",
  },
  {
    year: "2023",
    quarter: "Q2",
    icon: Users,
    title: "10,000 Registered Customers",
    description:
      "A growing community of loyal shoppers crossed the 10K mark, proving that fast UX and quality products keep people coming back.",
    highlight: "10K customers",
    color: "bg-amber-100 text-amber-600",
    dotColor: "bg-amber-500",
  },
  {
    year: "2023",
    quarter: "Q4",
    icon: Award,
    title: "Best New Commerce Platform",
    description:
      "Recognised by the Open Source Commerce Awards for outstanding UX design and developer experience in the self-hosted category.",
    highlight: "Award winner",
    color: "bg-rose-100 text-rose-600",
    dotColor: "bg-rose-500",
  },
  {
    year: "2024",
    quarter: "Q2",
    icon: Zap,
    title: "Sub-100ms API Response",
    description:
      "After aggressive performance work and Redis caching, 95th-percentile API response times dropped below 100 ms globally.",
    highlight: "< 100 ms p95",
    color: "bg-cyan-100 text-cyan-600",
    dotColor: "bg-cyan-500",
  },
  {
    year: "2024",
    quarter: "Q3",
    icon: Star,
    title: "Open-Source Release",
    description:
      "Volm's core platform is released as open source on GitHub, empowering merchants worldwide to build on a solid, extensible foundation.",
    highlight: "Open source",
    color: "bg-purple-100 text-purple-600",
    dotColor: "bg-purple-500",
  },
  {
    year: "2025",
    quarter: "Q1",
    icon: TrendingUp,
    title: "50,000 Monthly Active Shoppers",
    description:
      "The storefront now serves 50,000 monthly active shoppers, with zero downtime and consistent sub-second page loads.",
    highlight: "50K MAU",
    color: "bg-orange-100 text-orange-600",
    dotColor: "bg-orange-500",
  },
];

export default function MilestonesPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f9]">
      <section className="hero-aurora relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:pt-24">
        <span className="hero-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <Rocket size={11} className="hero-badge-flame" aria-hidden="true" />
          Our journey, milestone by milestone
        </span>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl lg:text-6xl">
          Building{" "}
          <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
            Volm
          </span>
          , one step at a time
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-neutral-500 md:text-lg">
          From a single storefront to a thriving open-source platform — here is
          every significant chapter in Volm's story.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-neutral-900">50K+</span>
            <span>Monthly shoppers</span>
          </div>
          <div className="h-4 w-px bg-neutral-300" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-neutral-900">8</span>
            <span>Countries</span>
          </div>
          <div className="h-4 w-px bg-neutral-300" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-neutral-900">100%</span>
            <span>Open source</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="relative">
          <div className="absolute left-6 top-0 h-full w-px bg-neutral-200 md:left-1/2" />

          <div className="space-y-10">
            {milestones.map((ms, idx) => {
              const Icon = ms.icon;
              const isEven = idx % 2 === 0;

              return (
                <div
                  key={`${ms.year}-${ms.quarter}`}
                  className={`relative flex gap-6 md:gap-0 ${
                    isEven ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  <div
                    className={`hidden md:flex md:w-1/2 ${
                      isEven ? "md:justify-end md:pr-8" : "md:justify-start md:pl-8"
                    }`}
                  >
                    <div className="glass w-full max-w-xs rounded-2xl p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-3">
                        <span className={`rounded-xl p-2 ${ms.color}`}>
                          <Icon size={16} />
                        </span>
                        <div>
                          <p className="text-xs font-medium text-neutral-400">
                            {ms.year} · {ms.quarter}
                          </p>
                          <p className="text-sm font-semibold text-neutral-900">
                            {ms.title}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-neutral-500">
                        {ms.description}
                      </p>
                      <div className="mt-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ms.color}`}
                        >
                          {ms.highlight}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute left-6 flex -translate-x-1/2 items-center justify-center md:relative md:left-auto md:w-0 md:translate-x-0">
                    <div
                      className={`z-10 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-[#f7f7f9] ${ms.dotColor}`}
                    />
                  </div>

                  <div className="glass ml-6 flex-1 rounded-2xl p-5 shadow-sm md:hidden">
                    <div className="mb-3 flex items-center gap-3">
                      <span className={`rounded-xl p-2 ${ms.color}`}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-neutral-400">
                          {ms.year} · {ms.quarter}
                        </p>
                        <p className="text-sm font-semibold text-neutral-900">
                          {ms.title}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-500">
                      {ms.description}
                    </p>
                    <div className="mt-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ms.color}`}
                      >
                        {ms.highlight}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`hidden md:flex md:w-1/2 ${
                      isEven ? "md:pl-8" : "md:justify-end md:pr-8"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
            <Rocket size={22} className="text-violet-600" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">
            The story continues
          </h3>
          <p className="mt-2 text-sm text-neutral-500">
            We are just getting started. Follow our open-source repository to
            stay ahead of every new chapter.
          </p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            Star on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
