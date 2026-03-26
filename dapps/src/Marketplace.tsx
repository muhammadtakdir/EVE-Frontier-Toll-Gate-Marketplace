import { useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  TextField,
  Button,
  Badge,
  Separator,
} from "@radix-ui/themes";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";

const CLOCK_OBJECT_ID = "0x6";

/**
 * Marketplace UI — create listings, buy items, cancel listings.
 *
 * Requires env vars VITE_TOLL_PACKAGE_ID, VITE_TOLL_EXTENSION_CONFIG_ID,
 * VITE_MARKETPLACE_ID set in the dApp .env.
 */
export function Marketplace() {
  const account = useCurrentAccount();
  const { signAndExecuteTransaction } = useDAppKit();

  // Create listing state
  const [itemTypeId, setItemTypeId] = useState("");
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("500000000"); // 0.5 SUI
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Buy listing state
  const [buyListingId, setBuyListingId] = useState("");
  const [buyPrice, setBuyPrice] = useState("500000000");
  const [buyStatus, setBuyStatus] = useState<string | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);

  // Cancel listing state
  const [cancelListingId, setCancelListingId] = useState("");
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const packageId = import.meta.env.VITE_TOLL_PACKAGE_ID || "";
  const extensionConfigId = import.meta.env.VITE_TOLL_EXTENSION_CONFIG_ID || "";
  const marketplaceId = import.meta.env.VITE_MARKETPLACE_ID || "";

  // === Create Listing ===
  const handleCreateListing = async () => {
    if (!account || !itemTypeId || !itemId || !price) return;
    setCreateLoading(true);
    setCreateStatus(null);

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::marketplace::create_listing`,
        arguments: [
          tx.object(extensionConfigId),
          tx.object(marketplaceId),
          tx.pure.u64(BigInt(itemTypeId)),
          tx.pure.u64(BigInt(itemId)),
          tx.pure.u64(BigInt(price)),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });
      setCreateStatus(`Listed! Digest: ${result.digest}`);
    } catch (err) {
      setCreateStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreateLoading(false);
    }
  };

  // === Buy Listing ===
  const handleBuyListing = async () => {
    if (!account || !buyListingId || !buyPrice) return;
    setBuyLoading(true);
    setBuyStatus(null);

    try {
      const tx = new Transaction();
      const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(buyPrice))]);

      tx.moveCall({
        target: `${packageId}::marketplace::buy_listing`,
        arguments: [
          tx.object(marketplaceId),
          tx.pure.u64(Number(buyListingId)),
          paymentCoin,
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      // Merge remaining change back into gas
      tx.mergeCoins(tx.gas, [paymentCoin]);

      const result = await signAndExecuteTransaction({ transaction: tx });
      setBuyStatus(`Purchased! Digest: ${result.digest}`);
    } catch (err) {
      setBuyStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBuyLoading(false);
    }
  };

  // === Cancel Listing ===
  const handleCancelListing = async () => {
    if (!account || !cancelListingId) return;
    setCancelLoading(true);
    setCancelStatus(null);

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::marketplace::cancel_listing`,
        arguments: [
          tx.object(marketplaceId),
          tx.pure.u64(Number(cancelListingId)),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });
      setCancelStatus(`Cancelled! Digest: ${result.digest}`);
    } catch (err) {
      setCancelStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCancelLoading(false);
    }
  };

  if (!account) return null;

  return (
    <Box my="4" p="4" style={{ background: "var(--gray-a3)", borderRadius: 8 }}>
      <Flex direction="column" gap="4">
        <Flex align="center" gap="2">
          <Heading size="4">Marketplace</Heading>
          <Badge color="blue">Trade Items</Badge>
        </Flex>

        <Text size="2" color="gray">
          List items for sale, buy from other players, or cancel your listings.
        </Text>

        {/* === Create Listing === */}
        <Box p="3" style={{ background: "var(--gray-a2)", borderRadius: 6 }}>
          <Heading size="3" mb="2">Sell Item</Heading>
          <Flex direction="column" gap="2">
            <label>
              <Text size="2" weight="bold">Item Type ID</Text>
              <TextField.Root
                placeholder="e.g. 12345"
                value={itemTypeId}
                onChange={(e) => setItemTypeId(e.target.value)}
              />
            </label>
            <label>
              <Text size="2" weight="bold">Item ID</Text>
              <TextField.Root
                placeholder="e.g. 67890"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              />
            </label>
            <label>
              <Text size="2" weight="bold">Price (MIST)</Text>
              <TextField.Root
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <Text size="1" color="gray">
              Price: {(Number(price) / 1_000_000_000).toFixed(2)} SUI
            </Text>
            <Button
              onClick={handleCreateListing}
              disabled={createLoading || !itemTypeId || !itemId || !price}
            >
              {createLoading ? "Creating..." : "Create Listing"}
            </Button>
            {createStatus && (
              <Text size="2" color={createStatus.startsWith("Error") ? "red" : "green"}>
                {createStatus}
              </Text>
            )}
          </Flex>
        </Box>

        <Separator size="4" />

        {/* === Buy Listing === */}
        <Box p="3" style={{ background: "var(--gray-a2)", borderRadius: 6 }}>
          <Heading size="3" mb="2">Buy Item</Heading>
          <Flex direction="column" gap="2">
            <label>
              <Text size="2" weight="bold">Listing ID</Text>
              <TextField.Root
                placeholder="e.g. 1"
                value={buyListingId}
                onChange={(e) => setBuyListingId(e.target.value)}
              />
            </label>
            <label>
              <Text size="2" weight="bold">Payment Amount (MIST)</Text>
              <TextField.Root
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
              />
            </label>
            <Text size="1" color="gray">
              Payment: {(Number(buyPrice) / 1_000_000_000).toFixed(2)} SUI
            </Text>
            <Button
              onClick={handleBuyListing}
              disabled={buyLoading || !buyListingId || !buyPrice}
            >
              {buyLoading ? "Buying..." : "Buy Item"}
            </Button>
            {buyStatus && (
              <Text size="2" color={buyStatus.startsWith("Error") ? "red" : "green"}>
                {buyStatus}
              </Text>
            )}
          </Flex>
        </Box>

        <Separator size="4" />

        {/* === Cancel Listing === */}
        <Box p="3" style={{ background: "var(--gray-a2)", borderRadius: 6 }}>
          <Heading size="3" mb="2">Cancel Listing</Heading>
          <Flex direction="column" gap="2">
            <label>
              <Text size="2" weight="bold">Listing ID to Cancel</Text>
              <TextField.Root
                placeholder="e.g. 1"
                value={cancelListingId}
                onChange={(e) => setCancelListingId(e.target.value)}
              />
            </label>
            <Button
              color="red"
              onClick={handleCancelListing}
              disabled={cancelLoading || !cancelListingId}
            >
              {cancelLoading ? "Cancelling..." : "Cancel Listing"}
            </Button>
            {cancelStatus && (
              <Text size="2" color={cancelStatus.startsWith("Error") ? "red" : "green"}>
                {cancelStatus}
              </Text>
            )}
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}
