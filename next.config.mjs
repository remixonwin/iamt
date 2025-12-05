/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Optimized for Docker
  
  // Polyfill for WebTorrent browser compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        dgram: false,
      };
    }
    return config;
  },
};

export default nextConfig;
