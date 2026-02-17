import { FeaturedCategories } from "@/components/home/featured-categories";
import { FeaturedProducts } from "@/components/home/featured-products";
import { HomeHero } from "@/components/home/hero";
import { TrustBadges } from "@/components/home/trust-badges";
import { getCategories, getProducts } from "@/lib/api";

export default async function Home() {
  const [productsResponse, categoriesResponse] = await Promise.all([
    getProducts({ limit: 8 }),
    getCategories(),
  ]);

  return (
    <main className="min-h-screen">
      <HomeHero />
      <FeaturedCategories categories={categoriesResponse.items} />
      <FeaturedProducts products={productsResponse.items} />
      <TrustBadges />
    </main>
  );
}
