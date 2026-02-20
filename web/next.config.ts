import type { NextConfig } from "next";
import path from "path";

function buildRemotePatterns() {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    {
      protocol: "https",
      hostname: "img.favpng.com",
    },
    {
      protocol: "https",
      hostname: "png.pngtree.com",
    },
    {
      protocol: "https",
      hostname: "images.example.com",
    },
  ];

  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return patterns;
  }

  try {
    const parsed = new URL(backendUrl);
    patterns.push({
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
    });
  } catch {
    // Ignore invalid env value and keep static allowlist only.
  }

  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildRemotePatterns(),
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
