import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_OBJECT_ID, ITEM_A_TYPE_ID, ITEM_A_ITEM_ID } from "../utils/constants";
import type { Network } from "../utils/config";
import { handleError, hydrateWorldConfig, initializeContext, requireEnv } from "../utils/helper";
import { resolveTollGateIdsFromEnv } from "./extension-ids";
import { MODULE } from "./modules";

async function main() {
    console.log("============= Create Marketplace Listing ==============\n");

    try {
        const network = (process.env.SUI_NETWORK as Network) || "localnet";
        const playerKey = requireEnv("PLAYER_A_PRIVATE_KEY");
        const ctx = initializeContext(network, playerKey);
        const { client, keypair } = ctx;
        await hydrateWorldConfig(ctx);

        const { builderPackageId, extensionConfigId, marketplaceId } =
            resolveTollGateIdsFromEnv();

        const tx = new Transaction();

        // Create a listing: sell an item for 0.5 SUI
        tx.moveCall({
            target: `${builderPackageId}::${MODULE.MARKETPLACE}::create_listing`,
            arguments: [
                tx.object(extensionConfigId),
                tx.object(marketplaceId),
                tx.pure.u64(ITEM_A_TYPE_ID), // item type
                tx.pure.u64(ITEM_A_ITEM_ID), // item id
                tx.pure.u64(500_000_000), // price: 0.5 SUI
                tx.object(CLOCK_OBJECT_ID),
            ],
        });

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: { showEffects: true, showObjectChanges: true, showEvents: true },
        });

        console.log("Listing created!");
        console.log("Transaction digest:", result.digest);

        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes("ListingCreatedEvent")) {
                console.log("ListingCreatedEvent:", event.parsedJson);
            }
        }
    } catch (error) {
        handleError(error);
    }
}

main();
