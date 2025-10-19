import { useMemo, useState } from "react";
import { useTreeContext } from "../state/TreeContext";
import { GenealogyTreeView } from "./GenealogyTreeView";
import { resolveUnionPartners, isDescendant } from "../utils/treeHelpers";

export type ParentSelectorModalProps = {
    childId: string;
    onSelectParents: (parentIds: string[]) => void;
    onCancel: () => void;
};

export const ParentSelectorModal = ({ childId, onSelectParents, onCancel }: ParentSelectorModalProps) => {
    const { tree } = useTreeContext();
    const child = tree.people[childId];
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [selectedUnionId, setSelectedUnionId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const currentParents = useMemo(() => {
        return (child?.parents ?? []).map(parentId => {
            const person = tree.people[parentId];
            if (!person) {
                return "Unknown";
            }
            return `${person.firstName} ${person.lastName}`.trim();
        });
    }, [child?.parents, tree.people]);

    if (!child) {
        return null;
    }

    const handleSelectPerson = (personId: string) => {
        setErrorMessage(null);
        setSelectedUnionId(null);
        setSelectedPersonId(personId);
    };

    const handleSelectUnion = (unionId: string) => {
        setErrorMessage(null);
        setSelectedPersonId(null);
        setSelectedUnionId(unionId);
    };

    const handleClearSelection = () => {
        setSelectedPersonId(null);
        setSelectedUnionId(null);
        setErrorMessage(null);
    };

    const handleConfirm = () => {
        let nextParentIds: string[] = [];
        if (selectedUnionId) {
            nextParentIds = resolveUnionPartners(tree, selectedUnionId);
            if (nextParentIds.length === 0) {
                setErrorMessage("Selected union has no partners to assign.");
                return;
            }
        } else if (selectedPersonId) {
            nextParentIds = [selectedPersonId];
        }

        if (nextParentIds.includes(childId)) {
            setErrorMessage("A person cannot be their own parent.");
            return;
        }

        const invalidAncestor = nextParentIds.find(parentId => isDescendant(tree, childId, parentId));
        if (invalidAncestor) {
            setErrorMessage("Cannot assign a descendant as a parent.");
            return;
        }

        onSelectParents(nextParentIds);
    };

    const selectedLabel = useMemo(() => {
        if (selectedUnionId) {
            const partners = resolveUnionPartners(tree, selectedUnionId);
            if (partners.length === 0) {
                return "Union has no partners";
            }
            const labels = partners.map(partnerId => {
                const partner = tree.people[partnerId];
                if (!partner) {
                    return "Unknown";
                }
                return `${partner.firstName} ${partner.lastName}`.trim();
            });
            return labels.join(" & ");
        }
        if (selectedPersonId) {
            const person = tree.people[selectedPersonId];
            if (!person) {
                return "Unknown";
            }
            return `${person.firstName} ${person.lastName}`.trim();
        }
        return "None";
    }, [selectedPersonId, selectedUnionId, tree]);

    return (
        <div className="parent-selector-backdrop" role="presentation">
            <div className="parent-selector-modal">
                <div className="parent-selector-header">
                    <h2>Reassign Parents</h2>
                    <p>
                        Select a person or union node to assign as a parent. Selecting a union will link both partners. Use
                        “Assign Parents” to apply or “Clear Selection” to remove all parents.
                    </p>
                    <div className="parent-selector-summary">
                        <div>
                            <strong>Child:</strong> {`${child.firstName} ${child.lastName}`.trim()}
                        </div>
                        <div>
                            <strong>Current Parents:</strong> {currentParents.length > 0 ? currentParents.join(", ") : "None"}
                        </div>
                        <div>
                            <strong>Selected:</strong> {selectedLabel}
                        </div>
                    </div>
                    {errorMessage ? <div className="parent-selector-error">{errorMessage}</div> : null}
                </div>
                <div className="parent-selector-tree">
                    <GenealogyTreeView
                        selectedPersonId={selectedPersonId}
                        selectedUnionId={selectedUnionId}
                        onSelectPerson={(personId, _anchor) => handleSelectPerson(personId)}
                        onSelectUnion={(unionId, _anchor) => handleSelectUnion(unionId)}
                        onClearSelection={handleClearSelection}
                    />
                </div>
                <div className="parent-selector-actions">
                    <button type="button" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" onClick={handleClearSelection}>
                        Clear Selection
                    </button>
                    <button type="button" className="primary" onClick={handleConfirm}>
                        Assign Parents
                    </button>
                </div>
            </div>
        </div>
    );
};
