/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Optimized for Docker

  // Handle WebTorrent - exclude from SSR bundling
  webpack: (config, { isServer, webpack }) => {
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

      // Split global to DefinePlugin and keep others in ProvidePlugin
      config.plugins.push(
        new webpack.DefinePlugin({
          global: 'globalThis',
        }),
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    // Externalize webtorrent on server to prevent bundling
    if (isServer) {
      config.externals = [...(config.externals || []), 'webtorrent'];
    }

    return config;
  },
};

export default nextConfig;
