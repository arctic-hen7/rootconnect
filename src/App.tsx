import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import "./index.css";
import { TreeProvider } from "./state/TreeContext";
import { treeReducer, EMPTY_TREE } from "./state/treeReducer";
import { GenealogyTreeView } from "./components/GenealogyTreeView";
import { Toolbar } from "./components/Toolbar";
import { ContextualActionMenu } from "./components/ContextualActionMenu";
import { UnionActionMenu } from "./components/UnionActionMenu";
import { PersonEditorModal, PersonEditorMode, PersonEditorSubmitPayload } from "./components/PersonEditorModal";
import { Person } from "./types";
import { loadTreeData, saveTreeData } from "./utils/indexedDb";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import { resolveDefaultPartnerIds, resolveUnionPartners } from "./utils/treeHelpers";
import { renderTreeToSvg } from "./utils/svgExport";
import { ParentSelectorModal } from "./components/ParentSelectorModal";

type ModalState = {
    mode: PersonEditorMode;
    targetPersonId?: string;
    targetUnionId?: string;
};

type SelectedEntity =
    | { type: "person"; id: string; anchor: { x: number; y: number } }
    | { type: "union"; id: string; anchor: { x: number; y: number } }
    | null;

const createPersonFromForm = (id: string, form: PersonEditorSubmitPayload): Person => {
    const trimOrEmpty = (value: string) => value.trim();
    const trimOrNull = (value: string) => {
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
    };
    return {
        id,
        firstName: trimOrEmpty(form.firstName),
        lastName: trimOrEmpty(form.lastName),
        birthDate: form.birthDate ?? null,
        birthPlace: trimOrEmpty(form.birthPlace),
        deathDate: form.deathDate ?? null,
        deathPlace: trimOrNull(form.deathPlace),
        gender: trimOrEmpty(form.gender),
        notes: trimOrEmpty(form.notes),
        parents: [],
        spouses: [],
        children: [],
    };
};

export function App() {
    const [tree, dispatch] = useReducer(treeReducer, EMPTY_TREE);
    const [selection, setSelection] = useState<SelectedEntity>(null);
    const [modalState, setModalState] = useState<ModalState | null>(null);
    const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
    const [parentSelector, setParentSelector] = useState<{ childId: string } | null>(null);

    const debouncedSave = useDebouncedCallback((nextTree: typeof tree) => {
        void saveTreeData(nextTree);
    }, 500);

    useEffect(() => {
        let isMounted = true;
        void loadTreeData()
            .then(data => {
                if (data && isMounted) {
                    dispatch({ type: "SET_TREE", payload: data });
                }
            })
            .finally(() => {
                if (isMounted) {
                    setHasLoadedFromStorage(true);
                }
            });
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!hasLoadedFromStorage) {
            return;
        }
        debouncedSave(tree);
    }, [tree, hasLoadedFromStorage, debouncedSave]);

    const treeContextValue = useMemo(
        () => ({
            tree,
            dispatch,
        }),
        [tree, dispatch],
    );

    const handleSelectPerson = useCallback((personId: string, anchor: { x: number; y: number }) => {
        setSelection({ type: "person", id: personId, anchor });
    }, []);

    const handleSelectUnion = useCallback((unionId: string, anchor: { x: number; y: number }) => {
        setSelection({ type: "union", id: unionId, anchor });
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelection(null);
    }, []);

    const openModal = (mode: PersonEditorMode, targetId?: string, unionId?: string) => {
        setModalState({ mode, targetPersonId: targetId, targetUnionId: unionId });
    };

    const closeModal = () => {
        setModalState(null);
    };

    const handleToolbarAddPerson = () => {
        openModal("CREATE_NEW");
    };

    const handleToolbarNewTree = () => {
        const confirmReset = window.confirm("This will clear the current tree. Continue?");
        if (!confirmReset) {
            return;
        }
        dispatch({ type: "SET_TREE", payload: EMPTY_TREE });
        setSelection(null);
    };

    const handleToolbarLoadFromFile = async (file: File) => {
        const text = await file.text();
        try {
            const parsed = JSON.parse(text) as unknown;
            const isValid = validateTreeDataShape(parsed);
            if (!isValid) {
                window.alert("The selected file is not a valid tree.");
                return;
            }
            const confirmReplace = window.confirm("Loading will replace the current tree. Continue?");
            if (!confirmReplace) {
                return;
            }
            dispatch({ type: "SET_TREE", payload: parsed });
            setSelection(null);
        } catch (error) {
            console.error("Failed to load tree file:", error);
            window.alert("Unable to load the selected file.");
        }
    };

    const handleToolbarSaveToFile = () => {
        const blob = new Blob([JSON.stringify(tree, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const element = document.createElement("a");
        element.href = url;
        element.download = "family-tree.gntree";
        element.click();
        URL.revokeObjectURL(url);
    };

    const handleToolbarPrint = () => {
        const svgContent = renderTreeToSvg(tree);
        const printerWindow = window.open("", "_blank", "noopener,noreferrer");
        if (!printerWindow) {
            const blob = new Blob([svgContent], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "family-tree.svg";
            link.click();
            URL.revokeObjectURL(url);
            return;
        }
        const printMarkup = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Genealogy Tree</title>
    <style>
        @page { size: landscape; margin: 1cm; }
        html, body { margin: 0; background: #ffffff; }
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        svg { max-width: 100%; height: auto; }
    </style>
</head>
<body>
${svgContent}
<script>
    window.onload = function () {
        setTimeout(function () {
            window.focus();
            window.print();
        }, 100);
    };
    window.onafterprint = function () {
        window.close();
    };
</script>
</body>
</html>`;
        printerWindow.document.open();
        printerWindow.document.write(printMarkup);
        printerWindow.document.close();
    };

    const selectedPersonId = selection?.type === "person" ? selection.id : null;
    const selectedUnionId = selection?.type === "union" ? selection.id : null;
    const menuAnchor = selection?.anchor ?? null;
    const selectedPerson = selectedPersonId ? tree.people[selectedPersonId] : undefined;

    const handleModalSubmit = (form: PersonEditorSubmitPayload) => {
        if (!modalState) {
            return;
        }
        let shouldClearSelection = modalState.mode !== "EDIT";
        switch (modalState.mode) {
            case "CREATE_NEW": {
                const id = crypto.randomUUID();
                const person = createPersonFromForm(id, form);
                dispatch({ type: "UPSERT_PERSON", payload: person });
                if (!tree.rootPersonId) {
                    dispatch({ type: "SET_ROOT_PERSON", payload: id });
                }
                break;
            }
            case "EDIT": {
                shouldClearSelection = false;
                if (!modalState.targetPersonId) {
                    break;
                }
                const existing = tree.people[modalState.targetPersonId];
                if (!existing) {
                    break;
                }
                const updated: Person = {
                    ...existing,
                    firstName: form.firstName.trim(),
                    lastName: form.lastName.trim(),
                    birthDate: form.birthDate ?? null,
                    birthPlace: form.birthPlace.trim(),
                    deathDate: form.deathDate ?? null,
                    deathPlace: form.deathPlace.trim().length > 0 ? form.deathPlace.trim() : null,
                    gender: form.gender.trim(),
                    notes: form.notes.trim(),
                };
                dispatch({ type: "UPSERT_PERSON", payload: updated });
                break;
            }
            case "ADD_PARENT": {
                const childId = modalState.targetPersonId;
                if (!childId) {
                    break;
                }
                const child = tree.people[childId];
                if (!child) {
                    break;
                }
                const id = crypto.randomUUID();
                const parent = createPersonFromForm(id, form);
                dispatch({ type: "UPSERT_PERSON", payload: parent });
                dispatch({ type: "LINK_PARENT_CHILD", payload: { parentId: id, childId: child.id } });
                break;
            }
            case "ADD_CHILD": {
                const parentId = modalState.targetPersonId;
                if (!parentId) {
                    break;
                }
                const parent = tree.people[parentId];
                if (!parent) {
                    break;
                }
                const id = crypto.randomUUID();
                const child = createPersonFromForm(id, form);
                const partnerIds = resolveDefaultPartnerIds(tree, parentId);
                child.parents = partnerIds.length > 0 ? partnerIds : [parent.id];
                dispatch({ type: "UPSERT_PERSON", payload: child });
                dispatch({ type: "LINK_PARENT_CHILD", payload: { parentId: parent.id, childId: id } });
                partnerIds
                    .filter(partnerId => partnerId !== parent.id)
                    .forEach(partnerId => {
                        dispatch({ type: "LINK_PARENT_CHILD", payload: { parentId: partnerId, childId: id } });
                    });
                break;
            }
            case "ADD_CHILD_UNION": {
                const unionId = modalState.targetUnionId;
                if (!unionId) {
                    break;
                }
                const partners = resolveUnionPartners(tree, unionId);
                if (!partners || partners.length === 0) {
                    window.alert("Could not determine the parents for this union.");
                    break;
                }
                const id = crypto.randomUUID();
                const child = createPersonFromForm(id, form);
                child.parents = partners;
                dispatch({ type: "UPSERT_PERSON", payload: child });
                partners.forEach(parentId => {
                    dispatch({ type: "LINK_PARENT_CHILD", payload: { parentId, childId: id } });
                });
                break;
            }
            case "ADD_SPOUSE": {
                const targetPersonId = modalState.targetPersonId;
                if (!targetPersonId) {
                    break;
                }
                const primary = tree.people[targetPersonId];
                if (!primary) {
                    break;
                }
                const id = crypto.randomUUID();
                const spouse = createPersonFromForm(id, form);
                dispatch({ type: "UPSERT_PERSON", payload: spouse });
                const unionId = crypto.randomUUID();
                dispatch({
                    type: "LINK_SPOUSE",
                    payload: {
                        personId: primary.id,
                        spouseId: spouse.id,
                        marriageDate: form.marriageDate ?? null,
                        unionId,
                    },
                });
                break;
            }
            default:
                break;
        }
        if (shouldClearSelection) {
            setSelection(null);
        }
        setModalState(null);
    };

    const handleShowEdit = () => {
        if (!selectedPersonId) {
            return;
        }
        openModal("EDIT", selectedPersonId);
    };

    const handleShowAddParent = () => {
        if (!selectedPersonId) {
            return;
        }
        openModal("ADD_PARENT", selectedPersonId);
    };

    const handleShowAddSpouse = () => {
        if (!selectedPersonId) {
            return;
        }
        openModal("ADD_SPOUSE", selectedPersonId);
    };

    const handleShowAddChildFromUnion = () => {
        if (!selectedUnionId) {
            return;
        }
        openModal("ADD_CHILD_UNION", undefined, selectedUnionId);
    };

    const handleStartParentReassignment = () => {
        if (!selectedPersonId) {
            return;
        }
        setModalState(null);
        setParentSelector({ childId: selectedPersonId });
    };

    const handleDeletePerson = () => {
        if (!selectedPersonId) {
            return;
        }
        const person = tree.people[selectedPersonId];
        if (!person) {
            return;
        }
        const personName = `${person.firstName} ${person.lastName}`.trim() || "this person";
        const confirmDelete = window.confirm(
            `Delete ${personName}? This will remove their relationships with parents, spouses, and children.`,
        );
        if (!confirmDelete) {
            return;
        }
        dispatch({ type: "DELETE_PERSON", payload: { personId: selectedPersonId } });
        setSelection(null);
    };

    const handleApplyParentSelection = (parentIds: string[]) => {
        if (!parentSelector) {
            return;
        }
        dispatch({ type: "REASSIGN_PARENTS", payload: { childId: parentSelector.childId, parentIds } });
        setParentSelector(null);
    };

    const handleCancelParentSelection = () => {
        setParentSelector(null);
    };

    const unionSummary = useMemo(() => {
        if (!modalState || modalState.mode !== "ADD_CHILD_UNION" || !modalState.targetUnionId) {
            return undefined;
        }
        const partners = resolveUnionPartners(tree, modalState.targetUnionId);
        if (partners.length === 0) {
            return undefined;
        }
        const partnerNames = partners
            .map(id => {
                const person = tree.people[id];
                if (!person) {
                    return "Unknown";
                }
                return `${person.firstName} ${person.lastName}`.trim();
            })
            .join(" & ");
        return `Parents: ${partnerNames}`;
    }, [modalState, tree]);

    return (
        <TreeProvider value={treeContextValue}>
            <div className="app">
                <Toolbar
                    onNewTree={handleToolbarNewTree}
                    onAddPerson={handleToolbarAddPerson}
                    onLoadFromFile={handleToolbarLoadFromFile}
                    onSaveToFile={handleToolbarSaveToFile}
                    onPrint={handleToolbarPrint}
                />
                <div className="tree-pane">
                    <GenealogyTreeView
                        selectedPersonId={selectedPersonId}
                        selectedUnionId={selectedUnionId}
                        onSelectPerson={handleSelectPerson}
                        onSelectUnion={handleSelectUnion}
                        onClearSelection={handleClearSelection}
                    />
                    {selectedPerson && menuAnchor ? (
                        <ContextualActionMenu
                            position={menuAnchor}
                            onEdit={handleShowEdit}
                            onAddParent={handleShowAddParent}
                            onAddSpouse={handleShowAddSpouse}
                            onDelete={handleDeletePerson}
                        />
                    ) : null}
                    {selection?.type === "union" && menuAnchor ? (
                        <UnionActionMenu position={menuAnchor} onAddChild={handleShowAddChildFromUnion} />
                    ) : null}
                </div>
                {modalState ? (
                    <PersonEditorModal
                        mode={modalState.mode}
                        person={
                            modalState.targetPersonId && modalState.mode !== "CREATE_NEW"
                                ? tree.people[modalState.targetPersonId]
                                : undefined
                        }
                        unionSummary={unionSummary}
                        onClose={closeModal}
                        onSubmit={handleModalSubmit}
                        onReassignParents={modalState.mode === "EDIT" ? handleStartParentReassignment : undefined}
                    />
                ) : null}
                {parentSelector ? (
                    <ParentSelectorModal
                        childId={parentSelector.childId}
                        onCancel={handleCancelParentSelection}
                        onSelectParents={handleApplyParentSelection}
                    />
                ) : null}
            </div>
        </TreeProvider>
    );
}

const validateTreeDataShape = (data: unknown): data is typeof EMPTY_TREE => {
    if (!data || typeof data !== "object") {
        return false;
    }
    const maybeTree = data as Record<string, unknown>;
    if (!("people" in maybeTree) || typeof maybeTree.people !== "object" || maybeTree.people === null) {
        return false;
    }
    return true;
};

export default App;
