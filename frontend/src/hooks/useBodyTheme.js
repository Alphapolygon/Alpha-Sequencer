import { useEffect } from 'react';

export function useBodyTheme(backgroundColor) {
    useEffect(() => {
        document.body.style.backgroundColor = backgroundColor;
    }, [backgroundColor]);
}
