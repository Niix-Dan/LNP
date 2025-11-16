const td = new TextEncoder();

function encode(type, payload) {
    return Buffer.concat([
        Buffer.from(type),
        Buffer.from(String(payload.length)),
        Buffer.from(":"),
        payload
    ]);
}

export function encodeLNP(value) {
    if (value === null) {
        return encode("N", Buffer.alloc(0));
    }

    switch (typeof value) {
        case "string":
            return encode("s", td.encode(value));

        case "number":
            return encode("n", Buffer.from(String(value)));

        case "boolean":
            return encode("b", Buffer.from(value ? "t" : "f"));

        case "object":
            if (Array.isArray(value))
                return encode("a", encodeArray(value));

            return encode("o", encodeObject(value));

        default:
            throw new Error("Unsupported type");
    }
}

function encodeArray(arr) {
    return Buffer.concat(arr.map(encodeLNP));
}

function encodeObject(obj) {
    const chunks = [];

    for (const [k, v] of Object.entries(obj)) {
        const kb = td.encode(k);
        chunks.push(Buffer.from(String(kb.length) + ":"));
        chunks.push(kb);
        chunks.push(encodeLNP(v));
    }
    return Buffer.concat(chunks);
}
