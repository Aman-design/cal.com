import { FloatingButton } from "./FloatingButton/FloatingButton";
import { Inline } from "./Inline/inline";
import { ModalBox } from "./ModalBox/ModalBox";
import { methods, UiConfig } from "./embed-iframe";
import css from "./embed.css";
import { SdkActionManager } from "./sdk-action-manager";
import allCss from "./tailwind.generated.css";

// HACK: Redefine and don't import WEBAPP_URL as it causes import statement to be present in built file.
// This is happening because we are not able to generate an App and a lib using single Vite Config.
const WEBAPP_URL =
  import.meta.env.EMBED_PUBLIC_WEBAPP_URL || `https://${import.meta.env.EMBED_PUBLIC_VERCEL_URL}`;

customElements.define("cal-modal-box", ModalBox);
customElements.define("cal-floating-button", FloatingButton);
customElements.define("cal-inline", Inline);

declare module "*.css";
type Namespace = string;
type Config = {
  origin: string;
  debug?: boolean;
  uiDebug?: boolean;
};

const globalCal = (window as CalWindow).Cal;
if (!globalCal || !globalCal.q) {
  throw new Error("Cal is not defined. This shouldn't happen");
}

// Store Commit Hash to know exactly what version of the code is running
// TODO: Ideally it should be the version as per package.json and then it can be renamed to version.
// But because it is built on local machine right now, it is much more reliable to have the commit hash.
globalCal.fingerprint = import.meta.env.EMBED_PUBLIC_EMBED_FINGER_PRINT as string;
globalCal.__css = allCss;
document.head.appendChild(document.createElement("style")).innerHTML = css;

function log(...args: any[]) {
  console.log(...args);
}
/**
 * //TODO: Warn about extra properties not part of schema. Helps in fixing wrong expectations
 * A very simple data validator written with intention of keeping payload size low.
 * Extend the functionality of it as required by the embed.
 * @param data
 * @param schema
 */
function validate(data: any, schema: Record<"props" | "required", any>) {
  function checkType(value: any, expectedType: any) {
    if (typeof expectedType === "string") {
      return typeof value == expectedType;
    } else {
      return value instanceof expectedType;
    }
  }

  function isUndefined(data: any) {
    return typeof data === "undefined";
  }

  if (schema.required && isUndefined(data)) {
    throw new Error("Argument is required");
  }

  for (const [prop, propSchema] of Object.entries<Record<"type" | "required", any>>(schema.props)) {
    if (propSchema.required && isUndefined(data[prop])) {
      throw new Error(`"${prop}" is required`);
    }
    let typeCheck = true;
    if (propSchema.type && !isUndefined(data[prop])) {
      if (propSchema.type instanceof Array) {
        propSchema.type.forEach((type) => {
          typeCheck = typeCheck || checkType(data[prop], type);
        });
      } else {
        typeCheck = checkType(data[prop], propSchema.type);
      }
    }
    if (!typeCheck) {
      throw new Error(`"${prop}" is of wrong type.Expected type "${propSchema.type}"`);
    }
  }
}

export type Instruction = [method: string, argument: any] | [method: string, argument: any][];
export type InstructionQueue = Instruction[];

export class Cal {
  iframe?: HTMLIFrameElement;

  __config: Config;

  modalBox!: Element;

  inlineEl!: Element;

  namespace: string;

  actionManager: SdkActionManager;

  iframeReady!: boolean;

  iframeDoQueue: { method: keyof typeof methods; arg: any }[] = [];

  static actionsManagers: Record<Namespace, SdkActionManager>;

  static getQueryObject(config: Record<string, string>) {
    config = config || {};
    return {
      ...config,
      // guests is better for API but Booking Page accepts guest. So do the mapping
      guest: config.guests ?? undefined,
    };
  }

  processInstruction(instruction: Instruction) {
    instruction = [].slice.call(instruction, 0);
    if (instruction[0] instanceof Array) {
      // It is an instruction
      instruction.forEach((instruction) => {
        this.processInstruction(instruction);
      });
      return;
    }
    const [method, ...args] = instruction;
    if (!this[method]) {
      // Instead of throwing error, log and move forward in the queue
      log(`Instruction ${method} not FOUND`);
    }
    try {
      (this[method] as (...args: any[]) => void)(...args);
    } catch (e) {
      // Instead of throwing error, log and move forward in the queue
      log(`Instruction couldn't be executed`, e);
    }
    return instruction;
  }

  processQueue(queue: InstructionQueue) {
    queue.forEach((instruction) => {
      this.processInstruction(instruction);
    });

    queue.splice(0);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    /** @ts-ignore */ // We changed the definition of push here.
    queue.push = (instruction) => {
      this.processInstruction(instruction);
    };
  }

  createIframe({
    calLink,
    queryObject = {},
  }: {
    calLink: string;
    queryObject?: Record<string, string | string[] | Record<string, string>>;
  }) {
    const iframe = (this.iframe = document.createElement("iframe"));
    iframe.className = "cal-embed";
    iframe.name = "cal-embed";
    const config = this.getConfig();
    const { iframeAttrs, ...restQueryObject } = queryObject;

    if (iframeAttrs && typeof iframeAttrs !== "string" && !(iframeAttrs instanceof Array)) {
      iframe.setAttribute("id", iframeAttrs.id);
    }

    // Prepare searchParams from config
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(restQueryObject)) {
      if (value === undefined) {
        continue;
      }
      if (value instanceof Array) {
        value.forEach((val) => searchParams.append(key, val));
      } else {
        searchParams.set(key, value as string);
      }
    }

    const urlInstance = new URL(`${config.origin}/${calLink}`);
    if (!urlInstance.pathname.endsWith("embed")) {
      // TODO: Make a list of patterns that are embeddable. All except that should be allowed with a warning that "The page isn't optimized for embedding"
      urlInstance.pathname = `${urlInstance.pathname}/embed`;
    }
    urlInstance.searchParams.set("embed", this.namespace);
    if (config.debug) {
      urlInstance.searchParams.set("debug", "" + config.debug);
    }
    if (config.uiDebug) {
      iframe.style.border = "1px solid green";
    }

    // Merge searchParams from config onto the URL which might have query params already
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    for (const [key, value] of searchParams) {
      urlInstance.searchParams.append(key, value);
    }
    iframe.src = urlInstance.toString();
    return iframe;
  }

  init(namespaceOrConfig?: string | Config, config: Config = {} as Config) {
    if (typeof namespaceOrConfig !== "string") {
      config = (namespaceOrConfig || {}) as Config;
    }
    const { origin, ...restConfig } = config;
    if (origin) {
      this.__config.origin = origin;
    }
    this.__config = { ...this.__config, ...restConfig };
  }

  getConfig() {
    return this.__config;
  }

  // TODO: Maintain exposed methods in a separate namespace, so that unexpected methods don't become instructions

  /**
   * It is an instruction that adds embed iframe inline as last child of the element
   */
  inline({
    calLink,
    elementOrSelector,
    config,
  }: {
    calLink: string;
    elementOrSelector: string | HTMLElement;
    config: Record<string, string>;
  }) {
    // eslint-disable-next-line prefer-rest-params
    validate(arguments[0], {
      required: true,
      props: {
        calLink: {
          // TODO: Add a special type calLink for it and validate that it doesn't start with / or https?://
          required: true,
          type: "string",
        },
        elementOrSelector: {
          required: true,
          type: ["string", HTMLElement],
        },
        config: {
          required: false,
          type: Object,
        },
      },
    });
    config = config || {};
    // Keeping auto-scroll disabled for two reasons:
    // - If user scrolls the content to an appropriate position, it again resets it to default position which might not be for the liking of the user
    // - Sometimes, the position can be wrong(e.g. if there is a fixed position header on top coming above the iframe content).
    // Best solution might be to autoscroll only if the iframe is not fully visible, detection of full visibility might be tough

    // We need to keep in mind that autoscroll is meant to solve the problem when on a certain view(which is availability page right now), the height goes too high and then suddenly it becomes normal
    (config as unknown as any).__autoScroll = !!(config as unknown as any).__autoScroll;
    config.embedType = "inline";
    const iframe = this.createIframe({ calLink, queryObject: Cal.getQueryObject(config) });
    iframe.style.height = "100%";
    iframe.style.width = "100%";
    const element =
      elementOrSelector instanceof HTMLElement
        ? elementOrSelector
        : document.querySelector(elementOrSelector);
    if (!element) {
      throw new Error("Element not found");
    }
    const template = document.createElement("template");
    template.innerHTML = `<cal-inline style="max-height:inherit;height:inherit;min-height:inherit;display:flex;position:relative;flex-wrap:wrap;width:100%"></cal-inline>`;
    this.inlineEl = template.content.children[0];
    (this.inlineEl as unknown as any).__CalAutoScroll = config.__autoScroll;
    this.inlineEl.appendChild(iframe);
    element.appendChild(template.content);
  }

  floatingButton({
    calLink,
    buttonText = "Book my Cal",
    hideButtonIcon = false,
    attributes,
    buttonPosition = "bottom-right",
    buttonColor = "rgb(0, 0, 0)",
    buttonTextColor = "rgb(255, 255, 255)",
  }: {
    calLink: string;
    buttonText?: string;
    attributes?: Record<string, string>;
    hideButtonIcon?: boolean;
    buttonPosition?: "bottom-left" | "bottom-right";
    buttonColor: string;
    buttonTextColor: string;
  }) {
    // validate(arguments[0], {
    //   required: true,
    //   props: {
    //     calLink: {
    //       required: true,
    //       type: "string",
    //     },
    //   },
    // });
    let attributesString = "";
    let existingEl = null;
    if (attributes?.id) {
      attributesString += ` id="${attributes.id}"`;
      existingEl = document.getElementById(attributes.id);
    }
    let el = existingEl;
    if (!existingEl) {
      const template = document.createElement("template");
      template.innerHTML = `<cal-floating-button ${attributesString}  data-cal-namespace="${this.namespace}" data-cal-link="${calLink}"></cal-floating-button>`;
      el = template.content.children[0] as HTMLElement;
      document.body.appendChild(template.content);
    }

    if (buttonText) {
      el!.setAttribute("data-button-text", buttonText);
    }
    el!.setAttribute("data-hide-button-icon", "" + hideButtonIcon);
    el!.setAttribute("data-button-position", "" + buttonPosition);
    el!.setAttribute("data-button-color", "" + buttonColor);
    el!.setAttribute("data-button-text-color", "" + buttonTextColor);
  }

  modal({ calLink, config = {}, uid }: { calLink: string; config?: Record<string, string>; uid: number }) {
    const existingModalEl = document.querySelector(`cal-modal-box[uid="${uid}"]`);
    if (existingModalEl) {
      existingModalEl.setAttribute("state", "started");
      return;
    }
    config.embedType = "modal";
    const iframe = this.createIframe({ calLink, queryObject: Cal.getQueryObject(config) });
    iframe.style.borderRadius = "8px";

    iframe.style.height = "100%";
    iframe.style.width = "100%";
    const template = document.createElement("template");
    template.innerHTML = `<cal-modal-box uid="${uid}"></cal-modal-box>`;

    this.modalBox = template.content.children[0];
    this.modalBox.appendChild(iframe);
    this.actionManager.on("__closeIframe", () => {
      this.modalBox.setAttribute("state", "closed");
    });
    document.body.appendChild(template.content);
  }

  on({
    action,
    callback,
  }: {
    action: Parameters<SdkActionManager["on"]>[0];
    callback: Parameters<SdkActionManager["on"]>[1];
  }) {
    // eslint-disable-next-line prefer-rest-params
    validate(arguments[0], {
      required: true,
      props: {
        action: {
          required: true,
          type: "string",
        },
        callback: {
          required: true,
          type: Function,
        },
      },
    });
    this.actionManager.on(action, callback);
  }

  off({
    action,
    callback,
  }: {
    action: Parameters<SdkActionManager["on"]>[0];
    callback: Parameters<SdkActionManager["on"]>[1];
  }) {
    this.actionManager.off(action, callback);
  }

  preload({ calLink }: { calLink: string }) {
    // eslint-disable-next-line prefer-rest-params
    validate(arguments[0], {
      required: true,
      props: {
        calLink: {
          type: "string",
          required: true,
        },
      },
    });
    const iframe = document.body.appendChild(document.createElement("iframe"));
    const config = this.getConfig();

    const urlInstance = new URL(`${config.origin}/${calLink}`);
    urlInstance.searchParams.set("prerender", "true");
    iframe.src = urlInstance.toString();
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.display = "none";
  }

  ui(uiConfig: UiConfig) {
    validate(uiConfig, {
      required: true,
      props: {
        theme: {
          required: false,
          type: "string",
        },
        styles: {
          required: false,
          type: Object,
        },
      },
    });

    this.doInIframe({ method: "ui", arg: uiConfig });
  }

  doInIframe({
    method,
    arg,
  }: // TODO: Need some TypeScript magic here to remove hardcoded types
  | { method: "ui"; arg: Parameters<typeof methods["ui"]>[0] }
    | { method: "parentKnowsIframeReady"; arg: undefined }) {
    if (!this.iframeReady) {
      this.iframeDoQueue.push({ method, arg });
      return;
    }
    // TODO: Ensure that origin is as defined by user. Generally it would be cal.com but in case of self hosting it can be anything.
    this.iframe!.contentWindow!.postMessage({ originator: "CAL", method, arg }, "*");
  }

  constructor(namespace: string, q: InstructionQueue) {
    this.__config = {
      // Use WEBAPP_URL till full page reload problem with website URL is solved
      origin: WEBAPP_URL,
    };
    this.namespace = namespace;
    this.actionManager = new SdkActionManager(namespace);

    Cal.actionsManagers = Cal.actionsManagers || {};
    Cal.actionsManagers[namespace] = this.actionManager;

    this.processQueue(q);

    // 1. Initial iframe width and height would be according to 100% value of the parent element
    // 2. Once webpage inside iframe renders, it would tell how much iframe height should be increased so that my entire content is visible without iframe scroll
    // 3. Parent window would check what iframe height can be set according to parent Element
    this.actionManager.on("__dimensionChanged", (e) => {
      const { data } = e.detail;
      const iframe = this.iframe!;

      if (!iframe) {
        // Iframe might be pre-rendering
        return;
      }
      let unit = "px";
      if (data.__unit) {
        unit = data.__unit;
      }
      if (data.iframeHeight) {
        iframe.style.height = data.iframeHeight + unit;
      }

      // if (data.iframeWidth) {
      //   iframe.style.width = data.iframeWidth + unit;
      // }

      if (this.modalBox) {
        // It ensures that if the iframe is so tall that it can't fit in the parent window without scroll. Then force the scroll by restricting the max-height to innerHeight
        // This case is reproducible when viewing in ModalBox on Mobile.
        const spacingTopPlusBottom = 2 * 50; // 50 is the padding we want to keep to show close button comfortably. Make it same as top for bottom.
        iframe.style.maxHeight = window.innerHeight - spacingTopPlusBottom + "px";
      }
    });

    this.actionManager.on("__iframeReady", (e) => {
      this.iframeReady = true;
      this.doInIframe({ method: "parentKnowsIframeReady", arg: undefined });
      this.iframeDoQueue.forEach(({ method, arg }) => {
        this.doInIframe({ method, arg });
      });
    });

    this.actionManager.on("__routeChanged", () => {
      const { top, height } = this.inlineEl.getBoundingClientRect();
      // Try to readjust and scroll into view if more than 25% is hidden.
      // Otherwise we assume that user might have positioned the content appropriately already
      if (top < 0 && Math.abs(top / height) >= 0.25) {
        this.inlineEl.scrollIntoView({ behavior: "smooth" });
      }
    });

    this.actionManager.on("linkReady", (e) => {
      this.modalBox?.setAttribute("state", "loaded");
      this.inlineEl?.setAttribute("loading", "done");
    });

    this.actionManager.on("linkFailed", (e) => {
      const iframe = this.iframe;
      if (!iframe) {
        return;
      }
      this.inlineEl?.setAttribute("data-error-code", e.detail.data.code);
      this.modalBox?.setAttribute("data-error-code", e.detail.data.code);
      this.inlineEl?.setAttribute("loading", "failed");
      this.modalBox?.setAttribute("state", "failed");
    });
  }
}

export interface GlobalCal {
  (methodName: string, arg?: any): void;
  /** Marks that the embed.js is loaded. Avoids re-downloading it. */
  loaded?: boolean;
  /** Maintains a queue till the time embed.js isn't loaded */
  q?: InstructionQueue;
  /** If user registers multiple namespaces, those are available here */
  ns?: Record<string, GlobalCal>;
  instance?: Cal;
  __css?: string;
  fingerprint?: string;
  __logQueue?: any[];
}

export interface CalWindow extends Window {
  Cal?: GlobalCal;
}

globalCal.instance = new Cal("", globalCal.q!);

for (const [ns, api] of Object.entries(globalCal.ns!)) {
  api.instance = new Cal(ns, api.q!);
}

/**
 * Intercepts all postmessages and fires action in corresponding actionManager
 */
window.addEventListener("message", (e) => {
  const detail = e.data;
  const fullType = detail.fullType;
  const parsedAction = SdkActionManager.parseAction(fullType);
  if (!parsedAction) {
    return;
  }

  const actionManager = Cal.actionsManagers[parsedAction.ns];
  globalCal.__logQueue = globalCal.__logQueue || [];
  globalCal.__logQueue.push({ ...parsedAction, data: detail.data });

  if (!actionManager) {
    throw new Error("Unhandled Action" + parsedAction);
  }
  actionManager.fire(parsedAction.type, detail.data);
});

document.addEventListener("click", (e) => {
  const htmlElement = e.target;
  if (!(htmlElement instanceof HTMLElement)) {
    return;
  }
  const path = htmlElement.dataset.calLink;
  if (!path) {
    return;
  }
  const modalUniqueId = ((htmlElement as unknown as any).uniqueId =
    (htmlElement as unknown as any).uniqueId || Date.now());
  const namespace = htmlElement.dataset.calNamespace;
  const configString = htmlElement.dataset.calConfig || "";
  let config;
  try {
    config = JSON.parse(configString);
  } catch (e) {
    config = {};
  }
  let api = globalCal;
  if (namespace) {
    api = globalCal.ns![namespace];
  }
  if (!api) {
    throw new Error(`Namespace ${namespace} isn't defined`);
  }
  api("modal", {
    calLink: path,
    config,
    uid: modalUniqueId,
  });
});
