/**
 * HomePage override template — user-owned safe zone.
 *
 * HOW TO USE:
 * 1. Copy this file:
 *      cp web/theme/overrides/pages/HomePage.example.tsx \
 *         web/theme/overrides/pages/HomePage.tsx
 *
 * 2. Add to web/theme/overrides/pages/index.ts:
 *      export { default as HomePage } from "./HomePage";
 *
 * 3. Edit freely. Core files untouched.
 */

export default async function HomePage() {
  return (
    <main className="min-h-screen">
      <h1>My custom home page</h1>
      <p>Replace this with your content.</p>
    </main>
  );
}
