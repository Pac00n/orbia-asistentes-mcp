"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"

export default function SmallRotatingLogo() {
  const [rotation, setRotation] = useState(0)
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset
      setRotation(scrollY * 0.4) // Mantenemos la rotación por scroll por ahora
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    // Contenedor principal del logo pequeño, enlazado
    <Link href="/" className="block">
      <div className="relative w-48 h-48 mx-auto select-none cursor-pointer"> 
        {/* Imagen del logo (engranaje) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40">
          <Image
            src="/LogosNuevos/logo_orbia_sin_texto.png"
            alt="Logo Orbia"
            fill
            priority
            className="object-contain"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.1s linear',
              zIndex: 1
            }}
          />
        </div>
        
        {/* Imagen del texto transparente */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24">
          <Image
            src="/LogosNuevos/orbia_text_transparent.png"
            alt="Orbia Texto Transparente"
            fill
            priority
            className="object-contain"
            style={{
              pointerEvents: 'none',
              zIndex: 2
            }}
          />
        </div>
      </div>
    </Link>
  )
}
