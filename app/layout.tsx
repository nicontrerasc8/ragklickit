import type { Metadata } from "next";
import { Geist, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Ragklickit",
    template: "%s | Ragklickit",
  },
  description: "Plataforma para gestionar empresas, briefs y planes de trabajo en agencias.",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${spaceGrotesk.variable} ${geistSans.className} app-shell antialiased`}>
        <div className="app-background" aria-hidden="true">
          <div className="app-background__grid" />
          <div className="app-background__glow app-background__glow--top" />
          <div className="app-background__glow app-background__glow--side" />
          <div className="app-background__glow app-background__glow--bottom" />
        </div>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
