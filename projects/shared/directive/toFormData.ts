export function toFormData<T>(formValue: any) {
    const formData = new FormData();

    for (const key of Object.keys(formValue)) {
        // @ts-ignore
        let value: any = formValue[key];
        value = value == null ? '' : value;
        formData.append(key, value);
    }

    return formData;
}
