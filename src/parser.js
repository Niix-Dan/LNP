function parseValue(buf, offset = 0) {
    const type = String.fromCharCode(buf[offset]);
    offset++;

    // length
    let lenStr = "";
    while (buf[offset] !== 58) { // ':'
        lenStr += String.fromCharCode(buf[offset]);
        offset++;
    }
    offset++; // pulano o trequin -> ':'

    const length = parseInt(lenStr, 10);
    const end = offset + length;
    const payload = buf.subarray(offset, end);

    switch (type) {
        case "s":
            return [new TextDecoder().decode(payload), end];
        case "n":
            return [Number(new TextDecoder().decode(payload)), end];
        case "b":
            return [payload[0] === 116, end]; // t or f
        case "N":
            return [null, end];
        case "B":
            return [payload, end];
        case "a":
            return [parseArray(payload), end];
        case "o":
            return [parseObject(payload), end];
        default:
            throw new Error("Unknown type: " + type);
    }
}

function parseArray(payload) {
    let offset = 0;
    const arr = [];

    while (offset < payload.length) {
        const [value, next] = parseValue(payload, offset);
        arr.push(value);
        offset = next;
    }
    return arr;
}

function parseObject(payload) {
    let offset = 0;
    const obj = {};

    while (offset < payload.length) {
        // leno a key length
        let klenStr = "";
        while (payload[offset] !== 58) { // ':'
            klenStr += String.fromCharCode(payload[offset]);
            offset++;
        }
        offset++;

        const klen = parseInt(klenStr, 10);
        const key = new TextDecoder().decode(payload.subarray(offset, offset + klen));
        offset += klen;

        const [value, next] = parseValue(payload, offset);
        obj[key] = value;
        offset = next;
    }
    return obj;
}

export function parseLNP(bytes) {
    const [value] = parseValue(bytes);
    return value;
}
