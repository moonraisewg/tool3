import { initSdk, txVersion } from "@/service/raydium-sdk"
import {
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    getCpmmPdaAmmConfigId,
} from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { mintAAddress, mintBAddress, amountA, amountB } = body

        const raydium = await initSdk()
        const mintA = await raydium.token.getTokenInfo(mintAAddress)
        const mintB = await raydium.token.getTokenInfo(mintBAddress)

        console.log(mintA, mintB);

        const feeConfigs = await raydium.api.getCpmmConfigs()
        if (raydium.cluster === 'devnet') {
            feeConfigs.forEach((config) => {
                config.id = getCpmmPdaAmmConfigId(
                    DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                    config.index
                ).publicKey.toBase58()
            })
        }

        const { execute, extInfo, transaction } = await raydium.cpmm.createPool({
            programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
            poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
            mintA,
            mintB,
            mintAAmount: new BN(amountA),
            mintBAmount: new BN(amountB),
            startTime: new BN(0),
            feeConfig: feeConfigs[0],
            associatedOnly: false,
            ownerInfo: {
                useSOLBalance: true,
            },
            txVersion,
        })
        console.log("transaction", transaction);

        const { txId } = await execute({ sendAndConfirm: true })

        return Response.json({
            success: true,
            txId,
            poolKeys: Object.keys(extInfo.address).reduce(
                (acc, cur) => ({
                    ...acc,
                    [cur]: extInfo.address[cur as keyof typeof extInfo.address].toString(),
                }),
                {}
            ),
        })
    } catch (err: any) {
        console.error('Pool creation error:', err)
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
        })
    }
}
