import { MouseEvent, memo, useMemo, useRef } from "react";
import { Person } from "../types";

export type PersonNodeProps = {
    person: Person;
    x: number;
    y: number;
    width: number;
    minHeight: number;
    isSelected: boolean;
    onSelect: (personId: string, anchor: { x: number; y: number }) => void;
};

const formatYear = (value: string | null | undefined) => {
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

export const PersonNode = memo(({ person, x, y, width, minHeight, isSelected, onSelect }: PersonNodeProps) => {
    const ref = useRef<HTMLDivElement | null>(null);

    const lifeSpan = useMemo(() => {
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
    }, [person.birthDate, person.deathDate]);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        const element = ref.current;
        if (!element) {
            return;
        }
        const rect = element.getBoundingClientRect();
        onSelect(person.id, {
            x: rect.right + 16,
            y: rect.top,
        });
    };

    return (
        <div
            ref={ref}
            className={`person-node ${isSelected ? "person-node-selected" : ""}`}
            style={{
                left: x,
                top: y,
                width,
                minHeight,
            }}
            onPointerDown={event => event.stopPropagation()}
            onClick={handleClick}
        >
            <div className="person-node-name">
                {person.firstName} {person.lastName}
            </div>
            <div className="person-node-dates">{lifeSpan}</div>
            <div className="person-node-details">
                {person.birthPlace ? <div>Born: {person.birthPlace}</div> : null}
                {person.deathPlace ? <div>Died: {person.deathPlace}</div> : null}
            </div>
        </div>
    );
});

PersonNode.displayName = "PersonNode";

const BASE_HEIGHT = 100;
const BASE_WIDTH = 220;
const MAX_WIDTH = 320;
const MIN_WIDTH = 220;
const CHARACTER_WIDTH = 8;
const LINE_HEIGHT = 24;

const estimateLineCount = (content: string, width: number) => {
    if (!content) {
        return 0;
    }
    const effectiveCharsPerLine = Math.max(18, Math.floor(width / CHARACTER_WIDTH));
    return Math.ceil(content.length / effectiveCharsPerLine);
};

export const measurePersonNode = (person: Person) => {
    const nameLine = `${person.firstName} ${person.lastName}`.trim();
    const birthLine = person.birthPlace ? `Born: ${person.birthPlace}` : "";
    const deathLine = person.deathPlace ? `Died: ${person.deathPlace}` : "";
    const longestLine = Math.max(nameLine.length, birthLine.length, deathLine.length, 18);
    const estimatedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longestLine * 7));
    const baseLines = 2; // name + lifespan
    const birthLines = estimateLineCount(birthLine, estimatedWidth);
    const deathLines = estimateLineCount(deathLine, estimatedWidth);
    const totalLines = baseLines + birthLines + deathLines;
    const height = Math.max(BASE_HEIGHT, totalLines * LINE_HEIGHT);
    return {
        width: estimatedWidth,
        height,
    };
};
