export { LocalWorkspaceApiError } from "./errors";

export type {
  UiMessage,
  WorkspaceRecord,
} from "./shared";

export type { UploadBody } from "./uploads";

export {
  listSubagentWorkspaces,
  createSubagentWorkspace,
  getWorkspaceById,
  patchWorkspaceById,
  updateWorkspaceById,
  deleteWorkspaceById,
} from "./crud";

export {
  localUploadUrl,
  uploadBodyFromFile,
  presignChatImage,
} from "./uploads";

export {
  runAssistantMessage,
  resumeAssistantIfActive,
  abandonAssistantTurn,
  reloadAssistantMessages,
  clearAssistant,
  respondAssistantUiInput,
} from "./assistant";
export type { AssistantExecutionTrace } from "./assistant";

export {
  callWorkspaceAction,
  postWorkspaceUploadUrl,
  streamWorkspaceIngest,
} from "./actions";

export {
  bindWriterAutocomplete,
  canReachWriterAutocomplete,
  fetchWriterAutocomplete,
  type WriterAutocompleteRequest,
  type WriterAutocompleteResponse,
} from "./writer-autocomplete-binding";

export {
  bindGatewayWorkspaceSync,
  syncWorkspaceToGateway,
  type GatewayWorkspaceSnapshot,
} from "./gateway-sync-binding";

export {
  uploadPresentationImage,
  createPresentation,
  extractTextFromFile,
  exportDocumentWriter,
  imageExportDesignBranding,
  generatePresentationImage,
} from "./media";
