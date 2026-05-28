import "./load-env.js";
import { startServer } from "./app.js";

startServer().catch((error) => {
  console.error("[dude-server] failed to start:", error);
  process.exit(1);
});
