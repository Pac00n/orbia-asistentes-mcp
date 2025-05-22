"use client"

import { useState, useEffect } from 'react'
import Image from "next/image"

export default function RotatingLogo() {
  const [rotation, setRotation] = useState(0)
  const [hover, setHover] = useState(false)
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset
      setRotation(scrollY * 0.15) // Rotación más sutil que el original
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div 
      className="relative flex items-center" 
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Image 
        src="/LogosNuevos/logo.svg" 
        alt="Orbia Logo" 
        width={140} 
        height={36} 
        className="object-contain drop-shadow-sm transition-all duration-300 ease-in-out" 
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.2s linear',
        }}
        priority 
      />
      <span 
        className={`ml-2 text-sm font-medium text-blue-600 transition-all duration-300 ${hover ? 'translate-x-1' : ''}`}
      >
        Asistentes IA
      </span>
    </div>
  )
}
