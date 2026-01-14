import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedViewProps {
  children: ReactNode;
  viewKey: string;
}

export function AnimatedView({ children, viewKey }: AnimatedViewProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          transition: {
            duration: 0.3,
            ease: "easeOut",
          }
        }}
        exit={{ 
          opacity: 0, 
          y: -10, 
          scale: 0.98,
          transition: {
            duration: 0.2,
            ease: "easeIn",
          }
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
