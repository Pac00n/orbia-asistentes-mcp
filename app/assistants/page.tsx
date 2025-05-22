"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion"; // Added AnimatePresence
import { Search, ArrowRight, Cpu, MessageCircle, TrafficCone, Hammer, Globe, ChevronDown, Settings, Brain } from "lucide-react"; // Added ChevronDown, Settings, Brain
import Image from "next/image";
import { assistants as allAssistantsFromLib, Assistant as AssistantConfig } from "@/lib/assistants"; // Import from lib/assistants.ts

// Define the structure for cards, mapping from AssistantConfig
interface AssistantCardInfo {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode; // We'll map iconType to ReactNode
  href: string;
  color: string; // We might need a default or map from bgColor
  isMCP: boolean;
  openaiAssistantId?: string;
}

// Helper to map AssistantConfig to AssistantCardInfo
const mapAssistantToCard = (assistant: AssistantConfig): AssistantCardInfo => {
  const isMCP = assistant.id.toLowerCase().includes("mcp");
  let href = "";
  if (isMCP) {
    // Specific routing for MCP assistants if needed, e.g. mcp-v5-tools uses a different page
    if (assistant.id === "mcp-v5") { // Example, adjust as per your actual MCP IDs
      href = `/chat/mcpv5/mcp-v5-tools`; // Or just /chat/mcpv5/${assistant.id} if that page handles it
    } else if (assistant.id === "mcp-test-assistant") { // Assuming mcp-test-assistant uses the mcpv5 chat page
      href = `/chat/mcpv5/${assistant.id}`;
    }
     else { // Generic MCP assistant link
      href = `/chat/mcpv5/${assistant.id}`; // Fallback, ensure this page exists or adjust
    }
  } else {
    // For specialized assistants, typically they use the [assistantId] page
    href = `/chat/${assistant.id}`;
  }

  // Map LucideIcon to ReactNode. You might need a more sophisticated mapping or default.
  const IconComponent = assistant.iconType || Brain; // Default to Brain icon

  return {
    id: assistant.id,
    title: assistant.name,
    description: assistant.shortDescription,
    // Example: Map iconType to a ReactNode. You might want specific colors per icon.
    icon: <IconComponent className={`w-8 h-8 ${isMCP ? 'text-emerald-400' : 'text-sky-400'}`} />,
    href: href,
    // Example: Determine color based on type or use assistant.bgColor
    color: assistant.bgColor ? assistant.bgColor.replace('bg-', 'from-').concat(' to-slate-800') : (isMCP ? "from-emerald-500 to-teal-600" : "from-sky-500 to-indigo-600"),
    isMCP: isMCP,
    openaiAssistantId: assistant.openaiAssistantId,
  };
};

const allMappedAssistants: AssistantCardInfo[] = allAssistantsFromLib.map(mapAssistantToCard);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2, // Add a small delay for the container before children animate
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4, // Slightly faster animation for items
      ease: "easeOut"
    }
  }
};

const sectionHeaderVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } }
};


// Collapsible Section Component
const CollapsibleSection = ({ title, children, icon: TitleIcon, defaultOpen = true }: { title: string, children: React.ReactNode, icon?: LucideIcon, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div className="mb-12">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-2xl md:text-3xl font-bold text-left mb-6 pb-2 border-b-2 border-gray-700/50 hover:border-orange-400/50 transition-colors duration-300 focus:outline-none"
        variants={sectionHeaderVariants}
      >
        <div className="flex items-center bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-400 to-pink-500">
          {TitleIcon && <TitleIcon className="w-8 h-8 mr-3 text-orange-400" />}
          {title}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-7 h-7 text-gray-400" />
        </motion.div>
      </motion.button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: "auto", transition: { duration: 0.4, ease: "easeOut" } },
              collapsed: { opacity: 0, height: 0, transition: { duration: 0.3, ease: "easeIn" } }
            }}
            className="overflow-hidden"
          >
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
              variants={containerVariants} // Reuse container for staggering items within section
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};


export default function AssistantsPage() {
  const [rotation, setRotation] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      setRotation(scrollY * 0.3);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const mcpAssistants = allMappedAssistants.filter(assistant => 
    assistant.isMCP &&
    (assistant.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     assistant.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const specializedAssistants = allMappedAssistants.filter(assistant => 
    !assistant.isMCP &&
    (assistant.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     assistant.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderAssistantCard = (assistant: AssistantCardInfo) => (
    <motion.div 
      key={assistant.id}
      variants={itemVariants}
      className="group"
    >
      <Link href={assistant.href} className="block h-full">
        <div className={`h-full bg-gradient-to-br ${assistant.color}/30 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 hover:border-orange-400/30 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/20 backdrop-blur-sm group-hover:-translate-y-1.5`}>
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${assistant.color}/40 relative shadow-lg`}>
              {assistant.icon}
              {/* Example for toolCount, if you add it to AssistantCardInfo from AssistantConfig */}
              {/* {assistant.toolCount && (
                <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {assistant.toolCount}
                </div>
              )} */}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-1.5">{assistant.title}</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{assistant.description}</p>
            </div>
            <div className="flex-shrink-0 text-gray-500 group-hover:text-orange-400 transition-colors duration-300 pt-1">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );

  return (
    <div className="min-h-screen text-white bg-gray-950 overflow-x-hidden">
      {/* Fondo con logo giratorio */}
      <div className="fixed inset-0 bg-gray-950 -z-10">
        <div className="fixed inset-0 flex justify-center items-center pointer-events-none">
          <motion.div 
            className="w-full h-full flex items-center justify-center opacity-5" // Reduced opacity for subtlety
            style={{ 
              rotate: rotation,
              filter: 'blur(24px)' // Increased blur
            }}
          >
            <Image
              src="/LogosNuevos/logo_orbia_sin_texto.png"
              alt="Orbia Logo Fondo"
              width={800} // Slightly larger
              height={800}
              className="object-contain"
              priority
            />
          </motion.div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 md:pt-32 md:pb-28"> {/* Adjusted padding */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          {/* Badge de estado */}
          <motion.div 
            className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-700/30 to-purple-700/30 border border-sky-600/50 text-sky-300 text-sm font-medium mb-6 backdrop-blur-sm shadow-md"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <span className="relative flex h-2.5 w-2.5 mr-2.5"> {/* Adjusted size and margin */}
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
            Asistentes Disponibles
          </motion.div>

          {/* Título principal */}
          <div className="mb-10 pt-2"> {/* Reduced margin-bottom */}
            <motion.h1 
              className="text-5xl md:text-6xl font-extrabold text-center tracking-tight" /* Added tracking */
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-orange-400 to-pink-500">
                Elige tu Asistente
              </span>
            </motion.h1>
          </div>

          {/* Descripción */}
          <motion.p 
            className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed" /* Increased max-width */
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Explora nuestra gama de asistentes inteligentes, diseñados para potenciar tu productividad y creatividad en diversas tareas.
          </motion.p>
          
          {/* Barra de búsqueda */}
          <div className="mt-8 mb-12 max-w-xl mx-auto relative"> {/* Reduced max-width */}
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"> {/* Adjusted padding */}
              <Search className="w-5 h-5 text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar asistentes por nombre o descripción..."
              className="block w-full pl-12 pr-4 py-3.5 border border-gray-700/80 rounded-xl bg-gray-800/70 backdrop-blur-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 transition-all duration-200 shadow-sm text-base" /* Enhanced styling */
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </motion.div>

        {/* Secciones Colapsables */}
        <motion.div 
          className="max-w-6xl mx-auto" // Slightly wider for content
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <CollapsibleSection title="Asistentes MCP" icon={Settings} defaultOpen={true}>
            {mcpAssistants.length > 0 ? 
              mcpAssistants.map(renderAssistantCard) :
              <p className="text-gray-500 col-span-full text-center py-4">No se encontraron asistentes MCP que coincidan con la búsqueda.</p>
            }
          </CollapsibleSection>

          <CollapsibleSection title="Asistentes Especializados" icon={Brain} defaultOpen={true}>
            {specializedAssistants.length > 0 ?
              specializedAssistants.map(renderAssistantCard) :
              <p className="text-gray-500 col-span-full text-center py-4">No se encontraron asistentes especializados que coincidan con la búsqueda.</p>
            }
          </CollapsibleSection>
        </motion.div>

        <motion.div 
          className="mt-20 text-center max-w-3xl mx-auto" /* Increased margin-top */
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-gray-400 mb-2">Versión 3.0</p>
          <h2 className="text-2xl font-semibold text-white mb-4">Nueva experiencia de chat mejorada</h2>
          <p className="text-gray-300">
            Disfruta de una interfaz más limpia y fluida con nuestras últimas mejoras de usabilidad.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
