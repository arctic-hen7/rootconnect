import { memo, useRef } from "react";

export type UnionNodeProps = {
    id: string;
    x: number;
    y: number;
    isSelected: boolean;
    onSelect: (unionId: string, anchor: { x: number; y: number }) => void;
};

export const UNION_NODE_SIZE = 24;

export const UnionNode = memo(({ id, x, y, isSelected, onSelect }: UnionNodeProps) => {
    const ref = useRef<HTMLDivElement | null>(null);

    const handleClick = () => {
        const element = ref.current;
        if (!element) {
            return;
        }
        const rect = element.getBoundingClientRect();
        onSelect(id, {
            x: rect.left + rect.width + 12,
            y: rect.top - 12,
        });
    };

    return (
        <div
            ref={ref}
            className={`union-node ${isSelected ? "union-node-selected" : ""}`}
            style={{
                left: x,
                top: y,
                width: UNION_NODE_SIZE,
                height: UNION_NODE_SIZE,
            }}
            onPointerDown={event => event.stopPropagation()}
            onClick={handleClick}
        />
    );
});

UnionNode.displayName = "UnionNode";
