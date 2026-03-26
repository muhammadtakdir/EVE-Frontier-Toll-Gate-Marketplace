import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { deriveObjectId } from "../utils/derive-object-id";
import {
    GAME_CHARACTER_B_ID,
    GATE_ITEM_ID_1,
    GATE_ITEM_ID_2,
    CLOCK_OBJECT_ID,
} from "../utils/constants";
import type { Network } from "../utils/config";
import { handleError, hydrateWorldConfig, initializeContext, requireEnv } from "../utils/helper";
import { resolveTollGateIdsFromEnv } from "./extension-ids";
import { MODULE } from "./modules";

async function payTollAndJump(
    ctx: ReturnType<typeof initializeContext>,
    sourceGateItemId: bigint,
    destinationGateItemId: bigint,
    characterItemId: bigint
) {
    const { client, keypair, config } = ctx;
    const { builderPackageId, extensionConfigId, tollVaultId } = resolveTollGateIdsFromEnv();

    const sourceGateId = deriveObjectId(config.objectRegistry, sourceGateItemId, config.packageId);
    const destinationGateId = deriveObjectId(
        config.objectRegistry,
        destinationGateItemId,
        config.packageId
    );
    const characterId = deriveObjectId(config.objectRegistry, characterItemId, config.packageId);

    const tx = new Transaction();

    // Split a coin for toll payment (0.1 SUI = 100_000_000 MIST)
    const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(100_000_000)]);

    tx.moveCall({
        target: `${builderPackageId}::${MODULE.TOLL_GATE}::pay_toll_and_jump`,
        arguments: [
            tx.object(extensionConfigId),
            tx.object(tollVaultId),
            tx.object(sourceGateId),
            tx.object(destinationGateId),
            tx.object(characterId),
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

    console.log("Toll paid & JumpPermit issued!");
    console.log("Transaction digest:", result.digest);

    // Log events
    const events = result.events || [];
    for (const event of events) {
        if (event.type.includes("TollPaidEvent")) {
            console.log("TollPaidEvent:", event.parsedJson);
        }
    }
}

async function main() {
    console.log("============= Pay Toll & Get Jump Permit ==============\n");
    try {
        const network = (process.env.SUI_NETWORK as Network) || "localnet";
        const playerKey = requireEnv("PLAYER_B_PRIVATE_KEY");
        const ctx = initializeContext(network, playerKey);
        await hydrateWorldConfig(ctx);
        await payTollAndJump(ctx, GATE_ITEM_ID_1, GATE_ITEM_ID_2, BigInt(GAME_CHARACTER_B_ID));
    } catch (error) {
        handleError(error);
    }
}

main();
