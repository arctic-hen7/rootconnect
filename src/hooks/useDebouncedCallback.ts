import { useCallback, useEffect, useRef } from "react";

export const useDebouncedCallback = <Args extends unknown[]>(
    callback: (...args: Args) => void,
    delay: number,
) => {
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return useCallback(
        (...args: Args) => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => {
                callback(...args);
            }, delay);
        },
        [callback, delay],
    );
};
