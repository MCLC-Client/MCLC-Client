import React, { useState, useEffect } from 'react';

// Example Extension Entry
/**
 * The 'register' function is the main entry point for MCLC extensions.
 * It is called once the extension is loaded by the host application.
 * 
 * @param {object} api - The MCLC Extension API
 */
export const register = (api) => {
    // Register our component into the sidebar bottom slot
    api.registerView('sidebar.bottom', ExtensionWidget);
    
    console.log("[Example Extension] Registered successfully!");
};

/**
 * A polished system monitor widget that demonstrates:
 * 1. React hooks (useState, useEffect)
 * 2. Tailwind CSS classes (provided by the host)
 * 3. Interactions and animations
 * 4. API usage (simulated)
 */
const ExtensionWidget = () => {
  const [stats, setStats] = useState({ cpu: 0, ram: 0 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
        setStats({
            cpu: Math.floor(Math.random() * 25) + 5,
            ram: Math.floor(Math.random() * 35) + 15
        });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
        className={`w-full p-4 rounded-2xl border transition-all duration-300 group ${
            isHovered 
            ? 'bg-white/10 border-white/20 shadow-xl scale-[1.02]' 
            : 'bg-white/5 border-white/5'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stats.cpu > 20 ? 'bg-yellow-500' : 'bg-primary'} animate-pulse`} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">System Node</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      
      {/* CPU Metric */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between items-end">
            <span className="text-[10px] text-gray-500 font-medium">PROCESSOR</span>
            <span className="text-xs font-mono font-bold text-primary">{stats.cpu}%</span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
                className="h-full bg-primary transition-all duration-1000 ease-out" 
                style={{ width: `${stats.cpu}%` }} 
            />
        </div>
      </div>

      {/* RAM Metric */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-end">
            <span className="text-[10px] text-gray-500 font-medium">MEMORY</span>
            <span className="text-xs font-mono font-bold text-blue-400">{stats.ram}%</span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
                className="h-full bg-blue-400 transition-all duration-1000 ease-out" 
                style={{ width: `${stats.ram}%` }} 
            />
        </div>
      </div>
      
      {isHovered && (
          <div className="mt-3 pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-300">
              <button 
                className="w-full py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-bold rounded-lg transition-colors shadow-inner"
                onClick={() => alert("MCLC Extension Engine v1.0.4 - All systems nominal.")}
              >
                  DIAGNOSTICS
              </button>
          </div>
      )}
    </div>
  );
};
