import { TreeData } from "../types";
import { computeTreeLayout, getLifeSpanLabel, UNION_NODE_SIZE } from "./layout";

const SVG_MARGIN = 160;
const NODE_PADDING = 16;
const FONT_FAMILY = "'Inter', 'Segoe UI', sans-serif";

export const renderTreeToSvg = (tree: TreeData, options?: { name?: string }): string => {
    const layout = computeTreeLayout(tree);
    const contentWidth = Math.max(layout.width, 1);
    const contentHeight = Math.max(layout.height, 1);
    const totalWidth = contentWidth + SVG_MARGIN * 2;
    const totalHeight = contentHeight + SVG_MARGIN * 2;
    const title = options?.name?.trim();

    const edgesSvg = layout.edges
        .map(edge => {
            return `<line x1="${edge.from.x}" y1="${edge.from.y}" x2="${edge.to.x}" y2="${edge.to.y}" stroke="#7f8c8d" stroke-width="2" fill="none" />`;
        })
        .join("\n");

    const unionSvg = layout.unionNodes
        .map(union => {
            const centerX = union.x + UNION_NODE_SIZE / 2;
            const centerY = union.y + UNION_NODE_SIZE / 2;
            return `<rect x="${union.x}" y="${union.y}" width="${UNION_NODE_SIZE}" height="${UNION_NODE_SIZE}" fill="#95a5a6" rx="4" ry="4" transform="rotate(45 ${centerX} ${centerY})" />`;
        })
        .join("\n");

    const personSvg = layout.personNodes
        .map(node => {
            const nameLine = `${node.person.firstName} ${node.person.lastName}`.trim();
            const lifeSpan = getLifeSpanLabel(node.person);
            const detailLines: string[] = [];
            if (node.person.birthPlace) {
                detailLines.push(...wrapText(`Born: ${node.person.birthPlace}`, node.width - NODE_PADDING * 2));
            }
            if (node.person.deathPlace) {
                detailLines.push(...wrapText(`Died: ${node.person.deathPlace}`, node.width - NODE_PADDING * 2));
            }

            let currentY = 28;
            const textParts: string[] = [];
            textParts.push(
                `<text x="${NODE_PADDING}" y="${currentY}" font-size="18" font-weight="700" fill="#22303f">${escapeXml(nameLine)}</text>`,
            );
            if (lifeSpan) {
                currentY += 22;
                textParts.push(
                    `<text x="${NODE_PADDING}" y="${currentY}" font-size="14" fill="#54657a">${escapeXml(lifeSpan)}</text>`,
                );
            }
            detailLines.forEach(line => {
                currentY += 20;
                textParts.push(
                    `<text x="${NODE_PADDING}" y="${currentY}" font-size="13" fill="#5f7289">${escapeXml(line)}</text>`,
                );
            });

            return `
<g transform="translate(${node.x} ${node.y})">
    <rect width="${node.width}" height="${node.height}" rx="12" ry="12" fill="rgba(255,255,255,0.95)" stroke="#c3d0e0" stroke-width="2" />
    ${textParts.join("\n    ")}
</g>`;
        })
        .join("\n");

    const titleSvg = title
        ? `<text x="${totalWidth / 2}" y="${SVG_MARGIN / 2}" font-size="28" font-weight="700" fill="#22303f" text-anchor="middle">${escapeXml(
              title,
          )}</text>`
        : "";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" preserveAspectRatio="xMidYMid meet">
    <defs>
        <style>
            text { font-family: ${FONT_FAMILY}; }
        </style>
    </defs>
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#ffffff" />
    ${titleSvg}
    <g transform="translate(${SVG_MARGIN} ${SVG_MARGIN})">
        <g stroke-linecap="round" stroke-linejoin="round">
${edgesSvg}
        </g>
${unionSvg}
${personSvg}
    </g>
</svg>`;

    return svg;
};

const escapeXml = (value: string) => {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");
};

const wrapText = (value: string, maxWidth: number): string[] => {
    if (!value) {
        return [];
    }
    const maxChars = Math.max(18, Math.floor(maxWidth / 8));
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    words.forEach(word => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    });
    if (current) {
        lines.push(current);
    }
    return lines;
};
