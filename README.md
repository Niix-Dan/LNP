# **LNP — Length-Notation Protocol**

LNP is a compact, deterministic, length-prefixed data serialization format.
It encodes structured data (objects, arrays, primitives, and binary) using a minimal grammar and unambiguous parsing rules.
The design goal is to provide a simple, stream-friendly, and implementation-agnostic protocol suitable for storage, messaging, and structured binary or textual data exchange.

---

## **Core Idea**

Every value is encoded as:

```
<type-char><byte-length>:<payload-bytes>
```

Where:

* **`<type-char>`** — a single ASCII character indicating the value type
* **`<byte-length>`** — decimal ASCII length of the payload in bytes
* **`:`** — required separator
* **`<payload-bytes>`** — exactly `<byte-length>` bytes of content

This eliminates the need for delimiters, escaping, or structural markers.
All nested values remain valid LNP values.

---

## **Type Table**

| Type    | Char | Payload Description                                         |
| ------- | ---- | ----------------------------------------------------------- |
| Object  | `o`  | Sequence of entries `<klen>:<kbytes><value>`                |
| Array   | `a`  | Sequence of complete LNP values                             |
| String  | `s`  | Raw UTF-8 string bytes                                      |
| Number  | `n`  | ASCII numeric representation (`-12`, `3.14`, etc.)          |
| Boolean | `b`  | Single byte: `t` or `f`                                     |
| Null    | `N`  | Must have zero-length payload                               |
| Bytes   | `B`  | Base64-encoded bytes (or raw bytes, implementation defined) |

---

# **Objects**

Object payloads consist of repeated entries:

```
<key-length>:<key-bytes><value>
```

Where `<value>` is a complete LNP value including its type and length prefix.

Example:

```
o27:name4:Johnage2:n24
```

Represents:

```json
{
  "name": "John",
  "age": 24
}
```

---

# **Arrays**

Arrays concatenate multiple full LNP values inside the payload:

```
a14s3:foos3:bar
```

Equivalent to:

```json
["foo", "bar"]
```

---

# **Primitives**

### String

```
s5:hello
```

### Number

```
n4:-2.5
```

### Boolean

```
b1:t     // true
b1:f     // false
```

### Null

```
N0:
```

### Bytes

```
B12:SGVsbG8gV29ybGQ=
```

---

# **EBNF Specification**

```
value       = typeChar length ":" payload ;
typeChar    = "o" | "a" | "s" | "n" | "b" | "N" | "B" ;
length      = digits ;
digits      = digit { digit } ;
payload     = bytes(length) ;

object      = "o" length ":" { entry } ;
entry       = digits ":" bytes(keylen) value ;

array       = "a" length ":" { value } ;
```

`bytes(n)` means exactly `n` raw bytes, without interpretation.

---

# **Design Properties**

* **Deterministic:** identical input always produces identical output.
* **Non-ambiguous:** no quoting, escaping, or delimiter rules.
* **Streaming-friendly:** parser can process values incrementally.
* **Compact:** minimal overhead, fixed structural cost.
* **Easy to implement:** simple state machine and length-bounded reads.
* **Suitable for hashing:** stable representation ideal for merkle-tree or content-addressed storage.

---

# **Roadmap**

* Official Node.js encoder/decoder
* Reference test suite
* Implementations in Rust, Go, Python
* Optional binary variant (BLNP)
* Schema definition layer (optional)