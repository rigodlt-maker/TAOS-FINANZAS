import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // Los estados de cuenta en PDF pueden pesar varios MB
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default config;
