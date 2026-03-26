import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import type { Network } from "../utils/config";
import { handleError, hydrateWorldConfig, initializeContext, requireEnv } from "../utils/helper";
import { resolveTollGateIdsFromEnv } from "./extension-ids";
import { MODULE } from "./modules";

async function main() {
    console.log("============= Cancel Marketplace Listing ==============\n");

    try {
        const network = (process.env.SUI_NETWORK as Network) || "localnet";
        const playerKey = requireEnv("PLAYER_A_PRIVATE_KEY");
        const ctx = initializeContext(network, playerKey);
        const { client, keypair } = ctx;
        await hydrateWorldConfig(ctx);

        const { builderPackageId, marketplaceId } = resolveTollGateIdsFromEnv();

        // The listing ID to cancel (set via env or default to 1)
        const listingId = Number(process.env.LISTING_ID || "1");

        const tx = new Transaction();

        tx.moveCall({
            target: `${builderPackageId}::${MODULE.MARKETPLACE}::cancel_listing`,
            arguments: [
                tx.object(marketplaceId),
                tx.pure.u64(listingId),
            ],
        });

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: { showEffects: true, showObjectChanges: true, showEvents: true },
        });

        console.log("Listing cancelled!");
        console.log("Transaction digest:", result.digest);

        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes("ListingCancelledEvent")) {
                console.log("ListingCancelledEvent:", event.parsedJson);
            }
        }
    } catch (error) {
        handleError(error);
    }
}

main();
