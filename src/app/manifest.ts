import type { MetadataRoute } from "next";

/** Lets the app be added to a phone's home screen and open full-screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinSight-AI",
    short_name: "FinSight",
    description:
      "An explainable financial coach: understand your money, protect what matters, explore what you can change.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f5",
    theme_color: "#004628",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
