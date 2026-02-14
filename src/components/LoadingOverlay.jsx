import React from 'react';

const LoadingOverlay = ({ message = 'Loading...' }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[100]">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4 shadow-primary-glow"></div>
            <p className="text-white text-lg font-bold animate-pulse">{message}</p>
        </div>
    );
};

export default LoadingOverlay;
