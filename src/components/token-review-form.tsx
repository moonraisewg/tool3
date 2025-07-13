"use client";

import { ArrowLeft, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTokenReview, tokenExtensionsMap, getExtensionDetails } from "@/service/token/token-extensions/token-review";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";

const TokenReviewForm = () => {
  const router = useRouter();
  const {
    isLoading,
    tokenData,
    selectedExtensions,
    isCreating,
    success,
    imageUrl,
    createdTokenMint,
    transactionSignature,
    creationError,
    handleConfirmCreate,
    handleBack,
    goToHome
  } = useTokenReview(router);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading token data...</span>
      </div>
    );
  }

  if (success && createdTokenMint) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6 text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Token Created Successfully!</h2>
            <p className="text-gray-500 mb-6">Your token has been created and is now ready to use</p>

            <div className="space-y-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500">Token Address</p>
                <p className="text-base font-mono break-all">{createdTokenMint}</p>
              </div>

              {transactionSignature && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-500">Transaction</p>
                  <p className="text-base font-mono break-all">{transactionSignature}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                onClick={goToHome}
              >
                Return to Home
              </Button>

              <Button
                onClick={() => {
                  window.open(
                    `https://explorer.solana.com/address/${createdTokenMint}?cluster=devnet`,
                    "_blank"
                  );
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

  // Error state
  if (creationError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Token Creation Failed</h2>
            <p className="text-gray-700 mb-6">{creationError}</p>

            <div className="flex gap-4">
              <Button variant="outline" onClick={handleBack}>Go Back</Button>
              <Button onClick={() => handleConfirmCreate()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <button
          className="flex items-center text-gray-500 hover:text-gray-700 mr-4"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>
        <h1 className="text-2xl font-bold">Review Token Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4 mb-6">
                {imageUrl && (
                  <div className="h-16 w-16 rounded-lg overflow-hidden relative">
                    <Image
                      src={imageUrl}
                      alt="Token"
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold">{tokenData?.name}</h2>
                  <p className="text-gray-500">{tokenData?.symbol}</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Token Supply</p>
                  <p className="text-base">{tokenData?.supply}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Decimals</p>
                  <p className="text-base">{tokenData?.decimals}</p>
                </div>
                {tokenData?.description && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">Description</p>
                    <p className="text-base">{tokenData.description}</p>
                  </div>
                )}
              </div>

              {(tokenData?.websiteUrl || tokenData?.twitterUrl ||
                tokenData?.telegramUrl || tokenData?.discordUrl) && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-3">
                      <h3 className="font-medium">Social Links</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                        {tokenData?.websiteUrl && (
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-500 mr-2">Website:</span>
                            <a href={tokenData.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                              {tokenData.websiteUrl}
                            </a>
                          </div>
                        )}
                        {tokenData?.twitterUrl && (
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-500 mr-2">Twitter:</span>
                            <a href={tokenData.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                              {tokenData.twitterUrl}
                            </a>
                          </div>
                        )}
                        {tokenData?.telegramUrl && (
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-500 mr-2">Telegram:</span>
                            <a href={tokenData.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                              {tokenData.telegramUrl}
                            </a>
                          </div>
                        )}
                        {tokenData?.discordUrl && (
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-500 mr-2">Discord:</span>
                            <a href={tokenData.discordUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                              {tokenData.discordUrl}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4">Selected Extensions</h3>
              <div className="space-y-3">
                {selectedExtensions.map((extId) => {
                  const extension = tokenExtensionsMap[extId];
                  const extensionDetails = tokenData?.extensionOptions?.[extId] ?
                    getExtensionDetails(extId, tokenData.extensionOptions[extId]) : null;

                  if (!extension) return null;

                  return (
                    <div
                      key={extId}
                      className={cn(
                        "p-3 border rounded-lg",
                        extension.bgColor
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {extension.icon && <extension.icon className={`w-4 h-4 ${extension.color}`} />}
                        <span className="font-medium">{extension.name}</span>
                      </div>

                      {extensionDetails && (
                        <div className="mt-2 text-sm">
                          {extensionDetails.displayItems?.map((item, i) => (
                            <div key={i} className="flex justify-between text-gray-600">
                              <span>{item.label}:</span>
                              <span className="font-medium">{item.value}</span>
                            </div>
                          ))}

                          {extensionDetails.truncatedAddress && (
                            <div className="flex justify-between text-gray-600">
                              <span>Address:</span>
                              <span className="font-medium font-mono text-xs">
                                {extensionDetails.truncatedAddress}
                              </span>
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

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4">Create Token</h3>
              <p className="text-sm text-gray-500 mb-4">
                Once you confirm, your wallet will be prompted to sign a transaction to create the token.
              </p>
              <Button
                className="w-full cursor-pointer"
                onClick={handleConfirmCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Token...
                  </>
                ) : "Create Token"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TokenReviewForm; 