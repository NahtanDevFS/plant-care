const nextConfig = {
  // Añade este bloque de código
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "plant-id.ams3.cdn.digitaloceanspaces.com",
        port: "",
        pathname: "/**", // Permite cualquier ruta de imagen de este dominio
      },
    ],
  },
};

module.exports = nextConfig;
