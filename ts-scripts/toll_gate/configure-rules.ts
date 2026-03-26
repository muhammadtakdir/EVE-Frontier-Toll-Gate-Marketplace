import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { getEnvConfig, handleError, hydrateWorldConfig, initializeContext } from "../utils/helper";
import { resolveTollGateExtensionIds } from "./extension-ids";
import { MODULE } from "./modules";

async function main() {
    console.log("============= Configure Toll Gate & Marketplace Rules ==============\n");

    try {
        const env = getEnvConfig();
        const ctx = initializeContext(env.network, env.adminExportedKey);
        const { client, keypair, address } = ctx;
        await hydrateWorldConfig(ctx);

        const { builderPackageId, adminCapId, extensionConfigId } =
            await resolveTollGateExtensionIds(client, address);

        const tx = new Transaction();

        // Set toll config: fee = 100_000_000 MIST (0.1 SUI), expiry = 1 hour, enabled
        tx.moveCall({
            target: `${builderPackageId}::${MODULE.TOLL_GATE}::set_toll_config`,
            arguments: [
                tx.object(extensionConfigId),
                tx.object(adminCapId),
                tx.pure.u64(100_000_000), // 0.1 SUI toll fee
                tx.pure.u64(3600000), // 1 hour permit expiry
                tx.pure.bool(true), // enabled
            ],
        });

        // Set marketplace config: enabled, 24h default expiry, 0 bps fee
        tx.moveCall({
            target: `${builderPackageId}::${MODULE.MARKETPLACE}::set_marketplace_config`,
            arguments: [
                tx.object(extensionConfigId),
                tx.object(adminCapId),
                tx.pure.bool(true), // enabled
                tx.pure.u64(86400000), // 24 hour listing expiry
                tx.pure.u64(0), // 0 basis points fee
            ],
        });

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: { showEffects: true, showObjectChanges: true },
        });

        console.log("Toll gate & marketplace configured!");
        console.log("Transaction digest:", result.digest);
    } catch (error) {
        handleError(error);
    }
}

main();
