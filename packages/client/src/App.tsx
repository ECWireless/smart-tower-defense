import { useComponentValue } from "@latticexyz/react";
import { useMUD } from "./MUDContext";
import { singletonEntity } from "@latticexyz/store-sync/recs";
import { useCallback, useState } from "react";

export const App = () => {
  const {
    components: { Counter },
    systemCalls: { deploySystem, getContractSize, runStateChange },
  } = useMUD();

  const counter = useComponentValue(Counter, singletonEntity);

  const [bytecode, setBytecode] = useState<string>("0x0");
  const [systemSize, setSystemSize] = useState<number>(0);
  const [sourceCode, setSourceCode] = useState(
    `
    contract LogicSystem {
        function applyStateChange(uint32 currentState) public pure returns (uint32) {
            return currentState + 1;
        }
    }
  `.trim()
  );

  const onCompileCode = useCallback(async () => {
    try {
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
    }
  }, [sourceCode]);

  const onGetContractSize = useCallback(async () => {
    setSystemSize(Number(await getContractSize()));
  }, [getContractSize]);

  return (
    <>
      <div>
        <div>
          Counter: <span>{counter?.value ?? "??"}</span>
        </div>
        <button
          type="button"
          onClick={async (event) => {
            event.preventDefault();
            console.log("new counter value:", await runStateChange());
          }}
        >
          Run state change
        </button>
      </div>
      <br />
      <hr />
      <br />
      <div>
        <p>Compiler Version: 0.8.28</p>
        <textarea
          cols={100}
          onChange={(event) => setSourceCode(event.target.value)}
          rows={10}
          value={sourceCode}
        />
      </div>
      <button type="button" onClick={onCompileCode}>
        Compile code
      </button>
      <br />
      <hr />
      <br />
      <div>
        <input
          onChange={(event) => setBytecode(event.target.value)}
          type="text"
          value={bytecode}
        />
      </div>
      <button
        type="button"
        onClick={async (event) => {
          event.preventDefault();
          console.log("system deployed:", await deploySystem(bytecode));
        }}
      >
        Deploy system
      </button>
      <br />
      <hr />
      <br />
      <div>
        System size: <span>{systemSize}</span>
      </div>
      <button type="button" onClick={onGetContractSize}>
        Get contract size
      </button>
    </>
  );
};
