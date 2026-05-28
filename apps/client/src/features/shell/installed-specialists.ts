import hostConfig from "../../../../../specialists.config.client";
import { createSpecialistRegistry } from "@dude/sdk";

export const installedSpecialists = createSpecialistRegistry(hostConfig);
