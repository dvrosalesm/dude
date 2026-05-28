import type { WriterConfiguration } from "@dude/specialist-document-writer/types";

export type WriterWorkspace = {
  id: string;
  name: string;
  date?: string;
  configurations?: WriterConfiguration;
};
