import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Person } from "../types";
import { displayToIsoDate, isoToDisplayDate } from "../utils/dateFormat";

export type PersonEditorMode = "CREATE_NEW" | "EDIT" | "ADD_PARENT" | "ADD_CHILD" | "ADD_CHILD_UNION" | "ADD_SPOUSE";

export type PersonEditorModalProps = {
    mode: PersonEditorMode;
    person?: Person;
    unionSummary?: string;
    onClose: () => void;
    onSubmit: (payload: PersonEditorSubmitPayload) => void;
    onReassignParents?: () => void;
};

export type PersonEditorSubmitPayload = {
    firstName: string;
    lastName: string;
    birthDate: string | null;
    birthPlace: string;
    deathDate: string | null;
    deathPlace: string;
    gender: string;
    notes: string;
    marriageDate?: string | null;
};

const getInitialValue = (value: string | null | undefined) => {
    return value ?? "";
};

type PersonFormState = {
    firstName: string;
    lastName: string;
    birthDate: string;
    birthPlace: string;
    deathDate: string;
    deathPlace: string;
    gender: string;
    notes: string;
    marriageDate: string;
};

const buildInitialState = (mode: PersonEditorMode, person?: Person): PersonFormState => {
    return {
        firstName: getInitialValue(person?.firstName),
        lastName: getInitialValue(person?.lastName),
        birthDate: isoToDisplayDate(person?.birthDate),
        birthPlace: getInitialValue(person?.birthPlace),
        deathDate: isoToDisplayDate(person?.deathDate),
        deathPlace: getInitialValue(person?.deathPlace),
        gender: getInitialValue(person?.gender),
        notes: getInitialValue(person?.notes),
        marriageDate: mode === "ADD_SPOUSE" ? "" : "",
    };
};

export const PersonEditorModal = ({ mode, person, unionSummary, onClose, onSubmit, onReassignParents }: PersonEditorModalProps) => {
    const [formState, setFormState] = useState<PersonFormState>(() => buildInitialState(mode, person));

    useEffect(() => {
        setFormState(buildInitialState(mode, person));
    }, [mode, person]);

    const title = useMemo(() => {
        switch (mode) {
            case "CREATE_NEW":
                return "Add New Person";
            case "ADD_CHILD":
                return "Add Child";
            case "ADD_PARENT":
                return "Add Parent";
            case "ADD_SPOUSE":
                return "Add Spouse";
            case "ADD_CHILD_UNION":
                return "Add Child";
            case "EDIT":
                return "Edit Details";
            default:
                return "Person";
        }
    }, [mode]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const birthDateIso = convertDateForSubmit(formState.birthDate, "Birth Date");
        if (birthDateIso === INVALID_DATE_FLAG) {
            return;
        }
        const deathDateIso = convertDateForSubmit(formState.deathDate, "Death Date");
        if (deathDateIso === INVALID_DATE_FLAG) {
            return;
        }
        const marriageDateIso =
            mode === "ADD_SPOUSE" ? convertDateForSubmit(formState.marriageDate, "Marriage Date") : null;
        if (marriageDateIso === INVALID_DATE_FLAG) {
            return;
        }
        onSubmit({
            firstName: formState.firstName,
            lastName: formState.lastName,
            birthDate: birthDateIso,
            birthPlace: formState.birthPlace,
            deathDate: deathDateIso,
            deathPlace: formState.deathPlace,
            gender: formState.gender,
            notes: formState.notes,
            marriageDate: marriageDateIso,
        });
    };

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = event.target;
        const name = target.name as keyof PersonFormState;
        setFormState(prev => ({
            ...prev,
            [name]: target.value,
        }));
    };

    return (
        <div className="modal-backdrop" role="presentation">
            <div className="modal">
                <h2>{title}</h2>
                <form onSubmit={handleSubmit} className="person-form">
                    {mode === "ADD_CHILD_UNION" && unionSummary ? <div className="form-hint">{unionSummary}</div> : null}
                    <label>
                        First Name
                        <input name="firstName" value={formState.firstName} onChange={handleInputChange} required />
                    </label>
                    <label>
                        Last Name
                        <input name="lastName" value={formState.lastName} onChange={handleInputChange} required />
                    </label>
                    <label>
                        Birth Date
                        <input
                            type="text"
                            name="birthDate"
                            placeholder="dd/mm/yyyy"
                            value={formState.birthDate}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Birth Place
                        <input name="birthPlace" value={formState.birthPlace} onChange={handleInputChange} />
                    </label>
                    <label>
                        Death Date
                        <input
                            type="text"
                            name="deathDate"
                            placeholder="dd/mm/yyyy"
                            value={formState.deathDate}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Death Place
                        <input name="deathPlace" value={formState.deathPlace} onChange={handleInputChange} />
                    </label>
                    <label>
                        Gender
                        <select name="gender" value={formState.gender} onChange={handleInputChange}>
                            <option value="">Select</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                            <option value="Unknown">Unknown</option>
                        </select>
                    </label>
                    <label>
                        Notes
                        <textarea name="notes" value={formState.notes} onChange={handleInputChange} rows={4} />
                    </label>
                    {mode === "ADD_SPOUSE" && (
                        <label>
                            Marriage Date
                            <input
                                type="text"
                                name="marriageDate"
                                placeholder="dd/mm/yyyy"
                                value={formState.marriageDate}
                                onChange={handleInputChange}
                            />
                        </label>
                    )}
                    <div className="modal-actions">
                        {onReassignParents ? (
                            <button type="button" className="secondary" onClick={onReassignParents}>
                                Reassign Parents
                            </button>
                        ) : null}
                        <button type="button" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const INVALID_DATE_FLAG = Symbol("INVALID_DATE_FLAG");

const convertDateForSubmit = (value: string, label: string): string | null | typeof INVALID_DATE_FLAG => {
    if (!value || value.trim().length === 0) {
        return null;
    }
    const iso = displayToIsoDate(value);
    if (!iso) {
        window.alert(`${label} must be in dd/mm/yyyy format and represent a valid calendar date.`);
        return INVALID_DATE_FLAG;
    }
    return iso;
};
