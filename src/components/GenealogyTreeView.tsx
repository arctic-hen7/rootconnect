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
import { PersonNode, measurePersonNode } from "./PersonNode";
import { UnionNode, UNION_NODE_SIZE } from "./UnionNode";
import { Person, TreeData } from "../types";

export type GenealogyTreeViewProps = {
    selectedPersonId: string | null;
    selectedUnionId: string | null;
    onSelectPerson: (personId: string, position: { x: number; y: number }) => void;
    onSelectUnion: (unionId: string, position: { x: number; y: number }) => void;
    onClearSelection: () => void;
};

type PersonLayoutNode = {
    person: Person;
    x: number;
    y: number;
    width: number;
    height: number;
};

type UnionLayoutNode = {
    id: string;
    partners: [string, string];
    x: number;
    y: number;
    children: string[];
};

type LayoutEdge = {
    id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
};

type TreeLayout = {
    personNodes: PersonLayoutNode[];
    unionNodes: UnionLayoutNode[];
    edges: LayoutEdge[];
    width: number;
    height: number;
};

const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 180;
const CANVAS_PADDING = 160;
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

    const layout = useMemo(() => computeLayout(tree), [tree]);

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

const computeLayout = (tree: TreeData): TreeLayout => {
    const people = Object.values(tree.people);
    if (people.length === 0) {
        return { personNodes: [], unionNodes: [], edges: [], width: 0, height: 0 };
    }

    const sizeMap = new Map<string, { width: number; height: number }>();
    people.forEach(person => {
        sizeMap.set(person.id, measurePersonNode(person));
    });

    const rootId = tree.rootPersonId ?? people[0].id;
    const { depthMap, orderMap } = computePlacementMaps(tree, rootId);

    const levelGroups = new Map<number, string[]>();
    depthMap.forEach((depth, id) => {
        const group = levelGroups.get(depth);
        if (group) {
            group.push(id);
        } else {
            levelGroups.set(depth, [id]);
        }
    });

    const sortedLevels = Array.from(levelGroups.entries()).sort((a, b) => a[0] - b[0]);
    const personNodes: PersonLayoutNode[] = [];
    const positionMap = new Map<string, PersonLayoutNode>();
    let currentY = CANVAS_PADDING;
    let maxRowWidth = 0;

    sortedLevels.forEach(([level, ids]) => {
        ids.sort((a, b) => {
            const orderA = orderMap.get(a) ?? 0;
            const orderB = orderMap.get(b) ?? 0;
            return orderA - orderB;
        });
        const levelOrder: string[] = [];
        const taken = new Set<string>();
        ids.forEach(id => {
            if (taken.has(id)) {
                return;
            }
            levelOrder.push(id);
            taken.add(id);
            const person = tree.people[id];
            if (!person) {
                return;
            }
            person.spouses
                .map(spouse => tree.people[spouse.spouseId])
                .filter(
                    partner =>
                        partner &&
                        !taken.has(partner.id) &&
                        (depthMap.get(partner.id) ?? 0) === level,
                )
                .forEach(partner => {
                    taken.add(partner.id);
                    levelOrder.push(partner.id);
                });
        });
        let currentX = CANVAS_PADDING;
        let levelMaxHeight = 0;
        levelOrder.forEach(id => {
            const person = tree.people[id];
            if (!person) {
                return;
            }
            const size = sizeMap.get(id) ?? { width: 220, height: 140 };
            const node: PersonLayoutNode = {
                person,
                x: currentX,
                y: currentY,
                width: size.width,
                height: size.height,
            };
            personNodes.push(node);
            positionMap.set(id, node);
            currentX += size.width + HORIZONTAL_GAP;
            if (size.height > levelMaxHeight) {
                levelMaxHeight = size.height;
            }
        });
        if (currentX > maxRowWidth) {
            maxRowWidth = currentX;
        }
        currentY += levelMaxHeight + VERTICAL_GAP;
    });

    const unionNodes: UnionLayoutNode[] = [];
    const edges: LayoutEdge[] = [];
    const processedUnions = new Set<string>();
    const unionChildLinks = new Set<string>();

    people.forEach(person => {
        person.spouses.forEach(spouse => {
            if (processedUnions.has(spouse.unionId)) {
                return;
            }
            const partner = tree.people[spouse.spouseId];
            if (!partner) {
                return;
            }
            const partnerNode = positionMap.get(partner.id);
            const personNode = positionMap.get(person.id);
            if (!partnerNode || !personNode) {
                return;
            }
            processedUnions.add(spouse.unionId);
            const unionCenterX =
                (personNode.x + personNode.width / 2 + partnerNode.x + partnerNode.width / 2) / 2;
            const unionCenterY =
                (personNode.y + personNode.height / 2 + partnerNode.y + partnerNode.height / 2) / 2;
            const children = findUnionChildren(tree, person.id, partner.id);
            const unionNode: UnionLayoutNode = {
                id: spouse.unionId,
                partners: [person.id, partner.id],
                x: unionCenterX - UNION_NODE_SIZE / 2,
                y: unionCenterY - UNION_NODE_SIZE / 2,
                children,
            };
            unionNodes.push(unionNode);
            const unionCenter = { x: unionCenterX, y: unionCenterY };
            const parentCenters = [
                {
                    x: personNode.x + personNode.width / 2,
                    y: personNode.y + personNode.height / 2,
                },
                {
                    x: partnerNode.x + partnerNode.width / 2,
                    y: partnerNode.y + partnerNode.height / 2,
                },
            ];
            parentCenters.forEach((center, index) => {
                edges.push({
                    id: `${unionNode.id}-partner-${index}`,
                    from: center,
                    to: unionCenter,
                });
            });
            unionNode.children.forEach(childId => {
                const childNode = positionMap.get(childId);
                if (!childNode) {
                    return;
                }
                edges.push({
                    id: `${unionNode.id}-child-${childId}`,
                    from: {
                        x: unionCenter.x,
                        y: unionCenter.y + UNION_NODE_SIZE / 2,
                    },
                    to: {
                        x: childNode.x + childNode.width / 2,
                        y: childNode.y,
                    },
                });
                unionChildLinks.add(`${person.id}-${childId}`);
                unionChildLinks.add(`${partner.id}-${childId}`);
            });
        });
    });

    people.forEach(parent => {
        const parentNode = positionMap.get(parent.id);
        if (!parentNode) {
            return;
        }
        parent.children.forEach(childId => {
            if (unionChildLinks.has(`${parent.id}-${childId}`)) {
                return;
            }
            const childNode = positionMap.get(childId);
            if (!childNode) {
                return;
            }
            edges.push({
                id: `direct-${parent.id}-${childId}`,
                from: {
                    x: parentNode.x + parentNode.width / 2,
                    y: parentNode.y + parentNode.height,
                },
                to: {
                    x: childNode.x + childNode.width / 2,
                    y: childNode.y,
                },
            });
        });
    });

    let maxX = 0;
    let maxY = 0;
    personNodes.forEach(node => {
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });
    unionNodes.forEach(node => {
        maxX = Math.max(maxX, node.x + UNION_NODE_SIZE);
        maxY = Math.max(maxY, node.y + UNION_NODE_SIZE);
    });

    return {
        personNodes,
        unionNodes,
        edges,
        width: Math.max(maxRowWidth + CANVAS_PADDING, maxX + CANVAS_PADDING),
        height: maxY + CANVAS_PADDING,
    };
};

const computePlacementMaps = (tree: TreeData, rootId: string) => {
    const depthMap = new Map<string, number>();
    const orderMap = new Map<string, number>();
    const visited = new Set<string>();
    const queue: string[] = [];
    let orderCounter = 0;

    depthMap.set(rootId, 0);
    orderMap.set(rootId, orderCounter++);
    visited.add(rootId);
    queue.push(rootId);

    while (queue.length > 0) {
        const currentId = queue.shift() as string;
        const currentDepth = depthMap.get(currentId) as number;
        const person = tree.people[currentId];
        if (!person) {
            continue;
        }
        const neighbors: Array<{ id: string; depthDelta: number }> = [];
        person.children.forEach(childId => {
            neighbors.push({ id: childId, depthDelta: 1 });
        });
        person.parents.forEach(parentId => {
            neighbors.push({ id: parentId, depthDelta: -1 });
        });
        person.spouses.forEach(spouse => {
            neighbors.push({ id: spouse.spouseId, depthDelta: 0 });
        });

        neighbors.forEach(({ id, depthDelta }) => {
            const nextDepth = currentDepth + depthDelta;
            if (!depthMap.has(id)) {
                depthMap.set(id, nextDepth);
            }
            if (!visited.has(id)) {
                visited.add(id);
                orderMap.set(id, orderCounter++);
                queue.push(id);
            }
        });
    }

    Object.keys(tree.people).forEach(id => {
        if (!depthMap.has(id)) {
            depthMap.set(id, 0);
        }
        if (!orderMap.has(id)) {
            orderMap.set(id, orderCounter++);
        }
    });

    return { depthMap, orderMap };
};

const findUnionChildren = (tree: TreeData, parentAId: string, parentBId: string) => {
    return Object.values(tree.people)
        .filter(person => person.parents.includes(parentAId) && person.parents.includes(parentBId))
        .map(person => person.id);
};
