import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Fira_Sans } from "next/font/google";
import "./globals.css";

const FiraSans = Fira_Sans({
    weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
    style: ["normal", "italic"],
    subsets: ["latin"]
});

export const metadata: Metadata = {
    title: "ICAC Scoresheet",
    description: "Realtime Digital Scoresheet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang='en'>
            <body className={FiraSans.className}>
                <main className='h-[100dvh] w-[100dvw] sm:w-full sm:min-h-screen mx-auto bg-beige-50 flex flex-col sm:rounded-lg sm:shadow-lg overflow-y-scroll no-scrollbar items-center px-4 py-4 gap-2'>
                    {children}
                </main>
            </body>
        </html>
    );
}
