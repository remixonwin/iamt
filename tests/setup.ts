import '@testing-library/jest-dom/vitest';

// Polyfill URL.createObjectURL
if (typeof URL.createObjectURL === 'undefined') {
    Object.defineProperty(URL, 'createObjectURL', { value: (blob: Blob) => `blob:${blob.size}` });
}

// Polyfill Blob.text if missing (jsdom might miss it)
if (!Blob.prototype.text) {
    Blob.prototype.text = async function () {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(this);
        });
    };
}

if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = async function () {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(this);
        });
    };
}
