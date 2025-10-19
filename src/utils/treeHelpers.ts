import { TreeData } from "../types";

export const resolveUnionPartners = (tree: TreeData, unionId: string): string[] => {
    const partners = new Set<string>();
    Object.values(tree.people).forEach(person => {
        person.spouses.forEach(spouse => {
            if (spouse.unionId === unionId) {
                partners.add(person.id);
                partners.add(spouse.spouseId);
            }
        });
    });
    return Array.from(partners);
};

export const resolveDefaultPartnerIds = (tree: TreeData, personId: string): string[] => {
    const person = tree.people[personId];
    if (!person) {
        return [];
    }
    if (person.spouses.length !== 1) {
        return [person.id];
    }
    const spouseRecord = person.spouses[0];
    const partner = tree.people[spouseRecord.spouseId];
    if (!partner) {
        return [person.id];
    }
    return [person.id, partner.id];
};

export const isDescendant = (tree: TreeData, ancestorId: string, possibleDescendantId: string): boolean => {
    const visited = new Set<string>();
    const queue: string[] = [...(tree.people[ancestorId]?.children ?? [])];
    while (queue.length > 0) {
        const currentId = queue.shift() as string;
        if (currentId === possibleDescendantId) {
            return true;
        }
        if (visited.has(currentId)) {
            continue;
        }
        visited.add(currentId);
        const current = tree.people[currentId];
        if (!current) {
            continue;
        }
        queue.push(...current.children);
    }
    return false;
};
