import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { basicSetup } from "codemirror";
import { linter, lintGutter } from "@codemirror/lint";
import { autocompletion } from "@codemirror/autocomplete";
import { jsonLinter } from "./codemirror/json_linter";
import { TypeDefinition } from "./json/types";
import { jsonCompletion } from "./codemirror/json_completion";
import { enterKeyHandler } from "./codemirror/enter_key_handler";

@customElement("studio-editor")
export class Editor extends LitElement {
  @property({ type: Object })
  schema?: TypeDefinition = {
    type: {
      kind: "record",
      value: "web_service.soia:NinjaRequest",
    },
    records: [
      {
        kind: "enum",
        id: "web_service.soia:NinjaRequest",
        fields: [
          {
            name: "set_user",
            type: {
              kind: "record",
              value: "user.soia:User",
            },
            number: 1,
          },
          {
            name: "set_account",
            type: {
              kind: "record",
              value: "account.soia:Account",
            },
            number: 2,
          },
        ],
      },
      {
        kind: "struct",
        id: "user.soia:User",
        fields: [
          {
            name: "id",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 0,
          },
          {
            name: "email",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 1,
          },
          {
            name: "admin",
            type: {
              kind: "primitive",
              value: "bool",
            },
            number: 2,
          },
          {
            name: "account_admin",
            type: {
              kind: "primitive",
              value: "bool",
            },
            number: 3,
          },
          {
            name: "first_name",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 5,
          },
          {
            name: "last_name",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 6,
          },
          {
            name: "account_id",
            type: {
              kind: "primitive",
              value: "int64",
            },
            number: 7,
          },
          {
            name: "unregistered",
            type: {
              kind: "primitive",
              value: "bool",
            },
            number: 8,
          },
          {
            name: "phone_number",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 9,
          },
          {
            name: "job_title",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 10,
          },
          {
            name: "organization",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 11,
          },
          {
            name: "marketing_consent",
            type: {
              kind: "primitive",
              value: "bool",
            },
            number: 12,
          },
          {
            name: "preferences",
            type: {
              kind: "record",
              value: "user.soia:User.Preferences",
            },
            number: 13,
          },
        ],
        removed_fields: [4],
      },
      {
        kind: "struct",
        id: "user.soia:User.Preferences",
        fields: [
          {
            name: "disable_email_notifications",
            type: {
              kind: "primitive",
              value: "bool",
            },
            number: 0,
          },
          {
            name: "bot_invited_by_default",
            type: {
              kind: "primitive",
              value: "bool",
            },
            number: 1,
          },
        ],
      },
      {
        kind: "struct",
        id: "account.soia:Account",
        fields: [
          {
            name: "id",
            type: {
              kind: "primitive",
              value: "uint64",
            },
            number: 0,
          },
          {
            name: "name",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 1,
          },
          {
            name: "bot_name",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 2,
          },
          {
            name: "bot_image",
            type: {
              kind: "record",
              value: "account.soia:Account.BotImage",
            },
            number: 3,
          },
          {
            name: "bot_images",
            type: {
              kind: "array",
              value: {
                item: {
                  kind: "record",
                  value: "account.soia:Account.BotImage",
                },
              },
            },
            number: 3,
          },
          {
            name: "industry",
            type: {
              kind: "record",
              value: "account.soia:Account.Industry",
            },
            number: 4,
          },
          {
            name: "description",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 5,
          },
        ],
      },
      {
        kind: "struct",
        id: "account.soia:Account.BotImage",
        fields: [
          {
            name: "blob_path",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 0,
          },
          {
            name: "mime_type",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 1,
          },
          {
            name: "public_url",
            type: {
              kind: "primitive",
              value: "string",
            },
            number: 2,
          },
        ],
      },
      {
        kind: "enum",
        id: "account.soia:Account.Industry",
        fields: [],
      },
    ],
  };

  @property({ type: Boolean, reflect: true })
  readOnly = true;

  static override styles = css`
    :host {
    }
  `;

  override render(): TemplateResult {
    const { schema } = this;
    if (schema) {
      this.updateComplete.then(() => this.createEditor(schema));
    }
    return html` <div id="container"></div> `;
  }

  private createEditor(schema: TypeDefinition): EditorView {
    const container = this.renderRoot.querySelector("#container");
    const state = EditorState.create({
      doc: "{\n  \n}",
      extensions: [
        EditorState.readOnly.of(this.readOnly),
        enterKeyHandler(schema),
        basicSetup,
        json(),
        linter(jsonLinter(schema)),
        autocompletion({
          override: [jsonCompletion(schema)],
        }),
        lintGutter(),
        EditorView.theme({
          "&": {
            fontSize: "14px",
          },
          ".cm-editor": {
            height: "400px",
          },
          // ".cm-scroller": {
          //   fontFamily:
          //     "Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
          // },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: container!,
    });

    return view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-editor": Editor;
  }
}
