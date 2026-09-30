import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()"
  }
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb"
    }
  },
  images: {
    deviceSizes: [430, 640, 750, 828, 1080, 1180, 1600, 1920],
    formats: ["image/avif", "image/webp"],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
    remotePatterns: [
      // Legacy event imports still use these public media origins.
      // Keep their paths restricted instead of allowing arbitrary remote URLs.
      {
        protocol: "https",
        hostname: "www.phsis.com.br",
        port: "",
        pathname: "/files/*/image/**",
        search: ""
      },
      {
        protocol: "https",
        hostname: "eloconferenceglobal.com.br",
        port: "",
        pathname: "/event-maps/**",
        search: ""
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        port: "",
        pathname: "/dbsmarket01-star/tcr-ingressos/main/public/events/**",
        search: ""
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
