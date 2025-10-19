import { createContext, useContext, Dispatch, ReactNode } from "react";
import { TreeAction, TreeData } from "../types";

type TreeContextValue = {
    tree: TreeData;
    dispatch: Dispatch<TreeAction>;
};

const TreeContext = createContext<TreeContextValue | undefined>(undefined);

export const TreeProvider = ({
    value,
    children,
}: {
    value: TreeContextValue;
    children: ReactNode;
}) => {
    return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
};

export const useTreeContext = () => {
    const context = useContext(TreeContext);
    if (!context) {
        throw new Error("TreeContext must be used within a TreeProvider");
    }
    return context;
};
