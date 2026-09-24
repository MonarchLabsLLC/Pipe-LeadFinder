import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Retired "Coming soon" placeholders (the old Admin settings pages and the
  // resources catch-all). Old bookmarks land on New Search instead of a 404.
  async redirects() {
    return [
      { source: "/admin", destination: "/lead-search/new-search", permanent: false },
      { source: "/admin/:path*", destination: "/lead-search/new-search", permanent: false },
      {
        source: "/resources/documentation",
        destination: "/lead-search/new-search",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
