import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CUBE MIND — Think. Solve. Grow.",
  description: "A gamified problem-solving experience built around the Rubik's Cube."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}