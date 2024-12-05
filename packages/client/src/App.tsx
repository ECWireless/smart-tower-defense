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
