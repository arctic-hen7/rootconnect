import { memo, useRef } from "react";
import { UNION_NODE_SIZE } from "../utils/layout";

export type UnionNodeProps = {
    id: string;
    x: number;
    y: number;
    isSelected: boolean;
    onSelect: (unionId: string, anchor: { x: number; y: number }) => void;
};

export const UnionNode = memo(({ id, x, y, isSelected, onSelect }: UnionNodeProps) => {
    const ref = useRef<HTMLDivElement | null>(null);

    const handleClick = () => {
        const element = ref.current;
        if (!element) {
            return;
        }
        const container = element.closest(".tree-pane") as HTMLElement | null;
        const rect = element.getBoundingClientRect();
        let x = rect.left + rect.width + 8;
        let y = rect.top - 12;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            x = rect.left - containerRect.left + rect.width + 8;
            y = rect.top - containerRect.top - 12;
        }
        onSelect(id, {
            x,
            y,
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
