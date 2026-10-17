import type { Metadata } from "next";
import "./globals.css";
import "./tier-room.css";
import "./compact-board.css";
import "./floating-player.css";
import "./live-chat.css";
import "./community.css";
import "./moment-timing.css";

export const metadata: Metadata = {
  title: "ON AIR — The TBPN Tier Room",
  description: "Watch the show. Rank the moments. An independent community tier room for TBPN livestreams.",
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
