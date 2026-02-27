import React from 'react';

function ColorPicker({ label, value, onChange }) {
    return (
        <div className="flex items-center justify-between group flex-wrap gap-2">
            <label className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors min-w-0 break-words">
                {label}
            </label>
            <div className="relative">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white/10 hover:border-primary/50 transition-all shadow-lg"
                    style={{
                        background: value,
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none'
                    }}
                />
                <div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                        background: value,
                        boxShadow: `0 0 20px ${value}40`
                    }}
                />
            </div>
        </div>
    );
}

export default ColorPicker;