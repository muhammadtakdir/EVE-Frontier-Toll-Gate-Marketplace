import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { getEnvConfig, handleError, hydrateWorldConfig, initializeContext } from "../utils/helper";
import { resolveTollGateExtensionIds } from "./extension-ids";
import { MODULE } from "./modules";

async function main() {
    console.log("============= Withdraw Toll Fees ==============\n");

    try {
        const env = getEnvConfig();
        const ctx = initializeContext(env.network, env.adminExportedKey);
        const { client, keypair, address } = ctx;
        await hydrateWorldConfig(ctx);

        const { builderPackageId, adminCapId, tollVaultId } =
            await resolveTollGateExtensionIds(client, address);

        const tx = new Transaction();

        // Withdraw all fees from vault
        const [withdrawnCoin] = tx.moveCall({
            target: `${builderPackageId}::${MODULE.TOLL_GATE}::withdraw_all_fees`,
            arguments: [
                tx.object(tollVaultId),
                tx.object(adminCapId),
            ],
        });

        // Transfer withdrawn fees to admin
        tx.transferObjects([withdrawnCoin], tx.pure.address(address));

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: { showEffects: true, showObjectChanges: true },
        });

        console.log("Fees withdrawn!");
        console.log("Transaction digest:", result.digest);
    } catch (error) {
        handleError(error);
    }
}

main();
