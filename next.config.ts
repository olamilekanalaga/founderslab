import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
// Keep the isolated laptop preview within its available disk and worker budget.
if (process.env.FOUNDERSLAB_LOCAL_PREVIEW === "1") {
  config.experimental = { ...config.experimental, cpus: 1 };
  config.webpack = (webpackConfig) => {
    webpackConfig.cache = false;
    return webpackConfig;
  };
}
export default config;
