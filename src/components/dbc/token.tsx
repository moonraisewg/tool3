"use client";

import type React from "react";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { connectionMainnet } from "@/service/solana/connection";
import {
  Upload,
  X,
  ImageIcon,
  Twitter,
  Send,
  Globe,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import { createTokenTransaction } from "@/lib/dbc/createToken";

const formSchema = z.object({
  name: z.string().min(1, "Token name is required"),
  symbol: z.string().min(1, "Token symbol is required"),
  description: z.string().optional(),
  socialX: z.string().optional(),
  socialTelegram: z.string().optional(),
  socialWebsite: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateTokenForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSocialLinks, setShowSocialLinks] = useState(false);

  const handleFileUpload = useCallback((file: File) => {
    if (file) {
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a valid image file (JPG, PNG, GIF, WebP)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
  }, [previewUrl]);

  const onSubmit = async (data: FormValues) => {
    if (!publicKey || !signTransaction) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!uploadedFile) {
      toast.error("Please upload an image");
      return;
    }

    try {
      setLoading(true);

      const { transaction, baseMint } = await createTokenTransaction({
        name: data.name,
        symbol: data.symbol,
        description: data.description,
        socialX: data.socialX,
        socialTelegram: data.socialTelegram,
        socialWebsite: data.socialWebsite,
        file: uploadedFile,
        userPublicKey: publicKey,
      });

      const signedTx = await signTransaction(transaction);
      await connectionMainnet.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      toast.success("Token created successfully", {
        action: {
          label: "View on Birdeye",
          onClick: () =>
            window.open(
              `https://birdeye.so/token/${baseMint.publicKey.toBase58()}?chain=solana`,
              "_blank"
            ),
        },
      });

      reset();
      removeFile();
    } catch (err: unknown) {
      toast.error(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-h-[90vh] overflow-y-auto p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md space-y-6"
      >
        <h2 className="text-2xl font-bold text-center">Create a New Token</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Token Name *</Label>
            <Input id="name" {...register("name")} placeholder="Dipts Zyx" />
            {errors.name && (
              <p className="text-red-500 text-sm">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol">Token Symbol *</Label>
            <Input id="symbol" {...register("symbol")} placeholder="DIS" />
            {errors.symbol && (
              <p className="text-red-500 text-sm">{errors.symbol.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Describe your token and its purpose..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Token Image *</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {uploadedFile ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <Image
                    src={previewUrl || "/placeholder.svg"}
                    alt="Preview"
                    width={300}
                    height={300}
                    className="max-w-full h-32 object-cover rounded"
                    unoptimized
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={removeFile}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600">{uploadedFile.name}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <ImageIcon className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="text-lg font-medium">Drop your image here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Image
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between bg-transparent"
            onClick={() => setShowSocialLinks(!showSocialLinks)}
          >
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Social Links (Optional)
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                showSocialLinks ? "rotate-180" : ""
              }`}
            />
          </Button>

          {showSocialLinks && (
            <div className="space-y-3 pt-2 border-l-2 border-gray-200 pl-4 ml-2">
              <div className="space-y-2">
                <Label htmlFor="socialX" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />X (Twitter)
                </Label>
                <Input
                  id="socialX"
                  {...register("socialX")}
                  placeholder="https://x.com/yourusername"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="socialTelegram"
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Telegram
                </Label>
                <Input
                  id="socialTelegram"
                  {...register("socialTelegram")}
                  placeholder="https://t.me/yourchannel"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="socialWebsite"
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="socialWebsite"
                  {...register("socialWebsite")}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          )}
        </div>

        <Button type="submit" className="w-full mt-6" disabled={loading}>
          {loading ? "Creating Token..." : "Create Token"}
        </Button>
      </form>
    </div>
  );
}
