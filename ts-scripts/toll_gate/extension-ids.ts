import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { requireEnv } from "../utils/helper";
import { MODULE } from "./modules";

export type TollGateExtensionIds = {
    builderPackageId: string;
    adminCapId: string;
    extensionConfigId: string;
    tollVaultId: string;
    marketplaceId: string;
};

export function requireBuilderPackageId(): string {
    return requireEnv("TOLL_GATE_PACKAGE_ID");
}

/**
 * Resolve IDs from env only (no AdminCap lookup).
 */
export function resolveTollGateIdsFromEnv(): {
    builderPackageId: string;
    extensionConfigId: string;
    tollVaultId: string;
    marketplaceId: string;
} {
    return {
        builderPackageId: requireBuilderPackageId(),
        extensionConfigId: requireEnv("TOLL_EXTENSION_CONFIG_ID"),
        tollVaultId: requireEnv("TOLL_VAULT_ID"),
        marketplaceId: requireEnv("MARKETPLACE_ID"),
    };
}

/**
 * Resolve all toll_gate extension IDs including AdminCap.
 */
export async function resolveTollGateExtensionIds(
    client: SuiJsonRpcClient,
    ownerAddress: string
): Promise<TollGateExtensionIds> {
    const { builderPackageId, extensionConfigId, tollVaultId, marketplaceId } =
        resolveTollGateIdsFromEnv();
    const adminCapType = `${builderPackageId}::${MODULE.CONFIG}::AdminCap`;
    const result = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: { StructType: adminCapType },
        limit: 1,
    });

    const adminCapId = result.data[0]?.data?.objectId;
    if (!adminCapId) {
        throw new Error(
            `AdminCap not found for ${ownerAddress}. ` +
                `Make sure this address published the toll_gate package.`
        );
    }

    return { builderPackageId, adminCapId, extensionConfigId, tollVaultId, marketplaceId };
}
