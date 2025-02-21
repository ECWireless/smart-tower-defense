require("dotenv").config();
const express = require("express");
const { compile } = require("solc");
var cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3002;

app.get("/", (_, res) => {
  res.send("Smart Tower Defense API");
});

app.post("/compile", (req, res) => {
  try {
    const { sourceCode } = req.body;

    const fileName = "LogicSystem.sol";

    const input = {
      language: "Solidity",
      sources: {
        [fileName]: {
          content: sourceCode,
        },
      },
      settings: {
        outputSelection: {
          "*": {
            "*": ["*"],
          },
        },
      },
    };

    const output = JSON.parse(compile(JSON.stringify(input)));
    const contractName = Object.keys(output.contracts[fileName])[0];
    const bytecode =
      output.contracts[fileName][contractName].evm.bytecode.object;

    if (!bytecode) {
      res.status(500).send("Error compiling contract");
    }

    res.send(bytecode);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error compiling contract");
  }
});

app.listen(port, () => {
  console.log(`Smart Tower Defense API listening on port ${port}`);
});
