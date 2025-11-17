
const td = new TextEncoder();

export interface EncodeOptions {
    compressed?: boolean;
    blnp?: boolean;
    signature?: {
        key: string;
        algorithm?: string;
    }
}

export class LNPEncoder {
    encode(value: any): Buffer {
        let output = this.encodeLNP(value);

        return output;
    }

    private pack(type: string, payload: Uint8Array): Buffer {
        return Buffer.concat([
            Buffer.from(type),
            Buffer.from(String(payload.length)),
            Buffer.from(":"),
            Buffer.from(payload)
        ]);
    }


    private encodeLNP(value: any): Buffer {
        if (value === null) { // Null -> N0:
            return this.pack("N", Buffer.alloc(0));
        }

        switch(typeof value) {
            case "string":
                return this.pack("s", td.encode(value));
        
            case "number":
                return this.pack("n", Buffer.from(String(value)));
            
            case "boolean":
                return this.pack("b", Buffer.from(value ? "t" : "f"));
                
            case "object":
                if (Array.isArray(value)) // Array
                    return this.pack("a", this.encodeLNPArray(value));
                return this.pack("o", this.encodeLNPObject(value));

            default:
                throw new Error("Unsupported type in LNP");
        }
    }

    private encodeLNPArray(arr: any[]) {
        return Buffer.concat(arr.map((v) => this.encodeLNP(v)));
    }

    private encodeLNPObject(obj: Record<string, any>) {
        const chunks: Buffer[] = [];

        for (const [k, v] of Object.entries(obj)) {
            const kb = td.encode(k);

            chunks.push(Buffer.from(String(kb.length) + ":"));
            chunks.push(Buffer.from(kb));
            chunks.push(this.encodeLNP(v));
        }

        return Buffer.concat(chunks);
    }
}


export class LNPParser {
    parse(value: Buffer): object {
        let [output, _]: any = this.parseValue(value);

        return output;
    }


    private parseValue(buf: Buffer, offset: number = 0) {
        const type = String.fromCharCode(buf[offset] as number);
        offset++;

        let lenStr = "";
        while (buf[offset] !== 58) { // :
            lenStr += String.fromCharCode(buf[offset] as number);
            offset++;
        }
        offset++; // Skip :

        const length: number = parseInt(lenStr, 10);
        const end: number = offset + length;
        const payload: Buffer = buf.subarray(offset, end);

        switch (type) {
            case "s":
                return [new TextDecoder().decode(payload), end];
            case "n":
                return [Number(new TextDecoder().decode(payload)), end];
            case "b":
                return [payload[0] === 116, end];
            case "N":
                return [null, end];
            case "B":
                return [Buffer.from(payload.toString(), "base64"), end];
            case "a":
                return [this.parseArray(payload), end];
            case "o":
                return [this.parseObject(payload), end];
            default:
                throw new Error("Unknown type: " + type);
        }
    }

    private parseArray(payload: Buffer) {
        let offset: number = 0;
        const arr: any[] = [];

        while (offset < payload.length) {
            const [value, next]: any = this.parseValue(payload, offset);
            arr.push(value);
            offset = next;
        }

        return arr;
    }

    private parseObject(payload: Buffer) {
        let offset: number = 0;
        const obj: Record<string, any> = {};

        while (offset < payload.length) {
            let klenStr = "";

            while (payload[offset] !== 58)  { // :
                klenStr += String.fromCharCode(payload[offset] as number);
                offset++;
            }
            offset++; // Skip :

            const klen: number = parseInt(klenStr, 10);
            const key: string = new TextDecoder().decode(payload.subarray(offset, offset + klen));
            offset += klen;

            const [value, next]: any = this.parseValue(payload, offset);
            obj[key] = value;
            offset = next;
        }

        return obj;
    }
}

