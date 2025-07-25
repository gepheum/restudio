import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { css, html, LitElement, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("restudio-editor")
export class Editor extends LitElement {
  static override styles = css``;

  override render(): TemplateResult {
    return html`<div id="container"></div>`;
  }

  override firstUpdated(): void {
    const container = this.renderRoot.querySelector("#container");
    this.editor = {
      kind: "view",
      value: new EditorView({
        state: this.state,
        parent: container!,
      }),
    };
  }

  get state(): EditorState {
    if (this.editor.kind === "state") {
      return this.editor.value;
    } else {
      return this.editor.value.state;
    }
  }

  set state(value: EditorState) {
    if (this.editor.kind === "state") {
      this.editor = {
        kind: "state",
        value: this.editor.value,
      };
    } else {
      this.editor.value.setState(value);
    }
  }

  private editor:
    | {
        kind: "view";
        value: EditorView;
      }
    | {
        kind: "state";
        value: EditorState;
      } = {
    kind: "state",
    value: EditorState.create({}),
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "restudio-editor": Editor;
  }
}
