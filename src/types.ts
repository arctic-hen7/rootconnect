export type Partnership = {
    spouseId: string;
    marriageDate: string | null;
    unionId: string;
};

export type Person = {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    birthPlace: string;
    deathDate: string | null;
    deathPlace: string | null;
    gender: string;
    notes: string;
    parents: string[];
    spouses: Partnership[];
    children: string[];
};

export type TreeData = {
    rootPersonId: string | null;
    people: Record<string, Person>;
};

export type TreeAction =
    | { type: "SET_TREE"; payload: TreeData }
    | { type: "UPSERT_PERSON"; payload: Person }
    | { type: "LINK_PARENT_CHILD"; payload: { parentId: string; childId: string } }
    | {
          type: "LINK_SPOUSE";
          payload: { personId: string; spouseId: string; marriageDate: string | null; unionId: string };
      }
    | { type: "SET_ROOT_PERSON"; payload: string | null }
    | { type: "DELETE_PERSON"; payload: { personId: string } }
    | { type: "REASSIGN_PARENTS"; payload: { childId: string; parentIds: string[] } };
