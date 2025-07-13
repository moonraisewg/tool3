"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Upload, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTokenCreation, tokenExtensions, TextOptionType, SliderOptionType } from "@/service/token/token-extensions/token-creation";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import React from "react";
import Image from "next/image";
import { useIsMobile } from "@/hooks/use-mobile";

export const TokenCreationForm = () => {
  const isMobile = useIsMobile();
  const {
    selectedExtensions,
    uploadingImage,
    formErrors,
    tokenData,
    validationErrors,
    handleImageUpload,
    toggleExtension,
    updateExtensionOption,
    handleCreateToken,
    setTokenData
  } = useTokenCreation();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [openExtensions, setOpenExtensions] = useState<Record<string, boolean>>({});

  const formSchema = z.object({
    name: z.string().optional(),
    symbol: z.string().max(10, { message: "Token symbol must not exceed 10 characters" }).optional(),
    decimals: z.string().refine(val => {
      const num = parseInt(val);
      return !isNaN(num) && num >= 0 && num <= 9;
    }, { message: "Decimals must be a number between 0-9" }),
    supply: z.string().refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: "Supply must be greater than 0" }),
    description: z.string().optional(),
    websiteUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal("")),
    twitterUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal("")),
    telegramUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal("")),
    discordUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal(""))
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      symbol: "",
      decimals: "9",
      supply: "1000000",
      description: "",
      websiteUrl: "",
      twitterUrl: "",
      telegramUrl: "",
      discordUrl: ""
    },
  });

  const toggleExtensionOpen = (extId: string) => {
    setOpenExtensions(prev => ({
      ...prev,
      [extId]: !prev[extId]
    }));
  };

  const initializeTokenData = useCallback(() => {
    setTokenData({
      name: "",
      symbol: "",
      decimals: "9",
      supply: "1000000",
      description: "",
      image: null,
      imageUrl: "",
      extensionOptions: {},
      websiteUrl: "",
      twitterUrl: "",
      telegramUrl: "",
      discordUrl: ""
    });

    form.reset({
      name: "",
      symbol: "",
      decimals: "9",
      supply: "1000000",
      description: "",
      websiteUrl: "",
      twitterUrl: "",
      telegramUrl: "",
      discordUrl: ""
    });
  }, [form, setTokenData]);

  const handleOpenExtensions = useCallback(() => {
    setOpenExtensions(prevState => {
      const newOpenState = { ...prevState };
      selectedExtensions.forEach(extId => {
        newOpenState[extId] = true;
      });
      return newOpenState;
    });
  }, [selectedExtensions]);

  useEffect(() => {
    initializeTokenData();
  }, [initializeTokenData]);

  useEffect(() => {
    handleOpenExtensions();
  }, [handleOpenExtensions]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      setTokenData(prev => ({
        ...prev,
        name: value.name || "",
        symbol: value.symbol || "",
        decimals: value.decimals || "9",
        supply: value.supply || "1000000",
        description: value.description || "",
        websiteUrl: value.websiteUrl || "",
        twitterUrl: value.twitterUrl || "",
        telegramUrl: value.telegramUrl || "",
        discordUrl: value.discordUrl || "",
      }));
    });

    return () => subscription.unsubscribe();
  }, [form, setTokenData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      handleImageUpload(file);
    }
  };

  const onSubmit = () => {
    const hasMetadataExtension = selectedExtensions.includes("metadata") || selectedExtensions.includes("metadata-pointer");

    if (hasMetadataExtension) {
      if (!form.getValues('name')) {
        form.setError('name', { type: 'manual', message: 'Token name is required' });
        return;
      }

      if (!form.getValues('symbol')) {
        form.setError('symbol', { type: 'manual', message: 'Token symbol is required' });
        return;
      }

      if (!imagePreview && !tokenData.imageUrl) {
        toast.error("Please upload a token image");
        return;
      }
    }

    handleCreateToken();
  };

  return (
    <div className={`md:p-3 mx-auto my-2`}>
      <h1 className="text-2xl font-bold text-gray-900 sm:mb-6 flex items-center justify-center">
        Create Token
      </h1>
      <div className="pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className={`pt-6 px-1 pb-2 ${!isMobile && "border-gear"}`}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className={`space-y-6 ${!isMobile && "max-h-[calc(100vh-200px)] overflow-y-auto px-2"}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Moon Token" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="symbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token Symbol</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. MOON" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="decimals"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decimals</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" max="9" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supply"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Supply</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="e.g. 1000000" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="A brief description of your token" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>Token Image</FormLabel>
                    <div className="flex items-start gap-4">
                      <div className="w-24 h-24 border border-gear-gray rounded-lg flex items-center justify-center overflow-hidden">
                        {imagePreview ? (
                          <Image src={imagePreview} alt="Token preview" width={96} height={96} className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="relative">
                          <Input
                            type="file"
                            id="token-image"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="mb-2 focus:border-purple-500 focus:ring-purple-500"
                            disabled={uploadingImage}
                          />
                          {uploadingImage && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin h-4 w-4 border-2 border-purple-600 rounded-full border-t-transparent"></div>
                                <span className="text-sm text-purple-600">Uploading...</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          Upload a square image (recommended size: 256x256 pixels)
                        </p>
                        {formErrors.image && (
                          <p className="text-sm text-red-500 mt-1">{formErrors.image}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Social Links (Optional)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="websiteUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://example.com" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="twitterUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Twitter URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://twitter.com/username" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="telegramUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telegram URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://t.me/groupname" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="discordUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discord URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://discord.gg/invite" {...field} className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1 mt-1" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full cursor-pointer">Continue to Review</Button>
                </form>
              </Form>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="sticky top-4">
              <div className={`pt-2 px-1 pb-1 ${!isMobile && "border-gear"}`}>
                <h3 className="text-lg text-center font-medium mb-4">Token Extensions</h3>
                <div className="space-y-3 max-h-[min(624px,_calc(100vh-224px))] overflow-y-auto">
                  {tokenExtensions.map((extension) => {
                    const isSelected = selectedExtensions.includes(extension.id);
                    const isExpanded = openExtensions[extension.id] || false;
                    const hasError = isSelected && validationErrors[extension.id] && Object.keys(validationErrors[extension.id]).length > 0;
                    const hasOptions = extension.options && extension.options.length > 0;

                    return (
                      <div
                        key={extension.id}
                        className={cn(
                          "border rounded-lg overflow-hidden transition-all duration-200",
                          isSelected
                            ? hasError
                              ? "border-red-500 bg-red-50/5"
                              : `border-${extension.color} bg-${extension.bgColor}/20`
                            : "border-gray-200 bg-white hover:bg-gray-50",
                          extension.disabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div
                          className={cn(
                            "p-3 cursor-pointer",
                            isSelected && isExpanded && "border-b border-gray-200"
                          )}
                          onClick={() => {
                            if (!extension.disabled) {
                              if (!isSelected) {
                                toggleExtension(extension.id, tokenExtensions);
                                toggleExtensionOpen(extension.id);
                              } else {
                                toggleExtensionOpen(extension.id);
                              }
                            } else {
                              toast.error(`Extension not available: ${extension.disabledReason}`);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {extension.icon && <extension.icon className={`w-5 h-5 ${extension.color}`} />}
                              <span className="font-medium">{extension.name}</span>
                              {hasError && (
                                <span className="text-xs text-red-500 px-2 py-0.5 bg-red-50 rounded">Required fields missing</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {isSelected && hasOptions && (
                                <ChevronRight
                                  className={cn(
                                    "w-4 h-4 text-gray-500 transition-transform",
                                    isExpanded && "transform rotate-90"
                                  )}
                                />
                              )}
                              <div className="flex-shrink-0 ml-2">
                                {isSelected ? (
                                  <div
                                    className="w-5 h-5 border rounded-sm bg-purple-600 flex items-center justify-center cursor-pointer"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      toggleExtension(extension.id, tokenExtensions);
                                    }}
                                  >
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                ) : (
                                  <div
                                    className="w-5 h-5 border rounded-sm border-gray-300 hover:border-purple-500 cursor-pointer"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      toggleExtension(extension.id, tokenExtensions);
                                      toggleExtensionOpen(extension.id);
                                    }}
                                  ></div>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{extension.description}</p>
                        </div>


                        {isSelected && isExpanded && hasOptions && (
                          <div className="p-4 bg-white">
                            {extension.id === "transfer-fees" ? (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  {extension.options.filter(opt => opt.id === "fee-percentage").map(option => {
                                    const optionValue = tokenData.extensionOptions?.[extension.id]?.[option.id];
                                    const error = validationErrors[extension.id]?.[option.id];
                                    const sliderOption = option as SliderOptionType;

                                    return (
                                      <div key={option.id} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium">
                                            {option.label}: {optionValue || sliderOption.defaultValue}%
                                          </label>
                                          {error && <span className="text-xs text-red-500">{error}</span>}
                                        </div>
                                        <input
                                          type="range"
                                          min={sliderOption.min}
                                          max={sliderOption.max}
                                          step={sliderOption.step}
                                          value={optionValue || sliderOption.defaultValue}
                                          onChange={(e) => updateExtensionOption(extension.id, option.id, parseFloat(e.target.value))}
                                          className="w-full"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {extension.options.filter(opt => opt.id !== "fee-percentage").map(option => {
                                    const optionValue = tokenData.extensionOptions?.[extension.id]?.[option.id];
                                    const error = validationErrors[extension.id]?.[option.id];
                                    const textOption = option as TextOptionType;

                                    return (
                                      <div key={option.id} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium">
                                            {option.label}{textOption.required ? ' *' : ''}
                                          </label>
                                          {error && <span className="text-xs text-red-500">{error}</span>}
                                        </div>
                                        <Input
                                          type="text"
                                          placeholder={textOption.placeholder}
                                          value={optionValue || ''}
                                          onChange={(e) => updateExtensionOption(extension.id, option.id, e.target.value)}
                                          className={cn(error && "border-red-500")}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="bg-gray-50 p-3 rounded-md mt-2">
                                  <div className="flex items-start">
                                    <Info className="w-4 h-4 text-gray-500 mr-2 mt-0.5" />
                                    <p className="text-xs text-gray-600">
                                      Transfer fees are calculated as a percentage each time tokens are transferred.
                                      When users transfer tokens, fees are automatically deducted and sent to the
                                      configured Fee Receiver address.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {extension.options.map(option => {
                                  const optionValue = tokenData.extensionOptions?.[extension.id]?.[option.id];
                                  const error = validationErrors[extension.id]?.[option.id];

                                  if (option.type === 'text') {
                                    const textOption = option as TextOptionType;
                                    return (
                                      <div key={option.id} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium">
                                            {option.label}{textOption.required ? ' *' : ''}
                                          </label>
                                          {error && <span className="text-xs text-red-500">{error}</span>}
                                        </div>
                                        <Input
                                          type="text"
                                          placeholder={textOption.placeholder}
                                          value={optionValue || ''}
                                          onChange={(e) => updateExtensionOption(extension.id, option.id, e.target.value)}
                                          className={cn(error && "border-red-500")}
                                        />
                                      </div>
                                    );
                                  }

                                  if (option.type === 'slider') {
                                    const sliderOption = option as SliderOptionType;
                                    return (
                                      <div key={option.id} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium">
                                            {option.label}: {optionValue || sliderOption.defaultValue}{option.id === 'fee-percentage' ? '%' : ''}
                                          </label>
                                          {error && <span className="text-xs text-red-500">{error}</span>}
                                        </div>
                                        <input
                                          type="range"
                                          min={sliderOption.min}
                                          max={sliderOption.max}
                                          step={sliderOption.step}
                                          value={optionValue || sliderOption.defaultValue}
                                          onChange={(e) => updateExtensionOption(extension.id, option.id, parseFloat(e.target.value))}
                                          className="w-full"
                                        />
                                      </div>
                                    );
                                  }

                                  if (option.type === 'select') {
                                    return (
                                      <div key={option.id} className="space-y-1">
                                        <label className="text-sm font-medium">
                                          {option.label}
                                        </label>
                                        <select
                                          value={optionValue || option.defaultValue}
                                          onChange={(e) => updateExtensionOption(extension.id, option.id, e.target.value)}
                                          className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                          {option.options.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                        {error && <span className="text-xs text-red-500">{error}</span>}
                                      </div>
                                    );
                                  }

                                  return null;
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 