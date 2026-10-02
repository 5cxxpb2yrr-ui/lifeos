import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "LifeOS V2", description: "Personal operating system — Mission Control" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}