import "./globals.css";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";

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

export default async function RootLayout({ children }) {
  let session = null;

  try {
    // Hand the session to SessionProvider so the header renders the right
    // state on the first paint instead of flashing a loading placeholder.
    session = await auth();
  } catch {
    // A missing or invalid AUTH_SECRET must not take the catalog down: fall
    // back to the anonymous experience.
    session = null;
  }

  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} app-body`}>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
