import { EditorView, keymap } from "@codemirror/view";
import { parseJsonValue } from "../json/json_parser";
import { validateSchema } from "../json/schema_validator";
import { makeJsonTemplate } from "../json/to_json";
import {
  ArrayTypeSignature,
  JsonValue,
  RecordDefinition,
  RecordTypeSignature,
  TypeDefinition,
} from "../json/types";

/**
 * Triggered when the Enter key is pressed between 2 consecutive curly braces or
 * square brackets.
 */
export function enterKeyHandler(schema: TypeDefinition) {
  return keymap.of([
    {
      key: "Enter",
      run: (view: EditorView) => {
        const { state } = view;
        const { selection } = state;
        const { main } = selection;

        // Get the current cursor position
        const cursorPos = main.head;

        const textAround = state.doc.sliceString(cursorPos - 1, cursorPos + 1);
        if (textAround !== "{}" && textAround !== "[]") {
          return false; // Allow default Enter behavior
        }

        const jsonCode = state.doc.toString();
        const parseResult = parseJsonValue(jsonCode);
        if (parseResult.kind === "errors") {
          return false;
        }
        validateSchema(parseResult, schema);
        const jsonValue: JsonValue = parseResult;

        const idToRecordDef: { [id: string]: RecordDefinition } = {};
        schema.records.forEach((record) => {
          idToRecordDef[record.id] = record;
        });
        const type = findTypeByLeftBracketPos(
          jsonValue,
          cursorPos - 1,
          idToRecordDef,
        );
        if (type === null) {
          return false;
        }

        let codeToInsert: string;
        if (type.kind === "array") {
          codeToInsert = JSON.stringify(
            makeJsonTemplate(type.value.item, idToRecordDef),
            null,
            2,
          );
        } else if (type.kind === "record") {
          const recordDef = idToRecordDef[type.value];
          if (recordDef.kind === "struct") {
            codeToInsert = JSON.stringify(
              makeJsonTemplate(type, idToRecordDef),
              null,
              2,
            );
            // Remove the curly brackets at the start and end of the string and
            // unindent each line.
            if (codeToInsert !== "{}") {
              codeToInsert = codeToInsert
                .split("\n")
                .slice(1, -1)
                .map((line) => line.substring(2))
                .join("\n");
            }
          } else {
            // Enum
            codeToInsert = ['"kind": "",', '"value": {}'].join("\n");
          }
        } else {
          const _: never = type;
          throw new Error(_);
        }

        // Indent the code to insert based on the current line's indentation
        const lineIndentation = getLineIndentation(
          state.doc.toString(),
          cursorPos - 1,
        );
        codeToInsert = indent(codeToInsert, "  " + lineIndentation);

        codeToInsert = `\n${codeToInsert}\n${lineIndentation}`;

        // Apply the transaction
        view.dispatch({
          changes: {
            from: cursorPos,
            to: cursorPos,
            insert: codeToInsert,
          },
          // Move cursor to the end of the inserted text
          selection: { anchor: cursorPos + codeToInsert.length },
        });

        return true; // Prevent default Enter behavior
      },
    },
  ]);
}

function findTypeByLeftBracketPos(
  jsonValue: JsonValue,
  leftBracketPos: number,
  idToRecordDef: { [id: string]: RecordDefinition },
): ArrayTypeSignature | RecordTypeSignature | null {
  let { expectedType } = jsonValue;
  if (!expectedType) {
    return null;
  }
  expectedType.kind === "optional" ? expectedType.value : expectedType;
  switch (jsonValue.kind) {
    case "array": {
      if (expectedType.kind !== "array") {
        return null;
      }
      if (leftBracketPos === jsonValue.segment.start) {
        // We have a match
        return expectedType;
      }
      // If no match, we can continue searching in the elements.
      for (const element of jsonValue.values) {
        if (leftBracketPos < element.segment.start) {
          return null; // No need to continue (optimization)
        }
        const maybeResult = findTypeByLeftBracketPos(
          element,
          leftBracketPos,
          idToRecordDef,
        );
        if (maybeResult) {
          return maybeResult;
        }
      }
      return null;
    }
    case "object": {
      if (expectedType.kind !== "record") {
        return null;
      }
      if (leftBracketPos === jsonValue.segment.start) {
        // We have a match
        return expectedType;
      }
      // If no match, we can continue searching in the values.
      const recordDef = idToRecordDef[expectedType.value];
      if (recordDef.kind === "struct") {
        for (const keyValue of Object.values(jsonValue.keyValues)) {
          const maybeResult = findTypeByLeftBracketPos(
            keyValue.value,
            leftBracketPos,
            idToRecordDef,
          );
          if (maybeResult) {
            return maybeResult;
          }
        }
      } else {
        const valueKv = jsonValue.keyValues["value"];
        if (valueKv) {
          const maybeResult = findTypeByLeftBracketPos(
            valueKv.value,
            leftBracketPos,
            idToRecordDef,
          );
          if (maybeResult) {
            return maybeResult;
          }
        }
      }
      return null;
    }
    case "literal": {
      return null;
    }
  }
}

/** Returns the indentation at the line containing `position`. */
function getLineIndentation(text: string, position: number): string {
  if (position < 0 || position >= text.length) {
    return "";
  }

  // Find the start of the line containing the position
  let lineStart = position;
  while (lineStart > 0 && text[lineStart - 1] !== "\n") {
    lineStart--;
  }

  // Extract indentation (spaces at the beginning of the line)
  let indentation = "";
  let i = lineStart;
  while (i < text.length && text[i] === " ") {
    indentation += " ";
    i++;
  }

  return indentation;
}

function indent(text: string, indentation: string): string {
  return text
    .split("\n")
    .map((line) => indentation + line)
    .join("\n");
}
