import "./globals.css";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";

const headingFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

export const metadata = {
  title: "OpenSource Radar",
  description: "Find real, available open source issues to contribute to",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} app-body`}>{children}</body>
    </html>
  );
}
