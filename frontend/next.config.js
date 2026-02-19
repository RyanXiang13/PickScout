/** @type {import('next').NextConfig} */
const nextConfig = {
    // Required for Docker production build — packages everything into .next/standalone
    output: 'standalone',
};

module.exports = nextConfig;
