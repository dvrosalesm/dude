import { trimAutocompleteCompletion } from "@dude/subagent-document-writer/lib/trim-autocomplete-completion";

describe("trimAutocompleteCompletion", () => {
  it("strips quotes and limits length", () => {
    const prefix = "The quick brown ";
    const raw = '"fox jumps over the lazy dog"';
    expect(trimAutocompleteCompletion(raw, prefix)).toBe("fox jumps over the lazy dog");
  });

  it("removes duplicated prefix from model output", () => {
    const prefix = "Hello world, this is ";
    expect(trimAutocompleteCompletion("Hello world, this is a test.", prefix)).toBe(
      "a test.",
    );
  });
});
