import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import "./index.css";
import { TreeProvider } from "./state/TreeContext";
import { treeReducer, EMPTY_TREE } from "./state/treeReducer";
import { GenealogyTreeView } from "./components/GenealogyTreeView";
import { Toolbar } from "./components/Toolbar";
import { ContextualActionMenu } from "./components/ContextualActionMenu";
import { UnionActionMenu } from "./components/UnionActionMenu";
import { PersonEditorModal, PersonEditorMode, PersonEditorSubmitPayload } from "./components/PersonEditorModal";
import { Person, StoredTree, TreeData } from "./types";
import { loadTreeCollection, saveTreeCollection, LoadedCollection } from "./utils/indexedDb";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import { resolveDefaultPartnerIds, resolveUnionPartners } from "./utils/treeHelpers";
import { renderTreeToSvg } from "./utils/svgExport";
import { ParentSelectorModal } from "./components/ParentSelectorModal";
import { TreeSidebar } from "./components/TreeSidebar";

const DEFAULT_TREE_NAME = "Untitled Tree";

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
        deathPlace: trimOrNull(form.deathPlace ?? ""),
        gender: trimOrEmpty(form.gender),
        notes: trimOrEmpty(form.notes),
        parents: [],
        spouses: [],
        children: [],
    };
};

const cloneTreeData = (source: TreeData): TreeData => {
    const peopleEntries = Object.entries(source.people ?? {}).map(([id, person]) => [
        id,
        {
            ...person,
            parents: [...(person.parents ?? [])],
            children: [...(person.children ?? [])],
            spouses: (person.spouses ?? []).map(spouse => ({ ...spouse })),
        },
    ]);
    return {
        rootPersonId: source.rootPersonId ?? null,
        people: Object.fromEntries(peopleEntries),
    };
};

const createStoredTree = (name: string, treeData?: TreeData): StoredTree => {
    return {
        id: crypto.randomUUID(),
        name: name.trim().length > 0 ? name.trim() : DEFAULT_TREE_NAME,
        tree: cloneTreeData(treeData ?? EMPTY_TREE),
        updatedAt: new Date().toISOString(),
    };
};

export function App() {
    const [tree, dispatch] = useReducer(treeReducer, EMPTY_TREE);
    const [trees, setTrees] = useState<StoredTree[]>([]);
    const [currentTreeId, setCurrentTreeId] = useState<string | null>(null);
    const [selection, setSelection] = useState<SelectedEntity>(null);
    const [modalState, setModalState] = useState<ModalState | null>(null);
    const [parentSelector, setParentSelector] = useState<{ childId: string } | null>(null);
    const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

    const persistCollection = useCallback((payload: LoadedCollection) => {
        void saveTreeCollection(payload);
    }, []);
    const debouncedSaveCollection = useDebouncedCallback(persistCollection, 500);

    useEffect(() => {
        let isMounted = true;
        void loadTreeCollection()
            .then(collection => {
                if (!isMounted) {
                    return;
                }
                let initialTrees = collection.trees;
                let activeTreeId = collection.activeTreeId;
                if (initialTrees.length === 0) {
                    const created = createStoredTree(DEFAULT_TREE_NAME, EMPTY_TREE);
                    initialTrees = [created];
                    activeTreeId = created.id;
                }
                setTrees(initialTrees);
                setCurrentTreeId(activeTreeId ?? initialTrees[0]?.id ?? null);
                const activeTree = initialTrees.find(tree => tree.id === (activeTreeId ?? initialTrees[0]?.id))?.tree ?? EMPTY_TREE;
                dispatch({ type: "SET_TREE", payload: cloneTreeData(activeTree) });
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
        if (!hasLoadedFromStorage || !currentTreeId) {
            return;
        }
        setTrees(prev => {
            const index = prev.findIndex(entry => entry.id === currentTreeId);
            if (index === -1) {
                return prev;
            }
            if (prev[index].tree === tree) {
                return prev;
            }
            const next = [...prev];
            next[index] = {
                ...next[index],
                tree,
                updatedAt: new Date().toISOString(),
            };
            return next;
        });
    }, [tree, currentTreeId, hasLoadedFromStorage]);

    useEffect(() => {
        if (!hasLoadedFromStorage) {
            return;
        }
        debouncedSaveCollection({ trees, activeTreeId: currentTreeId });
    }, [trees, currentTreeId, hasLoadedFromStorage, debouncedSaveCollection]);

    useEffect(() => {
        if (!hasLoadedFromStorage) {
            return;
        }
        if (trees.length === 0) {
            const created = createStoredTree(DEFAULT_TREE_NAME, EMPTY_TREE);
            setTrees([created]);
            setCurrentTreeId(created.id);
            dispatch({ type: "SET_TREE", payload: cloneTreeData(created.tree) });
            return;
        }
        if (currentTreeId && !trees.some(tree => tree.id === currentTreeId)) {
            const next = trees[0];
            setCurrentTreeId(next.id);
            dispatch({ type: "SET_TREE", payload: cloneTreeData(next.tree) });
        }
    }, [trees, currentTreeId, hasLoadedFromStorage]);

    const treeContextValue = useMemo(
        () => ({
            tree,
            dispatch,
        }),
        [tree, dispatch],
    );

    const activeTreeEntry = useMemo(() => {
        return currentTreeId ? trees.find(entry => entry.id === currentTreeId) ?? null : null;
    }, [trees, currentTreeId]);

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

    const handleToolbarLoadFromFile = async (file: File) => {
        const text = await file.text();
        try {
            const parsed = JSON.parse(text) as unknown;
            const payload = normalizeImportedTree(parsed);
            if (!payload) {
                window.alert("The selected file is not a valid tree.");
                return;
            }
            const suggestedName = payload.name ?? "Imported Tree";
            const enteredName = window.prompt("Name for the imported tree:", suggestedName);
            if (enteredName === null) {
                return;
            }
            const stored = createStoredTree(enteredName, payload.tree);
            setTrees(prev => [...prev, stored]);
            setCurrentTreeId(stored.id);
            dispatch({ type: "SET_TREE", payload: cloneTreeData(stored.tree) });
        } catch (error) {
            console.error("Failed to load tree file:", error);
            window.alert("Unable to load the selected file.");
        }
    };

    const handleToolbarSaveToFile = () => {
        const name = activeTreeEntry?.name ?? DEFAULT_TREE_NAME;
        const payload = {
            name,
            tree,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const element = document.createElement("a");
        element.href = url;
        element.download = `${slugify(name)}.gntree`;
        element.click();
        URL.revokeObjectURL(url);
    };

    const handleToolbarPrint = () => {
        const name = activeTreeEntry?.name ?? DEFAULT_TREE_NAME;
        const svgContent = renderTreeToSvg(tree, { name });
        const printerWindow = window.open("", "_blank", "noopener,noreferrer");
        if (!printerWindow) {
            const blob = new Blob([svgContent], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${slugify(name)}.svg`;
            link.click();
            URL.revokeObjectURL(url);
            return;
        }
        const printMarkup = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(name)}</title>
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
                if (partners.length === 0) {
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
        if (!selection || selection.type !== "person") {
            return;
        }
        openModal("EDIT", selection.id);
    };

    const handleShowAddParent = () => {
        if (!selection || selection.type !== "person") {
            return;
        }
        openModal("ADD_PARENT", selection.id);
    };

    const handleShowAddSpouse = () => {
        if (!selection || selection.type !== "person") {
            return;
        }
        openModal("ADD_SPOUSE", selection.id);
    };

    const handleShowAddChildFromUnion = () => {
        if (!selection || selection.type !== "union") {
            return;
        }
        openModal("ADD_CHILD_UNION", undefined, selection.id);
    };

    const handleStartParentReassignment = () => {
        if (!selection || selection.type !== "person") {
            return;
        }
        setModalState(null);
        setParentSelector({ childId: selection.id });
    };

    const handleDeletePerson = () => {
        if (!selection || selection.type !== "person") {
            return;
        }
        const person = tree.people[selection.id];
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
        dispatch({ type: "DELETE_PERSON", payload: { personId: selection.id } });
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
        const labels = partners
            .map(id => {
                const person = tree.people[id];
                if (!person) {
                    return "Unknown";
                }
                return `${person.firstName} ${person.lastName}`.trim();
            })
            .join(" & ");
        return `Parents: ${labels}`;
    }, [modalState, tree]);

    const handleSelectTree = (treeId: string) => {
        const entry = trees.find(item => item.id === treeId);
        if (!entry) {
            return;
        }
        setCurrentTreeId(treeId);
        dispatch({ type: "SET_TREE", payload: cloneTreeData(entry.tree) });
        setSelection(null);
    };

    const handleCreateTree = () => {
        const suggested = `${DEFAULT_TREE_NAME} ${trees.length + 1}`;
        const nameInput = window.prompt("Name for the new tree:", suggested);
        if (nameInput === null) {
            return;
        }
        const stored = createStoredTree(nameInput);
        setTrees(prev => [...prev, stored]);
        setCurrentTreeId(stored.id);
        dispatch({ type: "SET_TREE", payload: cloneTreeData(stored.tree) });
        setSelection(null);
    };

    const handleRenameTree = (treeId: string) => {
        const entry = trees.find(item => item.id === treeId);
        if (!entry) {
            return;
        }
        const nameInput = window.prompt("Rename tree:", entry.name);
        if (nameInput === null) {
            return;
        }
        const trimmed = nameInput.trim();
        if (trimmed.length === 0 || trimmed === entry.name) {
            return;
        }
        setTrees(prev =>
            prev.map(item =>
                item.id === treeId
                    ? {
                        ...item,
                        name: trimmed,
                        updatedAt: new Date().toISOString(),
                    }
                    : item,
            ),
        );
    };

    const handleDeleteTree = (treeId: string) => {
        const entry = trees.find(item => item.id === treeId);
        if (!entry) {
            return;
        }
        const confirmDelete = window.confirm(`Delete tree "${entry.name}"? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }
        setTrees(prev => {
            const next = prev.filter(item => item.id !== treeId);
            if (treeId === currentTreeId) {
                if (next.length > 0) {
                    const nextEntry = next[0];
                    setCurrentTreeId(nextEntry.id);
                    dispatch({ type: "SET_TREE", payload: cloneTreeData(nextEntry.tree) });
                } else {
                    const created = createStoredTree(DEFAULT_TREE_NAME, EMPTY_TREE);
                    next.push(created);
                    setCurrentTreeId(created.id);
                    dispatch({ type: "SET_TREE", payload: cloneTreeData(created.tree) });
                }
                setSelection(null);
            }
            return next;
        });
    };

    return (
        <TreeProvider value={treeContextValue}>
            <div className="app">
                <TreeSidebar
                    trees={trees}
                    activeTreeId={currentTreeId}
                    onSelect={handleSelectTree}
                    onCreate={handleCreateTree}
                    onRename={handleRenameTree}
                    onDelete={handleDeleteTree}
                />
                <div className="main-panel">
                    <Toolbar
                        onAddPerson={handleToolbarAddPerson}
                        onLoadFromFile={handleToolbarLoadFromFile}
                        onSaveToFile={handleToolbarSaveToFile}
                        onPrint={handleToolbarPrint}
                    />
                    <div className="tree-pane">
                        <GenealogyTreeView
                            selectedPersonId={selection && selection.type === "person" ? selection.id : null}
                            selectedUnionId={selection && selection.type === "union" ? selection.id : null}
                            onSelectPerson={handleSelectPerson}
                            onSelectUnion={handleSelectUnion}
                            onClearSelection={handleClearSelection}
                        />
                        {selection && selection.type === "person" && selection.anchor ? (
                            <ContextualActionMenu
                                position={selection.anchor}
                                onEdit={handleShowEdit}
                                onAddParent={handleShowAddParent}
                                onAddSpouse={handleShowAddSpouse}
                                onDelete={handleDeletePerson}
                            />
                        ) : null}
                        {selection && selection.type === "union" && selection.anchor ? (
                            <UnionActionMenu position={selection.anchor} onAddChild={handleShowAddChildFromUnion} />
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
            </div>
        </TreeProvider>
    );
}

const normalizeImportedTree = (value: unknown): { tree: TreeData; name?: string } | null => {
    if (!value || typeof value !== "object") {
        return null;
    }
    if ("tree" in value && value.tree && typeof value.tree === "object") {
        const treeCandidate = value.tree as TreeData;
        if (isTreeData(treeCandidate)) {
            return {
                tree: treeCandidate,
                name: typeof (value as Record<string, unknown>).name === "string" ? (value as Record<string, unknown>).name : undefined,
            };
        }
    }
    if (isTreeData(value)) {
        return { tree: value as TreeData };
    }
    return null;
};

const isTreeData = (value: unknown): value is TreeData => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const maybe = value as Partial<TreeData>;
    return typeof maybe.people === "object" && maybe.people !== null;
};

const slugify = (value: string) => {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "family-tree";
};

const escapeHtml = (value: string) => {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

