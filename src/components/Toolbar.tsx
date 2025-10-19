import { ChangeEvent, useRef } from "react";

export type ToolbarProps = {
    onAddPerson: () => void;
    onLoadFromFile: (file: File) => void;
    onSaveToFile: () => void;
    onPrint: () => void;
};

export const Toolbar = ({ onAddPerson, onLoadFromFile, onSaveToFile, onPrint }: ToolbarProps) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onLoadFromFile(file);
            event.target.value = "";
        }
    };

    const handleLoadClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="toolbar">
            <button type="button" onClick={onAddPerson}>
                Add New Person
            </button>
            <button type="button" onClick={handleLoadClick}>
                Load From File
            </button>
            <button type="button" onClick={onSaveToFile}>
                Save To File
            </button>
            <button type="button" onClick={onPrint}>
                Print
            </button>
            <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                accept=".gntree,application/json"
                onChange={handleFileChange}
            />
        </div>
    );
};
