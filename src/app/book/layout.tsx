import { Barlow_Condensed, Hanken_Grotesk, Space_Mono } from "next/font/google";

const barlowCondensed = Barlow_Condensed({
  weight: ["700", "800", "900"],
  style: ["italic"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

const hankenGrotesk = Hanken_Grotesk({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-hanken",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`book-theme ${barlowCondensed.variable} ${hankenGrotesk.variable} ${spaceMono.variable}`}>
      {children}
    </div>
  );
}
