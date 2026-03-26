import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_OBJECT_ID } from "../utils/constants";
import type { Network } from "../utils/config";
import { handleError, hydrateWorldConfig, initializeContext, requireEnv } from "../utils/helper";
import { resolveTollGateIdsFromEnv } from "./extension-ids";
import { MODULE } from "./modules";

async function main() {
    console.log("============= Buy Marketplace Listing ==============\n");

    try {
        const network = (process.env.SUI_NETWORK as Network) || "localnet";
        const playerKey = requireEnv("PLAYER_B_PRIVATE_KEY");
        const ctx = initializeContext(network, playerKey);
        const { client, keypair } = ctx;
        await hydrateWorldConfig(ctx);

        const { builderPackageId, marketplaceId } = resolveTollGateIdsFromEnv();

        // The listing ID to buy (set via env or default to 1)
        const listingId = Number(process.env.LISTING_ID || "1");

        const tx = new Transaction();

        // Split coin for payment (0.5 SUI = 500_000_000 MIST)
        const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(500_000_000)]);

        tx.moveCall({
            target: `${builderPackageId}::${MODULE.MARKETPLACE}::buy_listing`,
            arguments: [
                tx.object(marketplaceId),
                tx.pure.u64(listingId),
                paymentCoin,
                tx.object(CLOCK_OBJECT_ID),
            ],
        });

        // Merge remaining change back into gas coin
        tx.mergeCoins(tx.gas, [paymentCoin]);

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: { showEffects: true, showObjectChanges: true, showEvents: true },
        });

        console.log("Item purchased!");
        console.log("Transaction digest:", result.digest);

        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes("ItemSoldEvent")) {
                console.log("ItemSoldEvent:", event.parsedJson);
            }
        }
    } catch (error) {
        handleError(error);
    }
}

main();
