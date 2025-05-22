'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowRight, Zap, Search, MessageCircle, Globe } from 'lucide-react';

const features = [
  {
    name: 'Respuestas Rápidas',
    description: 'Obtén respuestas instantáneas con nuestra tecnología de IA avanzada.',
    icon: <Zap className="w-8 h-8 text-blue-400" />,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Búsqueda Inteligente',
    description: 'Encuentra información relevante en segundos con búsqueda avanzada.',
    icon: <Search className="w-8 h-8 text-purple-400" />,
    color: 'from-purple-500 to-fuchsia-500',
  },
  {
    name: 'Asistencia Personalizada',
    description: 'Interactúa con asistentes especializados en diferentes áreas.',
    icon: <MessageCircle className="w-8 h-8 text-orange-400" />,
    color: 'from-orange-500 to-amber-500',
  },
  {
    name: 'Acceso Global',
    description: 'Disponible en cualquier momento y desde cualquier dispositivo.',
    icon: <Globe className="w-8 h-8 text-emerald-400" />,
    color: 'from-emerald-500 to-teal-500',
  },
];

export default function Home() {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      setRotation(scrollY * 0.3);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="min-h-screen text-white bg-gray-950">
      {/* Fondo con logo giratorio */}
      <div className="fixed inset-0 bg-gray-950">
        <div className="fixed inset-0 flex justify-center items-center z-0 pointer-events-none">
          <motion.div 
            className="w-full h-full flex items-center justify-center opacity-10"
            style={{ 
              rotate: rotation,
              filter: 'blur(16px)'
            }}
          >
            <Image
              src="/LogosNuevos/logo_orbia_sin_texto.png"
              alt="Orbia Logo Fondo"
              width={700} 
              height={700}
              className="object-contain"
              priority
            />
          </motion.div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-20 md:pt-28 md:pb-28">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo Orbia */}
          <motion.div 
            className="relative flex items-center justify-center mb-8 mx-auto"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{ width: '500px', height: '500px' }}
          >
            {/* Fondo del logo sin texto */}
            <div className="absolute inset-0">
              <Image
                src="/LogosNuevos/logo_orbia_sin_texto.png"
                alt="Orbia Logo"
                fill
                className="object-contain"
                priority
                sizes="250px"
              />
            </div>
            
            {/* Texto Orbia superpuesto */}
            <div className="absolute" style={{ width: '140%', height: '50%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <Image
                src="/LogosNuevos/orbia_text_transparent.png"
                alt="Orbia"
                fill
                className="object-contain"
                priority
                sizes="(max-width: 768px) 350px, 600px"
                style={{ objectFit: 'contain' }}
              />
            </div>
          </motion.div>

          <motion.h1 
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="inline-block">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-orange-300 to-pink-400">
                Potencia tu productividad
              </span>
            </div>
            <div className="mt-2">
              <span className="text-white">con IA avanzada</span>
            </div>
          </motion.h1>
          
          <motion.p 
            className="text-lg text-gray-300 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Descubre el poder de la inteligencia artificial con nuestros asistentes especializados.
          </motion.p>
          
          <motion.div 
            className="mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Link 
              href="/assistants" 
              className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-purple-500/20"
            >
              Explorar Asistentes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Features Section */}
        <motion.div 
          className="mt-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.h2 
            className="text-3xl font-bold text-center mb-12"
            variants={itemVariants}
          >
            <div className="inline-block">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-orange-300 to-pink-400">
                Características principales
              </span>
            </div>
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                variants={itemVariants}
                className="bg-gray-900/40 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-orange-500/30 transition-all duration-300 h-full"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-r ${feature.color} bg-opacity-20`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.name}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Asistentes Section */}
        <motion.section 
          id="asistentes" 
          className="mt-32 py-20"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.div 
            className="max-w-4xl mx-auto text-center mb-16"
            variants={itemVariants}
          >
            <h2 className="text-3xl font-bold mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-orange-300 to-pink-400">
                Nuestros Asistentes
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Explora nuestra colección de asistentes inteligentes diseñados para potenciar tu productividad.
            </p>
          </motion.div>
          
          <motion.div
            className="mt-10 text-center"
            variants={itemVariants}
          >
            <Link 
              href="/assistants"
              className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-purple-500/20"
            >
              Explorar Asistentes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </motion.div>
        </motion.section>

        {/* CTA Section */}
        <motion.section 
          className="mt-32 py-20 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-2xl"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.div 
            className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8"
            variants={itemVariants}
          >
            <h2 className="text-3xl font-bold text-white mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-orange-300 to-pink-400">
                ¿Listo para comenzar?
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Descubre cómo nuestros asistentes de IA pueden transformar tu flujo de trabajo hoy mismo.
            </p>
            <Link
              href="/assistants"
              className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-purple-500/20"
            >
              Explorar Asistentes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </motion.div>
        </motion.section>

        {/* About Section */}
        <motion.section 
          id="about" 
          className="mt-32 py-20"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                variants={itemVariants}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-orange-300 to-pink-400">
                    Potenciando el futuro con IA
                  </span>
                </h2>
                <div className="h-1 w-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-8"></div>
                
                <div className="space-y-6">
                  <p className="text-lg text-gray-300">
                    En Orbia, estamos comprometidos con el desarrollo de soluciones de inteligencia artificial que ayuden a las personas y empresas a alcanzar su máximo potencial.
                  </p>
                  <p className="text-lg text-gray-300">
                    Nuestra plataforma de asistentes de IA está diseñada para ser intuitiva, poderosa y accesible para todos.
                  </p>
                  
                  <div className="pt-4">
                    <Link 
                      href="#"
                      className="inline-flex items-center text-blue-400 hover:text-blue-300 font-medium transition-colors group"
                    >
                      Conoce más sobre nosotros
                      <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                className="relative h-96 w-full rounded-2xl overflow-hidden"
                variants={itemVariants}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl backdrop-blur-sm"></div>
                <Image
                  src="/LogosNuevos/orbia_text_transparent.png"
                  alt="Orbia IA"
                  fill
                  className="object-contain p-12"
                  priority
                />
              </motion.div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/40 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex justify-center md:justify-start space-x-6">
              <a href="#" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Términos
              </a>
              <a href="#" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Privacidad
              </a>
              <a href="#" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Contacto
              </a>
            </div>
            <div className="mt-4 md:mt-0 text-center md:text-right">
              <p className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()} Orbia. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
