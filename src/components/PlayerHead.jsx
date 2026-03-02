import React from 'react';

/**
 * Renders a Minecraft player head directly from a skin texture
 * @param {Object} props
 * @param {string} props.src - The texture URL (textures.minecraft.net/texture/...)
 * @param {string} props.uuid - Fallback UUID for mc-heads.net
 * @param {string} props.name - Fallback name
 * @param {number} props.size - Display size in pixels (default 40)
 * @param {string} props.className - Optional classes
 */
const PlayerHead = ({ src, uuid, name, size = 40, className = "" }) => {
    const baseStyle = {
        width: size,
        height: size,
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0
    };

    const layerStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `url(${src})`,
        backgroundSize: '800%',
        imageRendering: 'pixelated',
        transition: 'background-image 0.3s ease'
    };
    const headLayer = {
        ...layerStyle,
        backgroundPosition: `-${size}px -${size}px`,
    };
    const headPos = "14.285% 14.285%";
    const hatPos = "71.428% 14.285%";
    if (!src || !src.startsWith('http')) {
        // Use crafatar.com as it's more reliable and provides better head renders
        // Default size for Minecraft heads is 8, but 64 is good for avatars
        const fallbackUrl = uuid
            ? `https://crafatar.com/avatars/${uuid}?size=${size}&overlay`
            : `https://crafatar.com/avatars/${name || 'Steve'}?size=${size}&overlay`;

        return (
            <div style={baseStyle} className={className}>
                <img
                    src={fallbackUrl}
                    alt="Head"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        imageRendering: 'pixelated'
                    }}
                />
            </div>
        );
    }

    return (
        <div style={baseStyle} className={className} title={name}>
            { }
            <div style={{
                ...layerStyle,
                backgroundPosition: headPos
            }} />
            { }
            <div style={{
                ...layerStyle,
                backgroundPosition: hatPos
            }} />
        </div>
    );
};

export default PlayerHead;