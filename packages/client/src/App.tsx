import { useComponentValue } from "@latticexyz/react";
import { useMUD } from "./MUDContext";
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

export const App = () => {
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
      const success = await runStateChange();

      if (!success) {
        throw new Error("Failed to run state change");
      }
    } catch (error) {
      console.error("Error running state change:", error);
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
    } catch (error) {
      console.error("Error compiling code:", error);
    } finally {
      setIsCompiling(false);
    }
  }, [sourceCode]);

  const onDeploySystem = useCallback(async () => {
    try {
      setIsDeploying(true);
      const success = await deploySystem(bytecode);

      if (!success) {
        throw new Error("Failed to deploy system");
      }
    } catch (error) {
      console.error("Error deploying system:", error);
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
    <>
      <div>
        <p>
          <strong>Run Counter System</strong>
        </p>
        <div>
          Counter: <span>{counter?.value ?? "??"}</span>
        </div>
        <button
          disabled={isRunningLogic}
          onClick={onRunStateChange}
          type="button"
        >
          {isRunningLogic ? "Running..." : "Run Counter System"}
        </button>
      </div>
      <br />
      <hr />
      <p>
        <strong>Compile New Counter System</strong>
      </p>
      <div>
        <p>Compiler Version: 0.8.28</p>
        <div
          style={{ border: "1px solid black", height: "200px", width: "100%" }}
        >
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
        </div>
      </div>
      <button disabled={isCompiling} onClick={onCompileCode} type="button">
        {isCompiling ? "Compiling..." : "Compile"}
      </button>
      <br />
      <br />
      <hr />
      <p>
        <strong>Deploy New Counter System</strong>
      </p>
      <div>
        <input
          onChange={(event) => setBytecode(event.target.value)}
          style={{
            width: "50%",
          }}
          type="text"
          value={bytecode}
        />
      </div>
      <button disabled={isDeploying} onClick={onDeploySystem} type="button">
        {isDeploying ? "Deploying..." : "Deploy system"}
      </button>
      <br />
      <br />
      <hr />
      <p>
        <strong>Check System Size</strong>
      </p>
      <div>
        System size: <span>{systemSize} bytes</span>
      </div>
      <button type="button" onClick={onGetContractSize}>
        Get contract size
      </button>
    </>
  );
};
