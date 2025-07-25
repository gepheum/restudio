import { css, html, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import "./editor.js";
import { TypeDefinition } from "./json/types.js";

@customElement("restudio-app")
export class App extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      height: 100vh;
      width: 100%;
    }
  `;

  override render(): TemplateResult {
    const { methodList } = this;
    if (methodList.kind === "zero-state" || methodList.kind === "loading") {
      return html``;
    } else if (methodList.kind === "error") {
      return html`<div>Error: ${methodList.message}</div>`;
    }
    return html`
      <div class="app">
        <h1>RESTudio</h1>
        ${this.renderMethodSelector(methodList.methods)}
        <restudio-editor></restudio-editor>
        <code>${JSON.stringify(this.methodList)}</code>
      </div>
    `;
  }

  private renderMethodSelector(methods: MethodList): TemplateResult {
    return html` <select>
      ${methods.methods.map(
        (method) =>
          html`<option
            value="${method.number}"
            ?selected=${this.selectedMethod?.method.number === method.number}
          >
            ${method.method}
          </option>`,
      )}
    </select>`;
  }

  protected override firstUpdated(): void {
    this.fetchMethodList();
  }

  private async fetchMethodList(): Promise<void> {
    if (this.methodList.kind === "loading") {
      return;
    }
    // const url = new URL(window.location.href);
    const url = new URL("http://localhost:8009/api/soia"); // TODO: rm!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    url.search = "list";
    this.methodList = { kind: "loading" };
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as MethodList;
      this.methodList = { kind: "ok", methods: data };
    } catch (error) {
      console.error("Error fetching method list: ", error);
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.methodList = { kind: "error", message };
    }
  }

  @state()
  private methodList: MethodListState = { kind: "zero-state" };
  @state()
  private selectedMethod?: MethodBundle;

  // private methodBundles: {[number: number]: MethodBundle} = {};
}

interface Method {
  method: string;
  number: number;
  request: TypeDefinition;
  response: TypeDefinition;
}

interface MethodList {
  methods: Method[];
}

type MethodListState =
  | {
      kind: "ok";
      methods: MethodList;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "loading";
    }
  | {
      kind: "zero-state";
    };

interface MethodBundle {
  method: Method;
  // TODO: add EditorState
}

declare global {
  interface HTMLElementTagNameMap {
    "restudio-app": App;
  }
}
