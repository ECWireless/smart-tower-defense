import { useComponentValue } from "@latticexyz/react";
import { Button } from "../components/ui/button";
import { Toaster, toaster } from "../components/ui/toaster";
import { Box, Input, Text, VStack } from "@chakra-ui/react";
import { useMUD } from "../MUDContext";
import { singletonEntity } from "@latticexyz/store-sync/recs";
import { useCallback, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";

const DEFAULT_SOURCE_CODE = `
contract LogicSystem {
  function applyStateChange(uint32 currentState) public pure returns (uint32) {
    return currentState + 1;
  }
}
`;

export const Counter = (): JSX.Element => {
  const {
    components: { Counter },
    systemCalls: { deploySystem, getContractSize, runStateChange },
  } = useMUD();

  const counter = useComponentValue(Counter, singletonEntity);

  const [sourceCode, setSourceCode] = useState(DEFAULT_SOURCE_CODE.trim());

  const [isRunningLogic, setIsRunningLogic] = useState<boolean>(false);

  const [bytecode, setBytecode] = useState<string>("0x0");
  const [isCompiling, setIsCompiling] = useState<boolean>(false);

  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [systemSize, setSystemSize] = useState<number>(0);

  const onRunStateChange = useCallback(async () => {
    try {
      setIsRunningLogic(true);
      const { error, success } = await runStateChange();

      if (error && !success) {
        throw new Error(error);
      }

      toaster.create({
        title: "State Change Complete!",
        type: "success",
      });
    } catch (error) {
      console.error(`Smart contract error: ${(error as Error).message}`);

      toaster.create({
        description: (error as Error).message,
        title: "Error Running Logic",
        type: "error",
      });
    } finally {
      setIsRunningLogic(false);
    }
  }, [runStateChange]);

  const onCompileCode = useCallback(async () => {
    try {
      setIsCompiling(true);
      const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

      const res = await fetch(`${API_ENDPOINT}/compile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceCode }),
      });

      if (!res.ok) {
        throw new Error("Failed to compile code");
      }

      const bytecode = await res.text();
      setBytecode(`0x${bytecode}`);

      toaster.create({
        title: "Code Compiled!",
        type: "success",
      });
    } catch (error) {
      console.error("Error compiling code:", error);

      toaster.create({
        title: "Error Compiling Code",
        type: "error",
      });

      setBytecode("");
    } finally {
      setIsCompiling(false);
    }
  }, [sourceCode]);

  const onDeploySystem = useCallback(async () => {
    try {
      setIsDeploying(true);
      const { error, success } = await deploySystem(bytecode);

      if (error && !success) {
        throw new Error(error);
      }

      toaster.create({
        title: "System Deployed!",
        type: "success",
      });
    } catch (error) {
      console.error(`Smart contract error: ${(error as Error).message}`);

      toaster.create({
        description: (error as Error).message,
        title: "Error Deploying System",
        type: "error",
      });
    } finally {
      setIsDeploying(false);
    }
  }, [bytecode, deploySystem]);

  const onGetContractSize = useCallback(async () => {
    setSystemSize(Number(await getContractSize()));
  }, [getContractSize]);

  // Configure Solidity language
  loader.init().then((monacoInstance) => {
    monacoInstance.languages.register({ id: "solidity" });

    monacoInstance.languages.setMonarchTokensProvider("solidity", {
      tokenizer: {
        root: [
          [
            /\b(?:pragma|contract|function|string|public|constructor|memory|returns)\b/,
            "keyword",
          ],
          [/\b(?:uint256|string|bool|address)\b/, "type"],
          [/["'].*["']/, "string"],
          [/\/\/.*$/, "comment"],
        ],
      },
    });

    monacoInstance.languages.setLanguageConfiguration("solidity", {
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
      ],
    });
  });

  return (
    <VStack justifyContent="center" h="100vh" p={6} gapY={20}>
      <Box divideY="2px" w="100%">
        <Box py={4} spaceY={2}>
          <Text>
            <strong>Run Counter System</strong>
          </Text>
          <Text>
            Counter: <span>{counter?.value ?? "??"}</span>
          </Text>
          <Button
            disabled={isRunningLogic}
            onClick={onRunStateChange}
            type="button"
          >
            {isRunningLogic ? "Running..." : "Run Counter System"}
          </Button>
        </Box>
        <Box py={4} spaceY={2}>
          <Text>
            <strong>Compile New Counter System</strong>
          </Text>
          <Text>Compiler Version: 0.8.28</Text>
          <Box border="1px solid black" h="200px" w="100%">
            <Editor
              defaultLanguage="solidity"
              height="100%"
              onChange={(value) => setSourceCode(value ?? "")}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
              }}
              value={sourceCode}
            />
          </Box>
          <Button disabled={isCompiling} onClick={onCompileCode} type="button">
            {isCompiling ? "Compiling..." : "Compile"}
          </Button>
        </Box>
        <Box py={4} spaceY={2}>
          <Text>
            <strong>Deploy New Counter System</strong>
          </Text>
          <Box>
            <Input
              onChange={(event) => setBytecode(event.target.value)}
              type="text"
              value={bytecode}
            />
          </Box>
          <Button disabled={isDeploying} onClick={onDeploySystem} type="button">
            {isDeploying ? "Deploying..." : "Deploy System"}
          </Button>
        </Box>
        <Box py={4} spaceY={2}>
          <Text>
            <strong>Check System Size</strong>
          </Text>
          <Text>
            System size: <span>{systemSize} bytes</span>
          </Text>
          <Button type="button" onClick={onGetContractSize}>
            Get Contract Size
          </Button>
        </Box>
      </Box>
      <Toaster />
    </VStack>
  );
};
