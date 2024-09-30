/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // except for webpack, other parts are left as generated
  webpack: (config, context) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300
    }
    return config
  },
  transpilePackages: [
    // 根据实际情况按需添加
    'shiki',
    '@ant-design/pro-chat',
    '@ant-design/pro-editor',
  ]
}

export default nextConfig;
