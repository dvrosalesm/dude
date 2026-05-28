"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dude/ui/components/dialog";
import { Button } from "@dude/ui/components/button";

type InsertImageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (imageBase64: string, contentType: string) => void;
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function InsertImageDialog({
  open,
  onOpenChange,
  onInsert,
}: InsertImageDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{
    base64: string;
    contentType: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPreview(null);
    setImageData(null);
    setError(null);
    setDragOver(false);
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError("Image must be under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl format: "data:<contentType>;base64,<data>"
      const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!match) {
        setError("Failed to read image.");
        return;
      }
      setPreview(dataUrl);
      setImageData({ base64: match[2], contentType: match[1] });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

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
            <ImageIcon className="h-5 w-5" />
            Insert Image
          </DialogTitle>
        </DialogHeader>

        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            <>
              {/* Dynamic data URL preview; Next Image is not a good fit here. */}
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 mx-auto rounded"
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Upload className="h-8 w-8" />
              <p className="text-sm">
                Drag & drop an image here, or click to browse
              </p>
              <p className="text-xs text-gray-400">Max 5MB</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              // Reset input so same file can be re-selected
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

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
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
