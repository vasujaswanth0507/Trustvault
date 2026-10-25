/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2", "@prisma/client", "prisma"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@node-rs/argon2"];
    }
    return config;
  },
};

export default nextConfig;
