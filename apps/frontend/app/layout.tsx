//Root shell: theme, heading typeface, random tavern background, bootstrap JS for dropdowns/collapses.
import '@frontend/styles/globals.min.css'
import {Metadata, Viewport} from "next"
import {Alegreya} from "next/font/google"
import {ReactNode} from "react"
import BootstrapClient from "@frontend/components/Layout/BootstrapClient"

//headings only (design guide §3); self-hosted by next/font, Georgia until it loads or if it cannot be fetched
const display = Alegreya({subsets: ['latin', 'cyrillic'], weight: ['500', '700', '800'], variable: '--tb-font-display', display: 'swap', fallback: ['Georgia', 'serif']})

export const metadata: Metadata = {
  title: 'TableBuddy - твой цифровой компаньон',
  icons: {icon: '/icon.svg'},
  robots: {index: false, follow: false}
}

export const viewport: Viewport = {themeColor: '#15100a', colorScheme: 'dark'}

export default function RootLayout({children}: { children: ReactNode }) {
  const background = Math.floor(Math.random() * 4) + 1

  return (
    <html lang="ru" data-bs-theme="dark" data-scroll-behavior="smooth" className={display.variable}>
    <body style={{backgroundImage: `url(/bg${background}.png)`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}>
    <div className="d-flex flex-column min-vh-100">{children}</div>
    <BootstrapClient/>
    </body>
    </html>
  )
}
