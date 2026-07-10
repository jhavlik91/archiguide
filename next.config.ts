import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Povolí `forbidden()`/`unauthorized()` interrupty (T004 — 403 na (admin)).
  experimental: { authInterrupts: true },
};

export default nextConfig;
