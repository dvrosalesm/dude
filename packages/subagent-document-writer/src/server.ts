import clientPlugin from "./index.js";
import { gatewayManifest } from "./gateway/manifest.js";

export { gatewayManifest } from "./gateway/manifest.js";

export default {
  ...clientPlugin,
  gateway: gatewayManifest,
};
