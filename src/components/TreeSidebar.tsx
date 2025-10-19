import { StoredTree } from "../types";

export type TreeSidebarProps = {
    trees: StoredTree[];
    activeTreeId: string | null;
    onSelect: (treeId: string) => void;
    onCreate: () => void;
    onRename: (treeId: string) => void;
    onDelete: (treeId: string) => void;
};

export const TreeSidebar = ({ trees, activeTreeId, onSelect, onCreate, onRename, onDelete }: TreeSidebarProps) => {
    return (
        <aside className="tree-sidebar">
            <div className="tree-sidebar-brand">
                <span className="brand-root">Root</span>
                <span className="brand-connect">Connect</span>
            </div>
            <div className="tree-sidebar-header">
                <h2>Your Trees</h2>
                <button type="button" onClick={onCreate}>
                    New Tree
                </button>
            </div>
            <ul className="tree-sidebar-list">
                {trees.length === 0 ? <li className="empty">No trees yet</li> : null}
                {trees.map(tree => (
                    <li
                        key={tree.id}
                        className={`tree-sidebar-item ${tree.id === activeTreeId ? "active" : ""}`}
                    >
                        <button type="button" className="tree-sidebar-select" onClick={() => onSelect(tree.id)}>
                            <span className="name">{tree.name}</span>
                            <span className="timestamp">{formatTimestamp(tree.updatedAt)}</span>
                        </button>
                        <div className="tree-sidebar-actions">
                            <button type="button" onClick={() => onRename(tree.id)}>
                                Rename
                            </button>
                            <button type="button" className="destructive" onClick={() => onDelete(tree.id)}>
                                Remove
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </aside>
    );
};

const formatTimestamp = (value: string) => {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};
