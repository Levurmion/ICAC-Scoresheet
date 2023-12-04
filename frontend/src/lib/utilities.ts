import { FormEvent } from "react";

export function extractFormData (e: FormEvent) {
    const formData = new FormData(e.target as HTMLFormElement);
    return Object.fromEntries(formData.entries());
}