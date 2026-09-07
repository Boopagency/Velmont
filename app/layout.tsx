import type { Metadata } from 'next';
import { nextMetadata } from '@/lib/seo';
import { siteUrl } from '@/lib/site';
import './globals.css';
export const metadata: Metadata = { ...nextMetadata('/'), metadataBase: new URL(siteUrl), icons: { icon: '/images/velmont-icon.png', apple: '/images/velmont-icon.png' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><head><link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /><meta name="theme-color" content="#210910" /></head><body>{children}</body></html>;
}
