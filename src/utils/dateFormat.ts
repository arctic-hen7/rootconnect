const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

export const isoToDisplayDate = (value: string | null | undefined): string => {
    if (!value) {
        return "";
    }
    if (DISPLAY_DATE_PATTERN.test(value)) {
        return value;
    }
    if (!ISO_DATE_PATTERN.test(value)) {
        return "";
    }
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
};

export const displayToIsoDate = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (!DISPLAY_DATE_PATTERN.test(trimmed)) {
        return null;
    }
    const [day, month, year] = trimmed.split("/");
    const dayNumber = Number.parseInt(day, 10);
    const monthNumber = Number.parseInt(month, 10);
    const yearNumber = Number.parseInt(year, 10);
    if (!isValidDateParts(dayNumber, monthNumber, yearNumber)) {
        return null;
    }
    return `${pad(yearNumber, 4)}-${pad(monthNumber, 2)}-${pad(dayNumber, 2)}`;
};

const isLeapYear = (year: number) => {
    if (year % 400 === 0) {
        return true;
    }
    if (year % 100 === 0) {
        return false;
    }
    return year % 4 === 0;
};

const isValidDateParts = (day: number, month: number, year: number) => {
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
        return false;
    }
    if (year < 0 || month < 1 || month > 12 || day < 1) {
        return false;
    }
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
};

const pad = (value: number, length: number) => {
    return value.toString().padStart(length, "0");
};
