"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Upload, ChevronRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import React from "react";
import Image from "next/image";


const formSchema = z.object({
  name: z.string().min(1, { message: "Token name is required" }),
  symbol: z.string().min(1, { message: "Token symbol is required" }).max(10, { message: "Token symbol must not exceed 10 characters" }),
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

const TokenCreationForm = () => {
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
    setTokenData,
    initializeTokenData
  } = useTokenCreation();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [openExtensions, setOpenExtensions] = useState<Record<string, boolean>>({});
  const toggleExtensionOpen = (extId: string) => {
    setOpenExtensions(prev => ({
      ...prev,
      [extId]: !prev[extId]
    }));
  };
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
  useEffect(() => {
    initializeTokenData();
  }, []);
  
  useEffect(() => {
    const extensionsToOpen = selectedExtensions.filter(extId => {
      if (extId !== "metadata" && extId !== "metadata-pointer") {
        const ext = tokenExtensions.find(e => e.id === extId);
        return ext && ext.options && ext.options.length > 0;
      }
      return false;
    });

    if (extensionsToOpen.length > 0) {
      const newOpenState = {...openExtensions};
      extensionsToOpen.forEach(extId => {
        newOpenState[extId] = true;
      });
      setOpenExtensions(newOpenState);
    }
  }, [selectedExtensions]);

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
    if (!imagePreview && !tokenData.imageUrl) {
      toast.error("Please upload a token image");
      return;
    }
    
    handleCreateToken();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Create Token</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Moon Token" {...field} />
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
                            <Input placeholder="e.g. MOON" {...field} />
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
                            <Input type="number" min="0" max="9" {...field} />
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
                            <Input type="text" placeholder="e.g. 1000000" {...field} />
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
                          <Textarea placeholder="A brief description of your token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>Token Image</FormLabel>
                    <div className="flex items-start gap-4">
                      <div className="w-24 h-24 border rounded-lg flex items-center justify-center overflow-hidden">
                        {imagePreview ? (
                          <Image src={imagePreview} alt="Token preview" width={96} height={96} className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Input
                          type="file"
                          id="token-image"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="mb-2"
                          disabled={uploadingImage}
                        />
                        <p className="text-sm text-gray-500">
                          Upload a square image (recommended size: 256x256 pixels)
                        </p>
                        {formErrors.image && (
                          <p className="text-sm text-red-500 mt-1">{formErrors.image}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Social Links Section */}
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
                              <Input placeholder="https://example.com" {...field} />
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
                              <Input placeholder="https://twitter.com/username" {...field} />
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
                              <Input placeholder="https://t.me/groupname" {...field} />
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
                              <Input placeholder="https://discord.gg/invite" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">Continue to Review</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Extensions Panel */}
        <div className="space-y-4">
          <div className="sticky top-4">
            <Card className="mb-4">
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">Token Extensions</h3>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
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
                              {extension.isRequired && (
                                <Badge variant="secondary" className="text-xs">Required</Badge>
                              )}
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
                                  <div className="flex items-center">
                                    {!extension.isRequired && (
                                      <X
                                        className="w-5 h-5 text-gray-400 hover:text-red-500 mr-1 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExtension(extension.id, tokenExtensions);
                                        }}
                                      />
                                    )}
                                    <Check className="w-5 h-5 text-green-500" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 border rounded-full"></div>
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
                                {/* Fee Percentage as slider */}
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
                                
                                {/* Other fields in a grid layout */}
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenCreationForm; 