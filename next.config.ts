import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Apple busca este path exacto para habilitar Passkeys y universal
        // links. Lo servimos desde /api/aasa (route handler que arma el JSON
        // con el Team ID del env).
        source: "/.well-known/apple-app-site-association",
        destination: "/api/aasa",
      },
    ];
  },
};

export default nextConfig;
