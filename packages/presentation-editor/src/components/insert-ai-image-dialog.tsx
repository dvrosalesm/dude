"use client";

import { useCallback, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dude/ui/components/dialog";
import { Button } from "@dude/ui/components/button";
import { Textarea } from "@dude/ui/components/textarea";
import { generatePresentationImage } from "@dude/workspaces";

type InsertAiImageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (imageBase64: string, contentType: string) => void;
};

export function InsertAiImageDialog({
  open,
  onOpenChange,
  onInsert,
}: InsertAiImageDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{
    base64: string;
    contentType: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPrompt("");
    setGenerating(false);
    setPreview(null);
    setImageData(null);
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setPreview(null);
    setImageData(null);

    try {
      const result = await generatePresentationImage({ prompt: prompt.trim() });

      if (!result.success) {
        setError(result.error || "Image generation failed.");
        return;
      }

      const { imageBase64, contentType } = result;
      setPreview(`data:${contentType};base64,${imageBase64}`);
      setImageData({ base64: imageBase64, contentType });
    } catch {
      setError("Failed to generate image. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [prompt]);

  const handleInsert = useCallback(() => {
    if (!imageData) return;
    onInsert(imageData.base64, imageData.contentType);
    reset();
    onOpenChange(false);
  }, [imageData, onInsert, onOpenChange, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Generated Image
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Describe the image you want
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A professional business chart showing growth..."
              className="mt-1 resize-none"
              rows={3}
              disabled={generating}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="w-full"
            variant="outline"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Image
              </>
            )}
          </Button>

          {preview && (
            <div className="border rounded-lg p-2 bg-gray-50">
              {/* Dynamic data URL preview; Next Image is not a good fit here. */}
              <img
                src={preview}
                alt="AI generated preview"
                className="max-h-48 mx-auto rounded"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!imageData}>
            Insert Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
