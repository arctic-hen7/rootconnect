export type UnionActionMenuProps = {
    position: { x: number; y: number };
    onAddChild: () => void;
};

export const UnionActionMenu = ({ position, onAddChild }: UnionActionMenuProps) => {
    return (
        <div className="contextual-action-menu" style={{ top: position.y, left: position.x }}>
            <button type="button" onClick={onAddChild}>
                Add Child
            </button>
        </div>
    );
};
