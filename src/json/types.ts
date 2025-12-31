// To use instead of `any`
export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | Readonly<{ [name: string]: Json }>;

// -----------------------------------------------------------------------------
// ERRORS
// -----------------------------------------------------------------------------

export interface JsonError {
  kind: "error";
  segment: Segment;
  message: string;
}

export interface JsonErrors {
  kind: "errors";
  errors: JsonError[];
}

// -----------------------------------------------------------------------------
// PARSING
// -----------------------------------------------------------------------------

export type JsonValue = JsonArray | JsonObject | JsonLiteral;

export interface JsonArray {
  kind: "array";
  segment: Segment;
  values: JsonValue[];
  expectedType?: TypeSignature;
}

export interface JsonKeyValue {
  segment: Segment;
  key: string;
  value: JsonValue;
  expectedType?: TypeSignature;
}

export interface JsonObject {
  kind: "object";
  segment: Segment;
  keyValues: { [key: string]: JsonKeyValue };
  expectedType?: TypeSignature;
}

export interface JsonLiteral {
  kind: "literal";
  segment: Segment;
  jsonCode: string;
  type: "boolean" | "null" | "number" | "string";
  expectedType?: TypeSignature;
}

export interface Segment {
  start: number;
  end: number;
}

// -----------------------------------------------------------------------------
// SCHEMA
// -----------------------------------------------------------------------------

/** A skir schema. */
export type TypeDefinition = {
  type: TypeSignature;
  records: readonly RecordDefinition[];
};

export type PrimitiveType =
  | "bool"
  | "int32"
  | "int64"
  | "uint64"
  | "float32"
  | "float64"
  | "timestamp"
  | "string"
  | "bytes";

/** A type in the JSON representation of a `TypeDescriptor`. */
export type TypeSignature =
  | {
      kind: "optional";
      value: TypeSignature;
    }
  | ArrayTypeSignature
  | RecordTypeSignature
  | {
      kind: "primitive";
      value: PrimitiveType;
    };

export type ArrayTypeSignature = {
  kind: "array";
  value: {
    item: TypeSignature;
    key_chain?: string;
  };
};

export type RecordTypeSignature = {
  kind: "record";
  value: string;
};

/**
 * Definition of a record field in the JSON representation of a
 * `TypeDescriptor`.
 */
export type FieldDefinition = {
  name: string;
  type?: TypeSignature;
  number: number;
};

/** Definition of a record in the JSON representation of a `TypeDescriptor`. */
export type RecordDefinition = {
  kind: "struct" | "enum";
  id: string;
  fields: readonly FieldDefinition[];
  removed_fields?: ReadonlyArray<number>;
};

// -----------------------------------------------------------------------------
// SCHEMA VALIDATION
// -----------------------------------------------------------------------------

export interface TypeHint {
  segment: Segment;
  typeDesc: string;
}

export interface ValidationResult {
  errors: JsonError[];
  typeHints: TypeHint[];
}
