import { Person, TreeAction, TreeData } from "../types";

export const EMPTY_TREE: TreeData = {
    rootPersonId: null,
    people: {},
};

const ensureUnique = (items: string[]): string[] => {
    return Array.from(new Set(items));
};

const ensurePartnershipUnique = (spouses: Person["spouses"], partnership: Person["spouses"][number]) => {
    const existingIndex = spouses.findIndex(item => item.unionId === partnership.unionId);
    if (existingIndex !== -1) {
        const next = [...spouses];
        next[existingIndex] = partnership;
        return next;
    }
    return [...spouses, partnership];
};

export const treeReducer = (state: TreeData, action: TreeAction): TreeData => {
    switch (action.type) {
        case "SET_TREE":
            return action.payload;
        case "UPSERT_PERSON": {
            const person = sanitizePerson(action.payload);
            return {
                ...state,
                people: {
                    ...state.people,
                    [person.id]: person,
                },
            };
        }
        case "LINK_PARENT_CHILD": {
            const { parentId, childId } = action.payload;
            const parent = state.people[parentId];
            const child = state.people[childId];
            if (!parent || !child) {
                return state;
            }
            const updatedParent: Person = {
                ...parent,
                children: ensureUnique([...parent.children, childId]),
            };
            const updatedChild: Person = {
                ...child,
                parents: ensureUnique([...child.parents, parentId]),
            };
            return {
                ...state,
                people: {
                    ...state.people,
                    [parentId]: updatedParent,
                    [childId]: updatedChild,
                },
            };
        }
        case "LINK_SPOUSE": {
            const { personId, spouseId, marriageDate, unionId } = action.payload;
            const personA = state.people[personId];
            const personB = state.people[spouseId];
            if (!personA || !personB) {
                return state;
            }
            const partnershipForA = {
                spouseId: spouseId,
                marriageDate,
                unionId,
            };
            const partnershipForB = {
                spouseId: personId,
                marriageDate,
                unionId,
            };
            return {
                ...state,
                people: {
                    ...state.people,
                    [personId]: {
                        ...personA,
                        spouses: ensurePartnershipUnique([...personA.spouses], partnershipForA),
                    },
                    [spouseId]: {
                        ...personB,
                        spouses: ensurePartnershipUnique([...personB.spouses], partnershipForB),
                    },
                },
            };
        }
        case "SET_ROOT_PERSON":
            return {
                ...state,
                rootPersonId: action.payload,
            };
        case "DELETE_PERSON":
            return deletePerson(state, action.payload.personId);
        case "REASSIGN_PARENTS":
            return reassignParents(state, action.payload.childId, action.payload.parentIds);
        default:
            return state;
    }
};

const sanitizePerson = (person: Person): Person => {
    return {
        ...person,
        birthDate: normalizeDateValue(person.birthDate),
        deathDate: normalizeDateValue(person.deathDate),
        parents: ensureUnique(person.parents),
        children: ensureUnique(person.children),
        spouses: dedupePartnerships(person.spouses),
    };
};

const dedupePartnerships = (spouses: Person["spouses"]) => {
    const uniqueMap = new Map<string, Person["spouses"][number]>();
    for (const entry of spouses) {
        uniqueMap.set(entry.unionId, { ...entry });
    }
    return Array.from(uniqueMap.values());
};

const normalizeDateValue = (value: string | null | undefined): string | null => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }
    return trimmed;
};

const deletePerson = (state: TreeData, personId: string): TreeData => {
    const personToRemove = state.people[personId];
    if (!personToRemove) {
        return state;
    }

    const remainingEntries = Object.entries(state.people).filter(([id]) => id !== personId);
    const updatedPeople: Record<string, Person> = {};

    for (const [id, person] of remainingEntries) {
        const filteredParents = person.parents.filter(parentId => parentId !== personId);
        const filteredChildren = person.children.filter(childId => childId !== personId);
        const filteredSpouses = person.spouses.filter(spouse => spouse.spouseId !== personId);
        updatedPeople[id] = sanitizePerson({
            ...person,
            parents: filteredParents,
            children: filteredChildren,
            spouses: filteredSpouses,
        });
    }

    const nextRoot =
        state.rootPersonId && state.rootPersonId === personId
            ? remainingEntries.length > 0
                ? remainingEntries[0][0]
                : null
            : state.rootPersonId ?? (remainingEntries.length > 0 ? remainingEntries[0][0] : null);

    return {
        rootPersonId: nextRoot,
        people: updatedPeople,
    };
};

const reassignParents = (state: TreeData, childId: string, parentIds: string[]): TreeData => {
    const child = state.people[childId];
    if (!child) {
        return state;
    }

    const nextParentIds = ensureUnique(parentIds.filter(parentId => parentId !== childId && parentId in state.people));

    const updatedPeople: Record<string, Person> = {};
    for (const [id, person] of Object.entries(state.people)) {
        if (id === childId) {
            continue;
        }
        const filteredChildren = person.children.filter(existingChildId => existingChildId !== childId);
        updatedPeople[id] = sanitizePerson({
            ...person,
            children: filteredChildren,
        });
    }

    for (const parentId of nextParentIds) {
        const parent = updatedPeople[parentId];
        if (!parent) {
            continue;
        }
        updatedPeople[parentId] = sanitizePerson({
            ...parent,
            children: ensureUnique([...parent.children, childId]),
        });
    }

    updatedPeople[childId] = sanitizePerson({
        ...child,
        parents: nextParentIds,
    });

    return {
        ...state,
        people: updatedPeople,
    };
};
