import type { MetadataRoute } from "next";
import { copy } from "@/copy";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bento",
    short_name: "Bento",
    description: copy.meta.description,
    start_url: "/trips",
    display: "standalone",
    background_color: "#FBF8F3",
    theme_color: "#221C1E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
