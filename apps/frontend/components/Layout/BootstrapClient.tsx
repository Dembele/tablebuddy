'use client'
//Loads bootstrap's JS once in the browser; its data-bs-* API then wires dropdowns, collapses and tabs.
//Inside the game room's drawer (an iframe) the page drops the site header and the room dock: the room already has both.
import {useEffect} from 'react'

const embeddedStyle = 'html.embedded body > header, html.embedded header.site-header, html.embedded .room-dock { display: none !important; }'

export default function BootstrapClient() {
  useEffect(() => {
    import('bootstrap').catch(console.error)
    if (window.self === window.top) return
    document.documentElement.classList.add('embedded')
    const style = document.createElement('style')
    style.textContent = embeddedStyle
    document.head.appendChild(style)
    return () => style.remove()
  }, [])
  return null
}
