/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Optimized for Docker

  // Handle WebTorrent - exclude from SSR bundling
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Browser - provide fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        dgram: false,
        child_process: false,
        http: false,
        https: false,
        os: false,
        path: false,
        stream: false,
        crypto: false,
        zlib: false,
      };
    }
    
    // Externalize webtorrent on server to prevent bundling
    if (isServer) {
      config.externals = [...(config.externals || []), 'webtorrent'];
    }
    
    return config;
  },
};

export default nextConfig;
