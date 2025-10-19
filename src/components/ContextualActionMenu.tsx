export type ContextualActionMenuProps = {
    position: { x: number; y: number };
    onEdit: () => void;
    onAddParent: () => void;
    onAddSpouse: () => void;
    onDelete: () => void;
};

export const ContextualActionMenu = ({ position, onEdit, onAddParent, onAddSpouse, onDelete }: ContextualActionMenuProps) => {
    return (
        <div className="contextual-action-menu" style={{ top: position.y, left: position.x }}>
            <button type="button" onClick={onEdit}>
                Edit Details
            </button>
            <button type="button" onClick={onAddParent}>
                Add Parent
            </button>
            <button type="button" onClick={onAddSpouse}>
                Add Spouse
            </button>
            <button type="button" className="destructive" onClick={onDelete}>
                Delete Person
            </button>
        </div>
    );
};
