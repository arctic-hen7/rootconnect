import {
    MouseEvent,
    PointerEvent,
    WheelEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTreeContext } from "../state/TreeContext";
import { PersonNode } from "./PersonNode";
import { UnionNode } from "./UnionNode";
import { computeTreeLayout, TreeLayout } from "../utils/layout";

export type GenealogyTreeViewProps = {
    selectedPersonId: string | null;
    selectedUnionId: string | null;
    onSelectPerson: (personId: string, position: { x: number; y: number }) => void;
    onSelectUnion: (unionId: string, position: { x: number; y: number }) => void;
    onClearSelection: () => void;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

export const GenealogyTreeView = ({
    selectedPersonId,
    selectedUnionId,
    onSelectPerson,
    onSelectUnion,
    onClearSelection,
}: GenealogyTreeViewProps) => {
    const { tree } = useTreeContext();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const panStateRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);
    const wasDraggingRef = useRef(false);
    const [viewport, setViewport] = useState({ x: 120, y: 120, scale: 1 });

    const layout = useMemo<TreeLayout>(() => computeTreeLayout(tree), [tree]);

    useEffect(() => {
        const rootNode = containerRef.current;
        if (!rootNode) {
            return;
        }
        const { width, height } = layout;
        if (width === 0 || height === 0) {
            return;
        }
        const rect = rootNode.getBoundingClientRect();
        const fitsHorizontally = rect.width > 0 ? rect.width / width : 1;
        const fitsVertically = rect.height > 0 ? rect.height / height : 1;
        const nextScale = Math.min(1, Math.max(MIN_SCALE, Math.min(fitsHorizontally, fitsVertically)));
        setViewport(prev => ({
            x: prev.x,
            y: prev.y,
            scale: nextScale,
        }));
    }, [layout.height, layout.width]);

    const handleBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
        if (wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
        }
        if (event.target === event.currentTarget) {
            onClearSelection();
        }
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }
        wasDraggingRef.current = false;
        panStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: viewport.x,
            originY: viewport.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const panState = panStateRef.current;
        if (!panState || panState.pointerId !== event.pointerId) {
            return;
        }
        const dx = event.clientX - panState.startX;
        const dy = event.clientY - panState.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            wasDraggingRef.current = true;
        }
        setViewport(prev => ({
            ...prev,
            x: panState.originX + dx,
            y: panState.originY + dy,
        }));
    };

    const endPan = useCallback((pointerId: number, target: EventTarget | null) => {
        const panState = panStateRef.current;
        if (!panState || panState.pointerId !== pointerId) {
            return;
        }
        const node = target as HTMLDivElement | null;
        node?.releasePointerCapture(pointerId);
        panStateRef.current = null;
    }, []);

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        endPan(event.pointerId, event.currentTarget);
    };

    const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
        endPan(event.pointerId, event.currentTarget);
    };

    const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const rect = container.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
        setViewport(prev => {
            const nextScale = clamp(prev.scale * scaleFactor, MIN_SCALE, MAX_SCALE);
            const originX = (offsetX - prev.x) / prev.scale;
            const originY = (offsetY - prev.y) / prev.scale;
            return {
                scale: nextScale,
                x: offsetX - originX * nextScale,
                y: offsetY - originY * nextScale,
            };
        });
    };

    const handlePersonSelect = useCallback(
        (personId: string, anchor: { x: number; y: number }) => {
            if (wasDraggingRef.current) {
                wasDraggingRef.current = false;
                return;
            }
            onSelectPerson(personId, anchor);
        },
        [onSelectPerson],
    );

    const handleUnionSelect = useCallback(
        (unionId: string, anchor: { x: number; y: number }) => {
            if (wasDraggingRef.current) {
                wasDraggingRef.current = false;
                return;
            }
            onSelectUnion(unionId, anchor);
        },
        [onSelectUnion],
    );

    return (
        <div
            ref={containerRef}
            className="genealogy-tree-view"
            onClick={handleBackgroundClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onWheel={handleWheel}
        >
            {layout.personNodes.length === 0 ? (
                <div className="empty-state">Start by adding a person to your tree.</div>
            ) : (
                <div
                    className="tree-canvas"
                    style={{
                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                        width: layout.width,
                        height: layout.height,
                    }}
                >
                    <svg className="tree-connections" width={layout.width} height={layout.height}>
                        {layout.edges.map(edge => (
                            <path
                                key={edge.id}
                                d={`M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}`}
                                stroke="#7f8c8d"
                                strokeWidth={2}
                                fill="none"
                            />
                        ))}
                    </svg>
                    {layout.unionNodes.map(node => (
                        <UnionNode
                            key={node.id}
                            id={node.id}
                            x={node.x}
                            y={node.y}
                            isSelected={selectedUnionId === node.id}
                            onSelect={handleUnionSelect}
                        />
                    ))}
                    {layout.personNodes.map(node => (
                        <PersonNode
                            key={node.person.id}
                            person={node.person}
                            x={node.x}
                            y={node.y}
                            width={node.width}
                            minHeight={node.height}
                            isSelected={selectedPersonId === node.person.id}
                            onSelect={handlePersonSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
};
