import { EditorState } from "@codemirror/state";
import { css, html, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import { classMap } from "lit/directives/class-map.js";
import {
  createReqEditorState,
  createRespEditorState,
} from "./codemirror/create_editor_state.js";
import "./editor.js";
import { Editor } from "./editor.js";
import { validateOrThrowError } from "./json/schema_validator.js";
import type { Json, TypeDefinition } from "./json/types.js";

@customElement("restudio-app")
export class App extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      height: 100vh;
      width: 100%;
    }

    :host .hidden {
      display: none;
    }
  `;

  override render(): TemplateResult {
    return html` <div class="app">
      <h1>RESTudio</h1>
      ${this.renderServiceUrlSelector()} ${this.renderContent()}
    </div>`;
  }

  private renderContent(): TemplateResult {
    const { methodList, selectedMethod } = this;
    if (methodList.kind === "zero-state" || methodList.kind === "loading") {
      return html``;
    } else if (methodList.kind === "error") {
      return html`<div class="error">${methodList.message}</div>`;
    }
    return html`
      ${this.renderMethodSelector(methodList.methods)}
      <restudio-editor id="request-editor"></restudio-editor>
      <button @click=${() => this.onSend()}>Send</button>
      <restudio-editor
        id="response-editor"
        class=${classMap({
          hidden: !selectedMethod || selectedMethod.response.kind !== "ok",
        })}
      ></restudio-editor>
      ${selectedMethod && selectedMethod.response.kind === "error"
        ? html`<div class="error">
            ${selectedMethod.response.message}
          </div>`
        : ""}
    `;
  }

  private renderServiceUrlSelector(): TemplateResult {
    const onClick = () => {
      let serviceUrl =
        this.renderRoot.querySelector<HTMLInputElement>("#service-url")!.value;
      try {
        const url = new URL(serviceUrl);
        url.search = "";
        url.hash = "";
        serviceUrl = url.toString();
      } catch {}

      const authorizationHeader =
        this.renderRoot.querySelector<HTMLInputElement>(
          "#authorization-header",
        )!.value;

      this.serviceSpec = {
        serviceUrl,
        authorizationHeader,
      };
      this.fetchMethodList();
    };

    return html` <label for="service-url">Service URL:</label>
      <input
        type="text"
        id="service-url"
        .value="${this.serviceSpec.serviceUrl}"
      />

      <label for="authorization-header">Authorization Header:</label>
      <input
        type="text"
        autocomplete="off"
        placeholder="Bearer {token}"
        id="authorization-header"
        .value="${this.serviceSpec.authorizationHeader}"
      />

      <button @click=${onClick}>Fetch methods</button>`;
  }

  private renderMethodSelector(
    methods: readonly MethodBundle[],
  ): TemplateResult {
    const onChange = (event: Event) => {
      const select = event.target as HTMLSelectElement;
      const index = parseInt(select.value);
      this.selectMethod(methods[index]);
    };
    return html`<label for="method">Method:</label>
      <select id="method" @change=${onChange}>
        ${methods.map(
          (method, index) =>
            html`<option
              value="${index}"
              ?selected=${this.selectedMethod?.method.number ===
              method.method.number}
            >
              ${method.method.method}
            </option>`,
        )}
      </select>`;
  }

  protected override firstUpdated(): void {
    // See if the URL has a "restudio" query parameter
    const thisUrl = new URL(document.location.href);
    if (thisUrl.searchParams.has("restudio")) {
      this.fetchMethodList();
    }
  }

  private async fetchMethodList(): Promise<void> {
    const { serviceUrl, authorizationHeader } = this.serviceSpec;
    if (
      this.methodList.kind === "loading" &&
      this.methodList.serviceUrl === serviceUrl
    ) {
      return;
    }
    const listUrl = new URL(serviceUrl);
    listUrl.search = "list";
    this.methodList = { kind: "loading", serviceUrl };
    try {
      const response = await fetch(listUrl.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorizationHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.text();
      const methodList = tryParseMethodList(data);
      if (methodList === null) {
        throw new Error("The URL does not seem to point to a soia service");
      }
      const methods = methodList.methods.map((method) => ({
        method,
        reqEditorState: createReqEditorState(method.request),
        response: { kind: "zero-state" } as ResponseState,
      }));
      methods.sort((a, b) => a.method.method.localeCompare(b.method.method));
      this.methodList = { kind: "ok", methods };
    } catch (error) {
      console.error("Error fetching method list: ", error);
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.methodList = { kind: "error", message };
    }
  }

  private selectMethod(method: MethodBundle): void {
    const { requestEditor, responseEditor } = this;
    if (!requestEditor || !responseEditor) {
      console.warn("Editors not found, cannot select method.");
      return;
    }
    const oldMethod = this.selectedMethod;
    if (oldMethod) {
      // Save the editor state for the request and the response. This way we can
      // restore it later if the user switches back to this method.
      oldMethod.reqEditorState = requestEditor.state;
      if (oldMethod.response.kind === "ok") {
        oldMethod.response.editorState = responseEditor.state;
      }
    }
    this.selectedMethod = method;
    requestEditor.state = method.reqEditorState;
    if (method.response.kind === "ok") {
      responseEditor.state = method.response.editorState;
    }
  }

  private async onSend(): Promise<void> {
    const { serviceUrl, authorizationHeader } = this.serviceSpec;
    const { requestEditor, responseEditor } = this;
    if (!requestEditor || !responseEditor) {
      console.warn("Editors not found, cannot send request.");
      return;
    }
    const { selectedMethod } = this;
    if (!selectedMethod || selectedMethod.response.kind === "loading") {
      return;
    }
    const { method } = selectedMethod;
    selectedMethod.response = { kind: "loading" };
    try {
      const reqJsonCode = requestEditor.state.doc.toString();
      validateOrThrowError(reqJsonCode, method.request);
      const reqJson = JSON.parse(reqJsonCode);
      const response = await fetch(serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorizationHeader,
        },
        body: JSON.stringify(
          {
            method: method.method,
            request: reqJson,
          },
          null,
          2,
        ),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as Json;
      const respEditorState = createRespEditorState(data, method.response);
      selectedMethod.response = {
        kind: "ok",
        response: data,
        editorState: respEditorState,
      };
      // Render the response in the response editor
      responseEditor.state = respEditorState;
    } catch (error) {
      console.error("Error sending request: ", error);
      selectedMethod.response = {
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
    this.requestUpdate();
  }

  @state()
  private serviceSpec: ServiceSpec = {
    serviceUrl: getDefaultServiceUrl(),
    authorizationHeader: "",
  };
  @state()
  private methodList: MethodListState = { kind: "zero-state" };
  @state()
  private selectedMethod?: MethodBundle;

  private get requestEditor(): Editor | null {
    return this.renderRoot.querySelector<Editor>("#request-editor");
  }

  private get responseEditor(): Editor | null {
    return this.renderRoot.querySelector<Editor>("#response-editor");
  }
}

interface ServiceSpec {
  serviceUrl: string;
  authorizationHeader: string;
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

type ResponseState =
  | {
      kind: "zero-state";
    }
  | {
      kind: "loading";
    }
  | {
      kind: "ok";
      response: Json;
      editorState: EditorState;
    }
  | {
      kind: "error";
      message: string;
    };

interface MethodBundle {
  method: Method;
  reqEditorState: EditorState;
  response: ResponseState;
}

type MethodListState =
  | {
      kind: "zero-state";
    }
  | {
      kind: "loading";
      serviceUrl: string;
    }
  | {
      kind: "ok";
      methods: MethodBundle[];
    }
  | {
      kind: "error";
      message: string;
    };

function tryParseMethodList(jsonCode: string): MethodList | null {
  try {
    const data = JSON.parse(jsonCode);
    if (data && Array.isArray(data.methods)) {
      return data as MethodList;
    } else {
      return null;
    }
  } catch {
    return null;
  }
}

function getDefaultServiceUrl(): string {
  const currentUrl = new URL(document.location.href);
  if (currentUrl.searchParams.has("serviceUrl")) {
    return currentUrl.searchParams.get("serviceUrl") || "";
  }
  currentUrl.search = "";
  return currentUrl.toString();
}

declare global {
  interface HTMLElementTagNameMap {
    "restudio-app": App;
  }
}
