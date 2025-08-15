require("dotenv").config();
const express = require("express");
const { compile } = require("solc");
const cors = require("cors");
const {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  formatEther,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseEther,
  formatUnits,
} = require("viem");
const sgMail = require("@sendgrid/mail");
const { OpenAI } = require("openai");
const { privateKeyToAccount } = require("viem/accounts");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const { base, baseSepolia, foundry, pyrope, redstone } = require("viem/chains");
const BASE_ESCOW_ABI = require("./abi/baseEscrowAbi.json");
const SELL_EMITTER_ABI = require("./abi/sellEmitterAbi.json");
const WORLD_ABI = require("./abi/worldAbi.json");

const SUPPORTED_CHAINS = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [foundry.id]: foundry,
  [pyrope.id]: pyrope,
  [redstone.id]: redstone,
};

const ESCROW_CONTRACTS = {
  [base.id]: "0x977437F82fb629FBF3028d485144Ad5666228133",
  [baseSepolia.id]: "0xcF490CB83152Fd01F19aD1aB3C44445B2436f14E",
};

const SELL_EMITTER_CONTRACTS = {
  [pyrope.id]: "0x745d57Ff5D45cAF46cf26c416a708B05cE59F08a",
  [redstone.id]: "0x378bbc1a01D1976c5C13f2393744bFE7034457be",
};

const app = express();
app.use(cors());
app.use(express.json());

// SendGrid setup
if (!process.env.SENDGRID_API_KEY) {
  console.error("Missing SENDGRID_API_KEY in environment variables");
  process.exit(1);
}

if (!process.env.ALERT_EMAIL) {
  console.error("Missing ALERT_EMAIL in environment variables");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in environment variables");
  process.exit(1);
}

if (!process.env.PINATA_JWT) {
  console.error("Missing PINATA_JWT in environment variables");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const LOW_BALANCE_THRESHOLD = parseFloat("0.00001"); // Around $0.02 right now
const alertEmail = process.env.ALERT_EMAIL;
let lastAlertSent = 0;
const ALERT_INTERVAL_MS = 1000 * 60 * 60; // 1 hour cooldown

// In-memory rate limits for faucet
const ipTimestamps = new Map();
const addressTimestamps = new Map();
const FAUCET_INTERVAL = 1000 * 60 * 1 * 1; // 1 minute
const FAUCET_AMOUNT = parseEther("0.000004"); // Around $0.008 right now

const port = process.env.PORT || 3002;

app.get("/", (_, res) => {
  res.send("Auto Tower Defense API");
});

app.post("/end-stale-battles", async (req, res) => {
  try {
    const { battleIds, chainId, worldAddress } = req.body;

    if (!battleIds || !Array.isArray(battleIds) || battleIds.length === 0) {
      return res.status(400).json({ error: "Invalid or missing battleIds" });
    }

    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) {
      return res.status(400).json({ error: "Invalid or missing chainId" });
    }

    if (!worldAddress || !isAddress(worldAddress)) {
      return res.status(400).json({ error: "Invalid or missing worldAddress" });
    }

    const publicClient = createPublicClient({
      batch: { multicall: false },
      chain,
      transport: http(),
    });

    const serverPrivateKey = process.env.FAUCET_PRIVATE_KEY;
    if (!serverPrivateKey) {
      return res
        .status(500)
        .json({ success: false, error: "Server wallet not configured" });
    }

    const serverAccount = privateKeyToAccount(serverPrivateKey);
    const serverWalletClient = createWalletClient({
      account: serverAccount,
      chain: SUPPORTED_CHAINS[chainId],
      transport: http(),
    });

    const args = {
      abi: WORLD_ABI,
      address: worldAddress,
      args: [battleIds],
      functionName: "app__endStaleBattles",
    };

    await publicClient.simulateContract(args);
    const txHash = await serverWalletClient.writeContract({
      ...args,
      account: serverAccount,
    });

    const { status } = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (status !== "success") {
      return res.status(500).json({ error: "Transaction failed" });
    }

    return res.status(200).json({ success: true, txHash });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Ending stale battles failed" });
  }
});

app.post("/reward-top-kingdoms", async (req, res) => {
  try {
    const { chainId, worldAddress } = req.body;

    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) {
      return res.status(400).json({ error: "Invalid or missing chainId" });
    }

    if (!worldAddress || !isAddress(worldAddress)) {
      return res.status(400).json({ error: "Invalid or missing worldAddress" });
    }

    const publicClient = createPublicClient({
      batch: { multicall: false },
      chain,
      transport: http(),
    });

    const serverPrivateKey = process.env.FAUCET_PRIVATE_KEY;
    if (!serverPrivateKey) {
      return res
        .status(500)
        .json({ success: false, error: "Server wallet not configured" });
    }

    const serverAccount = privateKeyToAccount(serverPrivateKey);
    const serverWalletClient = createWalletClient({
      account: serverAccount,
      chain: SUPPORTED_CHAINS[chainId],
      transport: http(),
    });

    const args = {
      abi: WORLD_ABI,
      address: worldAddress,
      args: [],
      functionName: "app__grantKingdomRewards",
    };

    await publicClient.simulateContract(args);
    const txHash = await serverWalletClient.writeContract({
      ...args,
      account: serverAccount,
    });

    const { status } = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (status !== "success") {
      return res.status(500).json({ error: "Transaction failed" });
    }

    return res.status(200).json({ success: true, txHash });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Granting kingdom rewards failed" });
  }
});

app.post("/check-username", async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a strict content moderator. Given a username, return whether it is acceptable based on standard content policies (no slurs, profanity, targeted harassment, or sexual content).",
        },
        {
          role: "user",
          content: `Is the username "${username}" acceptable? Reply only "yes" or "no".`,
        },
      ],
      temperature: 0,
    });

    const answer = response.choices[0].message.content.toLowerCase().trim();

    return res.json({ username, acceptable: answer === "yes" });
  } catch (error) {
    console.error("OpenAI error:", error);
    return res.status(500).json({ error: "Error checking username" });
  }
});

app.post("/faucet", async (req, res) => {
  const ip = req.ip;
  const { address, chainId } = req.body;

  if (!(address && isAddress(address))) {
    return res.status(400).json({ success: false, error: "Invalid address" });
  }

  if (!(chainId && SUPPORTED_CHAINS[chainId])) {
    return res.status(400).json({ success: false, error: "Invalid chainId" });
  }

  const normalizedAddress = getAddress(address);
  const now = Date.now();

  // Rate limiting
  const lastIp = ipTimestamps.get(ip) || 0;
  const lastAddr = addressTimestamps.get(normalizedAddress) || 0;
  if (now - lastIp < FAUCET_INTERVAL || now - lastAddr < FAUCET_INTERVAL) {
    return res
      .status(429)
      .json({ success: false, error: "Rate limit exceeded" });
  }

  try {
    const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;

    if (!faucetPrivateKey) {
      return res
        .status(500)
        .json({ success: false, error: "Faucet not configured" });
    }

    const account = privateKeyToAccount(faucetPrivateKey);
    const faucetClient = createWalletClient({
      account,
      chain: SUPPORTED_CHAINS[chainId],
      transport: http(),
    });

    const txHash = await faucetClient.sendTransaction({
      to: normalizedAddress,
      value: FAUCET_AMOUNT,
    });

    ipTimestamps.set(ip, now);
    addressTimestamps.set(normalizedAddress, now);

    // Check balance + send alert if needed
    const publicClient = createPublicClient({
      chain: SUPPORTED_CHAINS[chainId],
      transport: http(),
    });
    const balance = await publicClient.getBalance({ address: account.address });
    const balanceEth = parseFloat(formatEther(balance));

    if (
      balanceEth < LOW_BALANCE_THRESHOLD &&
      now - lastAlertSent > ALERT_INTERVAL_MS
    ) {
      try {
        await sgMail.send({
          to: alertEmail,
          from: alertEmail,
          subject: "Auto Tower Defense - ⚠️ Faucet balance is low!",
          text: `Your faucet has a low balance: ${balanceEth} ETH remaining on chain ID ${chainId}. Please refill it soon to keep the faucet operational.`,
        });
        lastAlertSent = now;
      } catch (emailErr) {
        console.error("SendGrid error:", emailErr);
      }
    }

    return res.json({ success: true, txHash });
  } catch (err) {
    console.error("Faucet error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
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
        metadata: {
          useLiteralContent: true,
          bytecodeHash: "none",
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

app.post("/buy-validator-signature", async (req, res) => {
  const { amount, buyer, destinationChainId, nonce, originChainId, txHash } =
    req.body;

  if (
    !(amount && buyer && destinationChainId && nonce && originChainId && txHash)
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const originChain = SUPPORTED_CHAINS[originChainId];
  const destinationChain = SUPPORTED_CHAINS[destinationChainId];
  const escrowAddress = ESCROW_CONTRACTS[originChainId];

  if (!SUPPORTED_CHAINS[originChainId]) {
    return res.status(400).json({ error: "Unsupported origin chain ID" });
  }

  if (!SUPPORTED_CHAINS[destinationChainId]) {
    return res.status(400).json({ error: "Unsupported destination chain ID" });
  }

  if (!escrowAddress) {
    return res.status(400).json({ error: "Escrow contract not deployed" });
  }

  try {
    const publicClient = createPublicClient({
      chain: originChain,
      transport: http(),
    });

    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash,
    });

    const eventLog = receipt.logs.find(
      (log) => log.address.toLowerCase() === escrowAddress.toLowerCase()
    );

    if (!eventLog) {
      return res
        .status(404)
        .json({ error: "No ElectricityPurchase event found" });
    }

    const parsedLog = decodeEventLog({
      abi: BASE_ESCOW_ABI,
      data: eventLog.data,
      topics: eventLog.topics,
    });

    if (
      parsedLog.eventName !== "ElectricityPurchase" ||
      parsedLog.args.buyer.toLowerCase() !== buyer.toLowerCase() ||
      parsedLog.args.amount !== BigInt(amount) ||
      parsedLog.args.nonce !== BigInt(nonce)
    ) {
      return res.status(400).json({ error: "Event mismatch" });
    }

    const encodedData = encodeAbiParameters(
      [
        { type: "address", name: "buyer" },
        { type: "uint256", name: "amount" },
        { type: "uint256", name: "nonce" },
      ],
      [buyer, amount, nonce]
    );
    const structHash = keccak256(encodedData);

    const { VALIDATOR_PRIVATE_KEY } = process.env;
    if (!VALIDATOR_PRIVATE_KEY) {
      return res.status(500).json({ error: "VALIDATOR_PRIVATE_KEY not set" });
    }
    const validatorAccount = privateKeyToAccount(VALIDATOR_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account: validatorAccount,
      chain: destinationChain,
      transport: http(),
    });
    const signature = await walletClient.signMessage({
      message: { raw: structHash },
    });

    try {
      await sgMail.send({
        to: alertEmail,
        from: alertEmail,
        subject: "Auto Tower Defense - Buy Validator Signature Request",
        text: `A buy validator signature request was made with the following details:\n\nAmount: ${formatUnits(amount, 6)}\nBuyer: ${buyer}\nDestination Chain ID: ${destinationChainId}\nNonce: ${nonce}\nOrigin Chain ID: ${originChainId}\nTransaction Hash: ${txHash}\n\nSignature: ${signature}.`,
      });
    } catch (emailErr) {
      console.error("SendGrid error:", emailErr);
    }
    res.json({ signature });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signature failed" });
  }
});

app.post("/sell-validator-signature", async (req, res) => {
  const { amount, destinationChainId, nonce, originChainId, seller, txHash } =
    req.body;

  if (
    !(
      amount &&
      destinationChainId &&
      nonce &&
      originChainId &&
      seller &&
      txHash
    )
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const originChain = SUPPORTED_CHAINS[originChainId];
  const destinationChain = SUPPORTED_CHAINS[destinationChainId];
  const sellEmitterAddress = SELL_EMITTER_CONTRACTS[originChainId];

  if (!SUPPORTED_CHAINS[originChainId]) {
    return res.status(400).json({ error: "Unsupported origin chain ID" });
  }

  if (!SUPPORTED_CHAINS[destinationChainId]) {
    return res.status(400).json({ error: "Unsupported destination chain ID" });
  }

  if (!sellEmitterAddress) {
    return res
      .status(400)
      .json({ error: "Sell emitter contract not deployed" });
  }

  try {
    const publicClient = createPublicClient({
      chain: originChain,
      transport: http(),
    });

    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash,
    });

    const eventLog = receipt.logs.find(
      (log) => log.address.toLowerCase() === sellEmitterAddress.toLowerCase()
    );

    if (!eventLog) {
      return res.status(404).json({ error: "No ElectricitySold event found" });
    }

    const parsedLog = decodeEventLog({
      abi: SELL_EMITTER_ABI,
      data: eventLog.data,
      topics: eventLog.topics,
    });

    if (
      parsedLog.eventName !== "ElectricitySold" ||
      parsedLog.args.seller.toLowerCase() !== seller.toLowerCase() ||
      parsedLog.args.receiveAmount !== BigInt(amount) ||
      parsedLog.args.nonce !== BigInt(nonce)
    ) {
      return res.status(400).json({ error: "Event mismatch" });
    }

    const encodedData = encodeAbiParameters(
      [
        { type: "address", name: "seller" },
        { type: "uint256", name: "amount" },
        { type: "uint256", name: "nonce" },
      ],
      [seller, amount, nonce]
    );
    const structHash = keccak256(encodedData);

    const { VALIDATOR_PRIVATE_KEY } = process.env;
    if (!VALIDATOR_PRIVATE_KEY) {
      return res.status(500).json({ error: "VALIDATOR_PRIVATE_KEY not set" });
    }
    const validatorAccount = privateKeyToAccount(VALIDATOR_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account: validatorAccount,
      chain: destinationChain,
      transport: http(),
    });
    const signature = await walletClient.signMessage({
      message: { raw: structHash },
    });

    try {
      await sgMail.send({
        to: alertEmail,
        from: alertEmail,
        subject: "Auto Tower Defense - Sell Validator Signature Request",
        text: `A sell validator signature request was made with the following details:\n\nAmount: ${formatUnits(amount, 6)}\nSeller: ${seller}\nDestination Chain ID: ${destinationChainId}\nNonce: ${nonce}\nOrigin Chain ID: ${originChainId}\nTransaction Hash: ${txHash}\n\nSignature: ${signature}.`,
      });
    } catch (emailErr) {
      console.error("SendGrid error:", emailErr);
    }

    res.json({ signature });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signature failed" });
  }
});

const ALLOWED_ORIGINS = [
  "https://www.thedailydust.com",
  "https://thedailydust.com",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  },
});

const uploadCors = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser tools (curl/Postman)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  methods: ["POST", "OPTIONS"],
});

app.post(
  "/ipfs/file",
  uploadCors,
  upload.single("file"), // parse multipart body
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const form = new FormData();
      form.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: "image/png",
      });

      const name = req.body?.name || req.file.originalname;
      form.append("name", name);

      const resp = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
          },
          maxBodyLength: Infinity,
        }
      );

      const { IpfsHash } = resp.data;

      return res.json({
        cid: IpfsHash,
      });
    } catch (err) {
      const status = err?.response?.status || 500;
      const payload = err?.response?.data || {
        error: err?.message || "Upload failed",
      };
      console.error("Upload error:", payload);
      return res.status(status).json(payload);
    }
  }
);

app.listen(port, () => {
  console.log(`Auto Tower Defense API listening on port ${port}`);
});
