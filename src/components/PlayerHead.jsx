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
    // If we have a direct texture URL, we can render the head ourselves
    // Minecraft Skin Layout (64x64 or 64x32):
    // Head: 8,8 to 16,16 (Front)
    // Helm/Overlay: 40,8 to 48,16 (Front)

    // We use CSS background properties to "crop" the image without needing a canvas or CORS
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
        backgroundSize: '800%', // 64 / 8 = 8
        imageRendering: 'pixelated',
        transition: 'background-image 0.3s ease'
    };

    // Head Front is at (8, 8) in a 64x64 grid
    // In percentage: 8/64 = 12.5%
    // But background-position works differently: (pos / (total - viewport))
    // Easier to use pixel offsets with background-size
    const headLayer = {
        ...layerStyle,
        backgroundPosition: `-${size}px -${size}px`, // This is simplified, let's use percentage which is more robust
    };

    // Correct Minecraft Head offsets (8,8 for head, 40,8 for overlay)
    // The texture is 64x64. The head is 8x8.
    // So background-size should be 800% (64/8 * 100)
    // Position for Head (8, 8): 
    // x = 8 / (64 - 8) = 8 / 56 = 14.285%
    // y = 8 / (64 - 8) = 8 / 56 = 14.285%

    // Actually, background-position: 14.28% 14.28% with 800% size renders the (8,8) block
    const headPos = "14.285% 14.285%";
    const hatPos = "71.428% 14.285%"; // 40 / 56 = 71.428%

    // If we don't have a direct texture URL, we fall back to the API
    if (!src || !src.startsWith('http')) {
        const fallbackUrl = uuid
            ? `https://mc-heads.net/avatar/${uuid}/${size}`
            : `https://mc-heads.net/avatar/${name || 'Steve'}/${size}`;

        return (
            <div style={baseStyle} className={className}>
                <img
                    src={fallbackUrl}
                    alt="Head"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        );
    }

    return (
        <div style={baseStyle} className={className} title={name}>
            {/* Base Head Layer */}
            <div style={{
                ...layerStyle,
                backgroundPosition: headPos
            }} />
            {/* Hat/Overlay Layer */}
            <div style={{
                ...layerStyle,
                backgroundPosition: hatPos
            }} />
        </div>
    );
};

export default PlayerHead;
