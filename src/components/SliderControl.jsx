import React from 'react';

function SliderControl({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-gray-300">
                    {label}
                </label>
                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                    {value}{unit}
                </span>
            </div>
            <div className="relative">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gradient-to-r from-white/5 to-primary/20 rounded-full appearance-none cursor-pointer slider-thumb"
                    style={{
                        background: `linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.05) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.05) 100%)`
                    }}
                />
            </div>
        </div>
    );
}

export default SliderControl;
