import { expect } from "buckwheat";
import { describe, it } from "mocha";
import { parseJsonValue } from "./json_parser.js";

describe("json_parser", () => {
  it("parses true", () => {
    expect(parseJsonValue("true")).toMatch({
      kind: "literal",
      jsonCode: "true",
      type: "boolean",
    });
  });

  it("parses false", () => {
    expect(parseJsonValue("false")).toMatch({
      kind: "literal",
      jsonCode: "false",
      type: "boolean",
    });
  });

  it("parses null", () => {
    expect(parseJsonValue("null")).toMatch({
      kind: "literal",
      jsonCode: "null",
      type: "null",
    });
  });

  it("parses number", () => {
    expect(parseJsonValue("123.45")).toMatch({
      kind: "literal",
      jsonCode: "123.45",
      type: "number",
    });
  });

  it("parses string", () => {
    expect(parseJsonValue('"hello"')).toMatch({
      kind: "literal",
      jsonCode: '"hello"',
      type: "string",
    });
  });

  it("parses empty array", () => {
    expect(parseJsonValue("[]")).toMatch({ kind: "array", values: [] });
  });

  it("parses array with values", () => {
    expect(parseJsonValue("[1, true]")).toMatch({
      kind: "array",
      values: [
        { kind: "literal", jsonCode: "1", type: "number" },
        { kind: "literal", jsonCode: "true", type: "boolean" },
      ],
    });
  });

  it("parses empty object", () => {
    expect(parseJsonValue("{}")).toMatch({ kind: "object", keyValues: {} });
  });

  it("parses object with values", () => {
    expect(parseJsonValue('{"a": 1}')).toMatch({
      kind: "object",
      keyValues: {
        a: {
          key: "a",
          value: { kind: "literal", jsonCode: "1", type: "number" },
        },
      },
    });
  });

  it("parses arrays with whitespace", () => {
    expect(parseJsonValue(" [ 1 ] ")).toMatch({
      kind: "array",
      values: [{ kind: "literal", jsonCode: "1" }],
    });
  });

  it("reports error for invalid token", () => {
    expect(parseJsonValue("@")).toMatch({
      kind: "errors",
      errors: [
        {
          message: "not a token",
        },
      ],
    });
  });

  it("reports error for unclosed array", () => {
    expect(parseJsonValue("[")).toMatch({ kind: "errors" });
  });
});
