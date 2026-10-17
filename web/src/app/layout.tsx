import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque, Caveat, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700", "800"] });
const body = Atkinson_Hyperlegible({ variable: "--font-body", subsets: ["latin"], weight: ["400", "700"] });
const note = Caveat({ variable: "--font-note", subsets: ["latin"], weight: ["600"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ripple",
  description: "Paste a headline and see who it hits next: knock-on effects traced through a map of the economy built on FalkorDB.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${body.variable} ${note.variable} ${code.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
