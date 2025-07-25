import { autocompletion } from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { css, html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { enterKeyHandler } from "./codemirror/enter_key_handler";
import { jsonCompletion } from "./codemirror/json_completion";
import { jsonLinter } from "./codemirror/json_linter";
import { TypeDefinition } from "./json/types";

@customElement("restudio-editor")
export class Editor extends LitElement {
  @property({ type: Object })
  schema?: TypeDefinition;

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
    "restudio-editor": Editor;
  }
}
