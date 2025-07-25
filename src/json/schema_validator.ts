import { primitiveSerializer } from "soia";
import type {
  FieldDefinition,
  JsonError,
  JsonObject,
  JsonValue,
  PrimitiveType,
  RecordDefinition,
  TypeDefinition,
  TypeHint,
  TypeSignature,
  ValidationResult,
} from "./types";
import { toJson } from "./to_json";

export function validateSchema(
  value: JsonValue,
  schema: TypeDefinition
): ValidationResult {
  const idToRecordDef: { [id: string]: RecordDefinition } = {};
  schema.records.forEach((record) => {
    idToRecordDef[record.id] = record;
  });

  const validator = new SchemaValidator(idToRecordDef);
  validator.validate(value, schema.type);
  return {
    errors: validator.errors,
    typeHints: validator.typeHints,
  };
}

class SchemaValidator {
  constructor(readonly idToRecordDef: { [id: string]: RecordDefinition }) {}
  readonly errors: JsonError[] = [];
  readonly typeHints: TypeHint[] = [];

  validate(value: JsonValue, schema: TypeSignature): void {
    value.expectedType = schema;
    const pushTypeHint = () =>
      this.typeHints.push({
        segment: value.segment,
        typeDesc: getTypeDesc(schema),
      });
    switch (schema.kind) {
      case "array": {
        if (value.kind === "array") {
          pushTypeHint();
          for (const item of value.values) {
            this.validate(item, schema.value.item);
          }
        } else {
          this.errors.push({
            kind: "error",
            segment: value.segment,
            message: "Expected: array",
          });
        }
        break;
      }
      case "optional": {
        if (value.kind === "literal" && value.jsonCode === "null") {
          pushTypeHint();
        } else {
          this.validate(value, schema.value);
        }
        break;
      }
      case "primitive": {
        const primitiveType = schema.value;
        if (hasPrimitiveType(value, primitiveType)) {
          pushTypeHint();
        } else {
          this.errors.push({
            kind: "error",
            segment: value.segment,
            message: `Expected: ${primitiveType}`,
          });
        }
        break;
      }
      case "record": {
        const recordDef = this.idToRecordDef[schema.value];
        const nameToFieldDef: { [name: string]: FieldDefinition } = {};
        recordDef.fields.forEach((field) => {
          nameToFieldDef[field.name] = field;
        });
        if (recordDef.kind === "struct") {
          if (value.kind === "object") {
            pushTypeHint();

            for (const keyValue of Object.values(value.keyValues)) {
              const { key, value } = keyValue;
              const fieldDef = nameToFieldDef[key];
              if (fieldDef) {
                this.validate(value, fieldDef.type!);
              } else {
                this.errors.push({
                  kind: "error",
                  segment: keyValue.segment,
                  message: "Unknown field",
                });
              }
            }
          } else {
            this.errors.push({
              kind: "error",
              segment: value.segment,
              message: "Expected: object",
            });
          }
        } else {
          // Enum
          if (value.kind === "object") {
            pushTypeHint();
            this.validateEnumObject(value, nameToFieldDef);
          } else if (value.kind === "literal" && value.type === "string") {
            const name = JSON.parse(value.jsonCode);
            const fieldDef = nameToFieldDef[name];
            if (name === "?" || fieldDef) {
              pushTypeHint();
            } else {
              this.errors.push({
                kind: "error",
                segment: value.segment,
                message: "Unknown enumerator",
              });
            }
          } else {
            this.errors.push({
              kind: "error",
              segment: value.segment,
              message: "Expected: object or string",
            });
          }
        }
        break;
      }
      default: {
        const _: never = schema;
        throw new Error(_);
      }
    }
  }

  validateEnumObject(
    object: JsonObject,
    nameToFieldDef: { [name: string]: FieldDefinition }
  ): void {
    const kindKv = object.keyValues["kind"];
    if (!kindKv) {
      this.errors.push({
        kind: "error",
        segment: object.segment,
        message: "Missing: 'kind'",
      });
      return;
    }
    if (kindKv.value.kind !== "literal" || kindKv.value.type !== "string") {
      this.errors.push({
        kind: "error",
        segment: kindKv.value.segment,
        message: "Expected: string",
      });
      return;
    }
    const kind: string = JSON.parse(kindKv.value.jsonCode);
    if (kind !== kind.toLowerCase()) {
      this.errors.push({
        kind: "error",
        segment: kindKv.value.segment,
        message: "Expected: lowercase enumerator",
      });
      return;
    }
    const fieldDef = nameToFieldDef[kind];
    if (!fieldDef) {
      this.errors.push({
        kind: "error",
        segment: kindKv.value.segment,
        message: "Unknown enumerator",
      });
      return;
    }
    const valueKv = object.keyValues["value"];
    if (!valueKv) {
      this.errors.push({
        kind: "error",
        segment: object.segment,
        message: "Missing: 'value'",
      });
      return;
    }
    this.validate(valueKv.value, fieldDef.type!);
  }
}

function hasPrimitiveType(
  value: JsonValue,
  expectedType: PrimitiveType
): boolean {
  switch (expectedType) {
    case "bool":
      return value.kind === "literal" && value.type === "boolean";
    case "int32": {
      return isInteger(value, -2147483648n, 2147483647n);
    }
    case "int64": {
      return isInteger(value, -9223372036854775808n, 9223372036854775807n);
    }
    case "uint64": {
      return isInteger(value, 0n, 18446744073709551615n);
    }
    case "timestamp": {
      try {
        primitiveSerializer("timestamp").fromJson(toJson(value));
        return true;
      } catch {
        return false;
      }
    }
    case "float32":
    case "float64": {
      return isFloat(value);
    }
    case "string": {
      return value.kind === "literal" && value.type === "string";
    }
    case "bytes": {
      if (value.kind !== "literal") {
        return false;
      }
      try {
        primitiveSerializer("bytes").fromJsonCode(value.jsonCode);
        return true;
      } catch {
        return false;
      }
    }
  }
}

function isInteger(value: JsonValue, min: bigint, max: bigint): boolean {
  if (value.kind !== "literal") {
    return false;
  }
  let decimalRep: string;
  if (value.type === "string") {
    decimalRep = JSON.parse(value.jsonCode);
  } else if (value.type === "number") {
    decimalRep = value.jsonCode;
  } else {
    return false;
  }
  let int: bigint;
  try {
    int = BigInt(decimalRep);
  } catch {
    return false;
  }
  return min <= int && int <= max;
}

function isFloat(value: JsonValue): boolean {
  if (value.kind !== "literal") {
    return false;
  }
  if (value.type === "number") {
    return true;
  } else if (value.type === "string") {
    try {
      primitiveSerializer("float64").fromJsonCode(value.jsonCode);
      return true;
    } catch {
      return false;
    }
  } else {
    return false;
  }
}

function getTypeDesc(type: TypeSignature): string {
  function getTypePart(type: TypeSignature): string {
    switch (type.kind) {
      case "primitive":
        return type.value;
      case "array":
        return `[${getTypePart(type.value.item)}]`;
      case "optional":
        return `${getTypePart(type.value)}?`;
      case "record": {
        const recordId = type.value;
        return recordId.split(":")[1];
      }
    }
  }
  function getModulePart(type: TypeSignature): string | null {
    switch (type.kind) {
      case "primitive":
        return null;
      case "array":
        return getModulePart(type.value.item);
      case "optional":
        return getModulePart(type.value);
      case "record": {
        const recordId = type.value;
        return recordId.split(":")[0];
      }
    }
  }
  const typePart = getTypePart(type);
  const modulePart = getModulePart(type);
  return modulePart ? `${typePart} (${modulePart})` : typePart;
}
