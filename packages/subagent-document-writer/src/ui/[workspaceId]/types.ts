import type { WriterConfiguration } from "@dude/subagent-document-writer/types";

export type WriterWorkspace = {
  id: string;
  name: string;
  date?: string;
  configurations?: WriterConfiguration;
};
