import { useEffect, useState } from 'react';

export function useViewportScale(baseWidth, baseHeight) {
    const [scale, setScale] = useState({ x: 1, y: 1 });

    useEffect(() => {
        const updateScale = () => {
            setScale({
                x: window.innerWidth / baseWidth,
                y: window.innerHeight / baseHeight,
            });
        };

        window.addEventListener('resize', updateScale);
        window.visualViewport?.addEventListener('resize', updateScale);
        updateScale();
        window.setTimeout(updateScale, 10);

        return () => {
            window.removeEventListener('resize', updateScale);
            window.visualViewport?.removeEventListener('resize', updateScale);
        };
    }, [baseWidth, baseHeight]);

    return scale;
}
