import { MouseEvent, memo, useMemo, useRef } from "react";
import { Person } from "../types";
import { getLifeSpanLabel } from "../utils/layout";

export type PersonNodeProps = {
    person: Person;
    x: number;
    y: number;
    width: number;
    minHeight: number;
    isSelected: boolean;
    onSelect: (personId: string, anchor: { x: number; y: number }) => void;
};

export const PersonNode = memo(({ person, x, y, width, minHeight, isSelected, onSelect }: PersonNodeProps) => {
    const ref = useRef<HTMLDivElement | null>(null);

    const lifeSpan = useMemo(() => {
        return getLifeSpanLabel(person);
    }, [person]);

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
