import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "./globals.css";
import Footer from "@/components/layout/Footer";
import RegisterSW from "@/components/RegisterSW";
import InstallBanner from "@/components/InstallBanner";
import NotificationClickTracker from "@/components/NotificationClickTracker";
import { GA_MEASUREMENT_ID } from "@/lib/analytics/track";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Wishlist",
    template: "%s | Wishlist",
  },
  description: "Family wishlist and gift exchange",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wishlist",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
        <RegisterSW />
        <InstallBanner />
        <Suspense fallback={null}>
          <NotificationClickTracker />
        </Suspense>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
