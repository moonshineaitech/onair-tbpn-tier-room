import type { Metadata } from "next";
import "./globals.css";
import "./tier-room.css";
import "./compact-board.css";
import "./floating-player.css";
import "./live-chat.css";
import "./community.css";
import "./moment-timing.css";
import "./episode-navigation.css";
import "./quick-share.css";
import "./board-comparison.css";
import "./stream-platform.css";

export const metadata: Metadata = {
  title: "ON AIR — The Live Tier Room",
  description: "Create a room for any livestream. Watch together, rank the moments, chat, and share your personal tier board.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
