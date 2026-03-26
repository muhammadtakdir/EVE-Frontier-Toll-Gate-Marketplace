import { useState } from "react";
import { Box, Flex, Heading, Text, TextField, Button, Badge } from "@radix-ui/themes";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";

const CLOCK_OBJECT_ID = "0x6";

/**
 * Toll Gate UI — pay a toll to get a JumpPermit.
 *
 * Requires env vars VITE_TOLL_PACKAGE_ID, VITE_TOLL_EXTENSION_CONFIG_ID,
 * VITE_TOLL_VAULT_ID set in the dApp .env.
 */
export function TollGate() {
  const account = useCurrentAccount();
  const { signAndExecuteTransaction } = useDAppKit();

  const [sourceGateId, setSourceGateId] = useState("");
  const [destGateId, setDestGateId] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [tollFee, setTollFee] = useState("100000000"); // 0.1 SUI default
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const packageId = import.meta.env.VITE_TOLL_PACKAGE_ID || "";
  const extensionConfigId = import.meta.env.VITE_TOLL_EXTENSION_CONFIG_ID || "";
  const tollVaultId = import.meta.env.VITE_TOLL_VAULT_ID || "";

  const handlePayToll = async () => {
    if (!account || !sourceGateId || !destGateId || !characterId) return;
    setLoading(true);
    setStatus(null);

    try {
      const tx = new Transaction();
      const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(tollFee))]);

      tx.moveCall({
        target: `${packageId}::toll_gate::pay_toll_and_jump`,
        arguments: [
          tx.object(extensionConfigId),
          tx.object(tollVaultId),
          tx.object(sourceGateId),
          tx.object(destGateId),
          tx.object(characterId),
          paymentCoin,
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      // Merge remaining change back into gas
      tx.mergeCoins(tx.gas, [paymentCoin]);

      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      setStatus(`Toll paid! Digest: ${result.digest}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!account) return null;

  return (
    <Box my="4" p="4" style={{ background: "var(--gray-a3)", borderRadius: 8 }}>
      <Flex direction="column" gap="3">
        <Flex align="center" gap="2">
          <Heading size="4">Toll Gate</Heading>
          <Badge color="green">Pay to Jump</Badge>
        </Flex>

        <Text size="2" color="gray">
          Pay a SUI toll fee to receive a JumpPermit for gate passage.
        </Text>

        <Flex direction="column" gap="2">
          <label>
            <Text size="2" weight="bold">Source Gate ID</Text>
            <TextField.Root
              placeholder="0x..."
              value={sourceGateId}
              onChange={(e) => setSourceGateId(e.target.value)}
            />
          </label>
          <label>
            <Text size="2" weight="bold">Destination Gate ID</Text>
            <TextField.Root
              placeholder="0x..."
              value={destGateId}
              onChange={(e) => setDestGateId(e.target.value)}
            />
          </label>
          <label>
            <Text size="2" weight="bold">Character ID</Text>
            <TextField.Root
              placeholder="0x..."
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
            />
          </label>
          <label>
            <Text size="2" weight="bold">Toll Fee (MIST)</Text>
            <TextField.Root
              value={tollFee}
              onChange={(e) => setTollFee(e.target.value)}
            />
          </label>
        </Flex>

        <Text size="1" color="gray">
          Fee: {(Number(tollFee) / 1_000_000_000).toFixed(2)} SUI
        </Text>

        <Button
          onClick={handlePayToll}
          disabled={loading || !sourceGateId || !destGateId || !characterId}
        >
          {loading ? "Processing..." : "Pay Toll & Get Permit"}
        </Button>

        {status && (
          <Text size="2" color={status.startsWith("Error") ? "red" : "green"}>
            {status}
          </Text>
        )}
      </Flex>
    </Box>
  );
}
