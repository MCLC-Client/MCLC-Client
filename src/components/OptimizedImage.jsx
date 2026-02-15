import React, { useState, useEffect, useRef } from 'react';

const OptimizedImage = ({ src, alt, className, fallback, ...props }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' } // Load slightly before they enter the viewport
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    if (error && fallback) return fallback;

    return (
        <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
            {isVisible && !error && (
                <img
                    src={src}
                    alt={alt}
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setError(true)}
                    {...props}
                />
            )}
            {!isLoaded && !error && (
                <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
                    <div className="w-1/3 h-1/3 border border-white/10 rounded-full opacity-20"></div>
                </div>
            )}
        </div>
    );
};

export default OptimizedImage;
