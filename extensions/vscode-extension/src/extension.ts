import * as vscode from 'vscode';

interface BaseNode {
  start: number;
  end: number;
  children?: LNPNode[];
}

interface ErrorNode extends BaseNode {
  kind: "error";
  message: string;
}

interface ObjectKeyNode extends BaseNode {
  kind: "object-key";
  key: string;
}

interface ValueNode extends BaseNode {
  kind: "object" | "array" | "string" | "number" | "boolean" | "null" | "bytes";
  headerEnd: number;
}

type LNPNode = ErrorNode | ValueNode | ObjectKeyNode;

function parseLNP(text: string): LNPNode[] {
  const nodes: LNPNode[] = [];
  let offset = 0;

  function readKey(pos: number, payloadEnd: number): [LNPNode, number] {
    const keyStartOffset = pos;

    let klenStart = pos;
    while (pos < payloadEnd && /[0-9]/.test(text[pos])) pos++;
    
    if (pos === klenStart) {
      if (pos === payloadEnd) return [{ kind: "error", start: pos, end: pos, message: "Unexpected end of object payload" }, pos];
      return [{ kind: "error", start: klenStart, end: pos + 1, message: "Missing key length" }, pos + 1];
    }

    const keyLen = Number(text.slice(klenStart, pos));

    if (text[pos] !== ":") {
      return [{ kind: "error", start: klenStart, end: pos, message: "Missing colon after key length" }, pos];
    }
    pos++;

    const keyStart = pos;
    const keyEnd = pos + keyLen;

    if (keyEnd > payloadEnd) {
      return [{ kind: "error", start: keyStartOffset, end: payloadEnd, message: "Key length exceeds object payload" }, payloadEnd];
    }

    const keyNode: ObjectKeyNode = {
      kind: "object-key",
      start: keyStart,
      end: keyEnd,
      key: text.slice(keyStart, keyEnd)
    };

    return [keyNode, keyEnd];
  }

  function readValue(pos: number): [LNPNode, number] {
    if (pos >= text.length) {
      return [{ kind: "error", start: pos, end: pos, message: "Unexpected EOF" }, pos];
    }

    const type = text[pos];
    const typeStart = pos;

    if (!"oasnNbB".includes(type)) {
      return [{ kind: "error", start: pos, end: pos + 1, message: "Invalid type char" }, pos + 1];
    }

    pos++;

    let lenStart = pos;
    while (pos < text.length && /[0-9]/.test(text[pos])) pos++;

    if (pos === lenStart) {
      return [{ kind: "error", start: typeStart, end: pos, message: "Missing length" }, pos];
    }
    
    const lenStr = text.slice(lenStart, pos);
    const byteLength = Number(lenStr);

    if (text[pos] !== ":") {
      return [{ kind: "error", start: typeStart, end: pos, message: "Missing colon" }, pos];
    }

    pos++;
    const payloadStart = pos;
    const payloadEnd = pos + byteLength;

    if (payloadEnd > text.length) {
      return [{
        kind: "error",
        start: typeStart,
        end: text.length,
        message: "Payload exceeds document length"
      }, text.length];
    }

    const node: ValueNode = {
      kind:
        type === "o" ? "object" :
        type === "a" ? "array" :
        type === "s" ? "string" :
        type === "n" ? "number" :
        type === "b" ? "boolean" :
        type === "N" ? "null" :
        "bytes",
      start: typeStart,
      end: payloadEnd,
      headerEnd: payloadStart,
      children: []
    };

    if (type === "o") {
      let p = payloadStart;
      while (p < payloadEnd) {
        const [keyNode, nextKeyPos] = readKey(p, payloadEnd);
        node.children!.push(keyNode);
        p = nextKeyPos;

        if (keyNode.kind === "error") break;

        const [child, nextValPos] = readValue(p);
        node.children!.push(child);
        p = nextValPos;

        if (child.kind === "error") break;
        if (p > payloadEnd) {
          node.children!.push({ kind: "error", start: payloadEnd, end: p, message: "Value exceeded object payload" });
          break;
        }
      }
      if (p < payloadEnd) {
         node.children!.push({ kind: "error", start: p, end: payloadEnd, message: "Trailing data in object payload" });
      }
    }

    if (type === "a") {
      let p = payloadStart;
      while (p < payloadEnd) {
        const [child, next] = readValue(p);
        node.children!.push(child);
        p = next;
        
        if (child.kind === "error") break;
         if (p > payloadEnd) {
          node.children!.push({ kind: "error", start: payloadEnd, end: p, message: "Value exceeded array payload" });
          break;
        }
      }
       if (p < payloadEnd) {
         node.children!.push({ kind: "error", start: p, end: payloadEnd, message: "Trailing data in array payload" });
      }
    }

    return [node, payloadEnd];
  }

  while (offset < text.length) {
    const [node, next] = readValue(offset);
    nodes.push(node);
    if (next === offset) break;
    offset = next;
  }

  return nodes;
}

const tokenTypes = [
  "type-char",
  "length",
  "colon",
  "property",
  "string",
  "number",
  "boolean",
  "null",
  "bytes",
  "error"
];

const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

class LNPTokens implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(doc: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(legend);
    const nodes = parseLNP(doc.getText());

    function pushToken(start: number, end: number, type: string) {
      if (start === end) return; 

      const p = doc.positionAt(start);
      const pEnd = doc.positionAt(end);
      if (p.line === pEnd.line) {
         builder.push(p.line, p.character, end - start, tokenTypes.indexOf(type));
      } else {
        const lineEnd = doc.lineAt(p.line).range.end.character;
        builder.push(p.line, p.character, lineEnd - p.character, tokenTypes.indexOf(type));
        for (let i = p.line + 1; i < pEnd.line; i++) {
           builder.push(i, 0, doc.lineAt(i).text.length, tokenTypes.indexOf(type));
        }
        builder.push(pEnd.line, 0, pEnd.character, tokenTypes.indexOf(type));
      }
    }

    function walk(node: LNPNode) {
      if (node.kind === "error") {
        pushToken(node.start, node.end, "error");
        return;
      }

      if (node.kind === "object-key") {
        pushToken(node.start, node.end, "property");
        return;
      }

      pushToken(node.start, node.start + 1, "type-char"); // 'o', 's', 'n', etc.

      let pos = node.start + 1;
      while (pos < node.headerEnd && /[0-9]/.test(doc.getText()[pos])) pos++;
      
      pushToken(node.start + 1, pos, "length");
      pushToken(pos, pos + 1, "colon");

      switch (node.kind) {
        case "string":
          pushToken(node.headerEnd, node.end, "string");
          break;
        case "number":
          pushToken(node.headerEnd, node.end, "number");
          break;
        case "boolean":
          pushToken(node.headerEnd, node.end, "boolean");
          break;
        case "bytes":
          pushToken(node.headerEnd, node.end, "bytes");
          break;
        case "null":
          break;
        case "object":
        case "array":
          break;
      }

      node.children?.forEach(walk);
    }

    for (const n of nodes) walk(n);

    return builder.build();
  }
}


const errorDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255,0,0,0.25)",
  border: "1px solid rgba(255,0,0,0.6)"
});

function updateDecorations(editor: vscode.TextEditor) {
  const nodes = parseLNP(editor.document.getText());
  const errors: vscode.DecorationOptions[] = [];

  function walk(n: LNPNode) {
    if (n.kind === "error") {
      errors.push({
        range: new vscode.Range(
          editor.document.positionAt(n.start),
          editor.document.positionAt(n.end)
        ),
        hoverMessage: n.message
      });
    }
    n.children?.forEach(walk);
  }

  nodes.forEach(walk);
  editor.setDecorations(errorDecoration, errors);
}


export function activate(context: vscode.ExtensionContext) {
  const selector = { language: "lnp", scheme: "file" };

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      selector,
      new LNPTokens(),
      legend
    )
  );

  let activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.languageId === "lnp") {
    updateDecorations(activeEditor);
  }

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    if (editor && editor.document.languageId === "lnp") updateDecorations(editor);
  });

  vscode.workspace.onDidChangeTextDocument(event => {
    if (activeEditor && event.document === activeEditor.document && event.document.languageId === "lnp") {
      updateDecorations(activeEditor);
    }
  });
}

export function deactivate() {}