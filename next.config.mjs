/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // GitHub avatars come from the OAuth profile.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
