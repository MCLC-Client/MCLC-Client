import React from 'react';

const ToggleBox = ({ checked, onChange, label, description, className = '' }) => {
    return (
        <label className={`flex items-center justify-between group cursor-pointer ${className}`}>
            {(label || description) && (
                <div className="flex-1 pr-4">
                    {label && <div className="font-medium text-white group-hover:text-primary transition-colors">{label}</div>}
                    {description && <div className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</div>}
                </div>
            )}
            <div className="relative inline-flex items-center">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-700/50 border border-white/10 peer-focus:outline-none rounded-full peer 
                    peer-checked:after:translate-x-5 peer-checked:after:border-white 
                    after:content-[''] after:absolute after:top-[1px] after:left-[1px] 
                    after:bg-white after:border-gray-300 after:border after:rounded-full 
                    after:h-5 after:w-5 after:transition-all after:duration-300
                    after:shadow-sm peer-checked:bg-primary peer-checked:border-primary/50
                    transition-all duration-300">
                </div>
                {/* Subtle outer glow when checked */}
                <div className="absolute inset-0 rounded-full opacity-0 peer-checked:opacity-20 bg-primary blur-md transition-opacity duration-300 -z-10"></div>
            </div>
        </label>
    );
};

export default ToggleBox;
