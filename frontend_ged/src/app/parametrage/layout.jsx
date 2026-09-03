// app/parametrage/layout.jsx
"use client";

import { useState } from 'react';
import ParametrageSidebar from './sidebar';

export default function ParametrageLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="flex pt-16">
        <ParametrageSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
        
        <main 
          className={`
            transition-all duration-300 ease-in-out flex-1
            ${isSidebarOpen ? 'ml-64' : 'ml-20'}
          `}
        >
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}