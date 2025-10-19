import { Person, TreeData } from "../types";

export type PersonLayoutNode = {
    person: Person;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type UnionLayoutNode = {
    id: string;
    partners: [string, string];
    x: number;
    y: number;
    children: string[];
};

export type LayoutEdge = {
    id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
};

export type TreeLayout = {
    personNodes: PersonLayoutNode[];
    unionNodes: UnionLayoutNode[];
    edges: LayoutEdge[];
    width: number;
    height: number;
};

const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 180;
const CANVAS_PADDING = 160;

export const UNION_NODE_SIZE = 24;

const BASE_HEIGHT = 100;
const MIN_WIDTH = 220;
const MAX_WIDTH = 320;
const CHARACTER_WIDTH = 8;
const LINE_HEIGHT = 24;

export const measurePersonNode = (person: Person) => {
    const nameLine = `${person.firstName} ${person.lastName}`.trim();
    const birthLine = person.birthPlace ? `Born: ${person.birthPlace}` : "";
    const deathLine = person.deathPlace ? `Died: ${person.deathPlace}` : "";
    const longestLine = Math.max(nameLine.length, birthLine.length, deathLine.length, 18);
    const estimatedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longestLine * 7));
    const baseLines = 2;
    const birthLines = estimateWrappedLines(birthLine, estimatedWidth);
    const deathLines = estimateWrappedLines(deathLine, estimatedWidth);
    const totalLines = baseLines + birthLines + deathLines;
    const height = Math.max(BASE_HEIGHT, totalLines * LINE_HEIGHT);
    return {
        width: estimatedWidth,
        height,
    };
};

export const computeTreeLayout = (tree: TreeData): TreeLayout => {
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
        const entries = levelGroups.get(depth);
        if (entries) {
            entries.push(id);
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
        const ordered: string[] = [];
        const taken = new Set<string>();
        ids.forEach(id => {
            if (taken.has(id)) {
                return;
            }
            ordered.push(id);
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
                    ordered.push(partner.id);
                });
        });

        let currentX = CANVAS_PADDING;
        let levelMaxHeight = 0;
        ordered.forEach(id => {
            const person = tree.people[id];
            if (!person) {
                return;
            }
            const size = sizeMap.get(id) ?? { width: MIN_WIDTH, height: BASE_HEIGHT };
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
            const personNode = positionMap.get(person.id);
            const partnerNode = positionMap.get(partner.id);
            if (!personNode || !partnerNode) {
                return;
            }
            processedUnions.add(spouse.unionId);
            const unionCenterX = (personNode.x + personNode.width / 2 + partnerNode.x + partnerNode.width / 2) / 2;
            const unionCenterY = (personNode.y + personNode.height / 2 + partnerNode.y + partnerNode.height / 2) / 2;
            const partners: [string, string] = [person.id, partner.id];
            const children = findUnionChildren(tree, person.id, partner.id);
            const unionNode: UnionLayoutNode = {
                id: spouse.unionId,
                partners,
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
                unionChildLinks.add(`${partners[0]}-${childId}`);
                unionChildLinks.add(`${partners[1]}-${childId}`);
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

export const formatYear = (value: string | null | undefined) => {
    if (!value) {
        return "";
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value.slice(0, 4);
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return value.slice(6);
    }
    return "";
};

export const getLifeSpanLabel = (person: Person) => {
    const birth = formatYear(person.birthDate);
    const death = formatYear(person.deathDate);
    if (birth && death) {
        return `${birth} – ${death}`;
    }
    if (birth && !death) {
        return `${birth} –`;
    }
    if (!birth && death) {
        return `– ${death}`;
    }
    return "";
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

const estimateWrappedLines = (content: string, width: number) => {
    if (!content) {
        return 0;
    }
    const effectiveCharsPerLine = Math.max(18, Math.floor(width / CHARACTER_WIDTH));
    return Math.ceil(content.length / effectiveCharsPerLine);
};
