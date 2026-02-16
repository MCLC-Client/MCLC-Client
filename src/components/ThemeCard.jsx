import React from 'react';

function ThemeCard({ theme, onApply, onDelete, isCustom = false }) {
    return (
        <button
            onClick={onApply}
            className="group relative overflow-hidden rounded-xl border border-white/5 hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-95"
        >
            {/* Color Preview */}
            <div className="h-20 relative overflow-hidden">
                <div 
                    className="absolute inset-0 opacity-40"
                    style={{ background: theme.bg }}
                />
                <div 
                    className="absolute inset-0"
                    style={{ 
                        background: `linear-gradient(135deg, ${theme.primary}20 0%, transparent 100%)`
                    }}
                />
                <div 
                    className="absolute bottom-2 left-2 w-8 h-8 rounded-lg shadow-lg border-2 border-white/20"
                    style={{ 
                        background: theme.primary,
                        boxShadow: `0 0 20px ${theme.primary}60`
                    }}
                />
                <div 
                    className="absolute bottom-2 right-2 w-6 h-6 rounded-md opacity-60"
                    style={{ background: theme.surface }}
                />
            </div>
            
            {/* Theme Name */}
            <div className="bg-surface/80 backdrop-blur-sm p-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">
                        {theme.name}
                    </span>
                    {isCustom && onDelete && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-1 hover:bg-red-500/20 rounded-md text-gray-500 hover:text-red-400 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}

export default ThemeCard;
