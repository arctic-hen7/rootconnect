import { TreeData } from "../types";

const DB_NAME = "genealogy-tree";
const STORE_NAME = "treeData";
const DB_VERSION = 1;

const isIndexedDbSupported = () => {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
};

export const loadTreeData = async (): Promise<TreeData | null> => {
    if (!isIndexedDbSupported()) {
        return null;
    }
    const db = await openDatabase();
    return new Promise<TreeData | null>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get("tree");
        request.onsuccess = () => {
            resolve((request.result as TreeData | undefined) ?? null);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const saveTreeData = async (tree: TreeData): Promise<void> => {
    if (!isIndexedDbSupported()) {
        return;
    }
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(tree, "tree");
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
