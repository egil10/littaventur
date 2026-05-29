/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Type-checking still runs and gates the build; we just don't want a missing
  // ESLint config to block `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
