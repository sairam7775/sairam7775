import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bento",
    short_name: "Bento",
    description:
      "A trip planner for people who have never been to Japan. Real travel times, honest expectations, and a plan that tells you what's still missing.",
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
