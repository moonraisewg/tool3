"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Check, X, Search, ExternalLink } from "lucide-react";
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
import { useTokenExtensionUpdate, updatableTokenExtensions } from "@/service/token/token-extensions/token-extension-update";
import { TextOptionType, SliderOptionType } from "@/service/token/token-extensions/token-creation";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Spinner } from "./ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";

const formSchema = z.object({
  mintAddress: z.string().min(1, { message: "Token mint address is required" }),
});

const TokenExtensionUpdateForm = () => {
  const isMobile = useIsMobile();
  const {
    isLoading,
    selectedExtensions,
    validationErrors,
    tokenInfo,
    extensionOptions,
    isUpdating,
    updateSuccess,
    updateError,
    explorerLinks,
    setMintAddress,
    toggleExtension,
    updateExtensionOption,
    validateMintAddress,
    handleUpdateExtensions
  } = useTokenExtensionUpdate();

  const [openExtensions, setOpenExtensions] = useState<Record<string, boolean>>({});
  const [addressValidated, setAddressValidated] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mintAddress: "",
    },
  });

  const toggleExtensionOpen = (extId: string) => {
    setOpenExtensions(prev => ({
      ...prev,
      [extId]: !prev[extId]
    }));
  };

  const onSubmitMintAddress = async (data: z.infer<typeof formSchema>) => {
    setAddressValidated(false);
    const isValid = await validateMintAddress(data.mintAddress);
    if (isValid) {
      setMintAddress(data.mintAddress);
      setAddressValidated(true);
    }
  };

  const onUpdateExtensions = () => {
    handleUpdateExtensions();
  };

  // Reset form when update is successful
  useEffect(() => {
    if (updateSuccess) {
      form.reset();
      setAddressValidated(false);
    }
  }, [updateSuccess, form]);

  // Nếu cập nhật thành công, chỉ hiển thị thông báo thành công
  if (updateSuccess && explorerLinks.transaction) {
    return (
      <div className={`md:p-3 max-w-[800px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
          Extensions Updated Successfully
        </h1>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <p className="text-gray-500 mb-6">The extensions have been added to your token account and are now ready to use</p>

            <div className="space-y-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500">Token Account</p>
                <p className="text-base font-mono break-all">{explorerLinks.tokenAccount?.replace('https://explorer.solana.com/address/', '').replace('?cluster=devnet', '')}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500">Transaction</p>
                <p className="text-base font-mono break-all">{explorerLinks.transaction?.replace('https://explorer.solana.com/tx/', '').replace('?cluster=devnet', '')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
              >
                Return to Home
              </Button>

              <Button
                onClick={() => {
                  window.open(explorerLinks.tokenAccount || undefined, "_blank");
                }}
              >
                View on Explorer <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`md:p-3 max-w-[1000px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
        Update Token Extensions
      </h1>
      <div className="pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className={`${tokenInfo || isLoading ? "md:col-span-2" : "md:col-span-3"}`}>
            <div>
              <div className={`${tokenInfo ? "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border shadow-sm p-6" : ""}`}>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitMintAddress)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="mintAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token Mint Address</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter token mint address"
                                {...field}
                                disabled={addressValidated || isLoading}
                              />
                            </FormControl>
                            <Button
                              type="submit"
                              size="icon"
                              disabled={addressValidated || isLoading}
                              className="cursor-pointer"
                            >
                              {isLoading ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>

                {tokenInfo && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <h3 className="font-medium mb-2">Token Details</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Name:</span> {tokenInfo.name}
                      </div>
                      <div>
                        <span className="font-medium">Symbol:</span> {tokenInfo.symbol}
                      </div>
                      <div>
                        <span className="font-medium">Decimals:</span> {tokenInfo.decimals}
                      </div>
                      <div>
                        <span className="font-medium">Supply:</span> {tokenInfo.supply}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {addressValidated && (
              <Card className="mt-3">
                <CardContent className="">
                  <h2 className="text-xl font-medium mb-4">Update Extensions</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Select the extensions you want to add to your token. Note that not all extensions can be added after token creation.
                  </p>

                  {selectedExtensions.length > 0 ? (
                    <div className="space-y-4">
                      {selectedExtensions.map(extId => {
                        const extension = updatableTokenExtensions.find(e => e.id === extId);
                        if (!extension) return null;

                        return (
                          <div key={extId} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-medium">{extension.name}</h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExtension(extId, updatableTokenExtensions)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="space-y-4">
                              {extension.options.map(option => {
                                const optionValue = extensionOptions[extId]?.[option.id];
                                const error = validationErrors[extId]?.[option.id];

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
                                        onChange={(e) => updateExtensionOption(extId, option.id, e.target.value)}
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
                                        onChange={(e) => updateExtensionOption(extId, option.id, parseFloat(e.target.value))}
                                        className="w-full"
                                      />
                                    </div>
                                  );
                                }

                                return null;
                              })}
                            </div>
                          </div>
                        );
                      })}

                      <Button
                        onClick={onUpdateExtensions}
                        className="w-full mt-4 cursor-pointer"
                        disabled={isUpdating}
                      >
                        {isUpdating ? <Spinner size="sm" className="mr-2" /> : null}
                        Update Token Extensions
                      </Button>

                      {updateError && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                          {updateError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center border rounded-lg bg-gray-50">
                      <p className="text-gray-500">Select extensions from the panel on the right to add them to your token.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Extensions Panel */}
          {addressValidated && (
            <div className="space-y-4">
              <div className="">
                <Card>
                  <CardContent className="">
                    <h3 className="text-lg font-medium mb-4">Available Extensions</h3>
                    <div className="space-y-3 max-h-[min(624px,_calc(100vh-280px))] overflow-y-auto pr-2">
                      {updatableTokenExtensions.map((extension) => {
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
                                    toggleExtension(extension.id, updatableTokenExtensions);
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
                                      <div className="flex items-center">
                                        <X
                                          className="w-5 h-5 text-gray-400 hover:text-red-500 mr-1 cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExtension(extension.id, updatableTokenExtensions);
                                          }}
                                        />
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
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenExtensionUpdateForm; 