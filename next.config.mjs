// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;

// next.config.js
const nextConfig = {
    webpack: (config, { isServer }) => {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
  
      // WASM will work in all environments
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
  
      return config;
    },
  };
  
export default nextConfig;
