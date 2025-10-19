import { StoredTree, TreeCollection, TreeData } from "../types";

const DB_NAME = "genealogy-tree";
const STORE_NAME = "treeData";
const DB_VERSION = 2;
const COLLECTION_KEY = "collection";

const isIndexedDbSupported = () => {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
};

export type LoadedCollection = {
    trees: StoredTree[];
    activeTreeId: string | null;
};

export const loadTreeCollection = async (): Promise<LoadedCollection> => {
    if (!isIndexedDbSupported()) {
        return {
            trees: [],
            activeTreeId: null,
        };
    }
    const db = await openDatabase();
    return new Promise<LoadedCollection>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(COLLECTION_KEY);
        request.onsuccess = () => {
            const result = request.result;
            if (!result) {
                resolve({ trees: [], activeTreeId: null });
                return;
            }
            if (isTreeCollection(result)) {
                resolve({ trees: result.trees, activeTreeId: result.activeTreeId });
                return;
            }
            if (isLegacyTreeData(result)) {
                const migrated = migrateLegacyTree(result);
                store.put(migrated, COLLECTION_KEY);
                resolve({ trees: migrated.trees, activeTreeId: migrated.activeTreeId });
                return;
            }
            resolve({ trees: [], activeTreeId: null });
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const saveTreeCollection = async (collection: LoadedCollection): Promise<void> => {
    if (!isIndexedDbSupported()) {
        return;
    }
    const db = await openDatabase();
    const payload: TreeCollection = {
        version: 2,
        trees: collection.trees,
        activeTreeId: collection.activeTreeId,
    };
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(payload, COLLECTION_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const openDatabase = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const openRequest = window.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onupgradeneeded = () => {
            const db = openRequest.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        openRequest.onsuccess = () => resolve(openRequest.result);
        openRequest.onerror = () => reject(openRequest.error);
    });
};

const isTreeCollection = (value: unknown): value is TreeCollection => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const maybe = value as Partial<TreeCollection>;
    return maybe.version === 2 && Array.isArray(maybe.trees);
};

const isLegacyTreeData = (value: unknown): value is TreeData => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const maybe = value as Partial<TreeData>;
    return typeof maybe.rootPersonId !== "undefined" && typeof maybe.people === "object" && maybe.people !== null;
};

const migrateLegacyTree = (tree: TreeData): TreeCollection => {
    const id = crypto.randomUUID();
    const storedTree: StoredTree = {
        id,
        name: "Imported Tree",
        tree,
        updatedAt: new Date().toISOString(),
    };
    return {
        version: 2,
        trees: [storedTree],
        activeTreeId: id,
    };
};
