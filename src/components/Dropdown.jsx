import React, { useState, useRef, useEffect } from 'react';

const Dropdown = ({ options, value, onChange, placeholder = "Select...", disabled = false, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (option) => {
        onChange(option.value);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full bg-background border border-white/10 rounded-xl p-3 text-left flex justify-between items-center transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20'} ${isOpen ? 'border-primary ring-1 ring-primary' : ''}`}
                disabled={disabled}
            >
                <span className={`truncate ${selectedOption ? 'text-white' : 'text-gray-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-surface border border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                    {options.length === 0 ? (
                        <div className="p-3 text-gray-500 text-sm text-center">No options</div>
                    ) : (
                        options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => !option.disabled && handleSelect(option)}
                                disabled={option.disabled}
                                className={`w-full text-left p-3 text-sm transition-colors ${option.disabled
                                        ? 'text-gray-600 cursor-not-allowed bg-white/2'
                                        : option.value === value
                                            ? 'text-primary bg-primary/10 font-bold'
                                            : 'text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Dropdown;
