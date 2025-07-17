import { Effect, Schedule, Duration } from "effect";
import type {
  DevModeContext,
  GenericContext,
  DeepPartial,
  ViemTransactionOptions,
  ContractDeploymentOptions,
} from "@moonwall/types";
import { NetworkError, ValidationError, TimeoutError, ResourceError } from "@moonwall/types";
import type { BlockTag, TransactionSerializable, Abi, DeployContractParameters } from "viem";
import { createWalletClient, hexToNumber, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Chain } from "viem/chains";
import { ALITH_ADDRESS, ALITH_PRIVATE_KEY } from "../constants/accounts";
import type { InputAmountFormats, TransferOptions } from "../functions/viem";
import { directRpcRequest } from "../functions/common";

/**
 * Effect-based implementation of checkBalance
 * Checks the balance of a given account with proper error handling
 */
export const checkBalanceEffect = (
  context: DevModeContext,
  account: `0x${string}` = ALITH_ADDRESS,
  block: BlockTag | bigint = "latest"
): Effect.Effect<bigint, NetworkError | ValidationError | TimeoutError> =>
  Effect.gen(function* () {
    // Validate address format
    if (!account.match(/^0x[a-fA-F0-9]{40}$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid Ethereum address format",
          field: "account",
          value: account,
          expected: "0x followed by 40 hexadecimal characters",
        })
      );
    }

    // Create the appropriate balance query based on block parameter
    const balanceQuery = 
      typeof block === "string"
        ? Effect.tryPromise({
            try: () => context.viem().getBalance({ address: account, blockTag: block }),
            catch: (error) =>
              new NetworkError({
                message: `Failed to get balance for ${account}`,
                endpoint: context.viem().transport.url || "unknown",
                operation: "getBalance",
                cause: error,
              }),
          })
        : typeof block === "bigint"
          ? Effect.tryPromise({
              try: () => context.viem().getBalance({ address: account, blockNumber: block }),
              catch: (error) =>
                new NetworkError({
                  message: `Failed to get balance for ${account} at block ${block}`,
                  endpoint: context.viem().transport.url || "unknown",
                  operation: "getBalance",
                  cause: error,
                }),
            })
          : Effect.tryPromise({
              try: () => context.viem().getBalance({ address: account }),
              catch: (error) =>
                new NetworkError({
                  message: `Failed to get balance for ${account}`,
                  endpoint: context.viem().transport.url || "unknown",
                  operation: "getBalance",
                  cause: error,
                }),
            });

    // Add retry logic with exponential backoff
    const balanceWithRetry = balanceQuery.pipe(
      Effect.retry({
        times: 3,
        schedule: Schedule.exponential(Duration.millis(100)),
      })
    );

    // Add timeout
    const balanceWithTimeout = balanceWithRetry.pipe(
      Effect.timeout(Duration.seconds(10)),
      Effect.catchTag("TimeoutException", () =>
        Effect.fail(
          new TimeoutError({
            message: "Balance query timed out",
            operation: "checkBalance",
            timeout: 10000,
          })
        )
      )
    );

    return yield* balanceWithTimeout;
  });

/**
 * Effect-based implementation of createRawTransfer
 * Creates and signs a transfer transaction with proper validation and error handling
 */
export const createRawTransferEffect = <TOptions extends TransferOptions>(
  context: DevModeContext,
  to: `0x${string}`,
  value: InputAmountFormats,
  options?: TOptions
): Effect.Effect<`0x${string}`, NetworkError | ValidationError> =>
  Effect.gen(function* () {
    // Validate 'to' address
    if (!to.match(/^0x[a-fA-F0-9]{40}$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid recipient address format",
          field: "to",
          value: to,
          expected: "0x followed by 40 hexadecimal characters",
        })
      );
    }

    // Convert and validate value
    let transferAmount: bigint;
    try {
      transferAmount = typeof value === "bigint" ? value : BigInt(value);
      if (transferAmount < 0n) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Transfer amount cannot be negative",
            field: "value",
            value: value,
            expected: "positive bigint or convertible value",
          })
        );
      }
    } catch (error) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid transfer amount",
          field: "value",
          value: value,
          expected: "bigint or value convertible to bigint",
          cause: error,
        })
      );
    }

    // Delegate to createViemTransactionEffect
    return yield* createViemTransactionEffect(context, {
      ...options,
      to: to as any,
      value: transferAmount,
    });
  });

/**
 * Effect-based implementation of sendRawTransaction
 * Sends a raw signed transaction with retry logic and timeout handling
 */
export const sendRawTransactionEffect = (
  context: GenericContext,
  rawTx: `0x${string}`
): Effect.Effect<`0x${string}`, NetworkError | ValidationError | TimeoutError> =>
  Effect.gen(function* () {
    // Validate transaction format (basic hex check)
    if (!rawTx.match(/^0x[a-fA-F0-9]+$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid raw transaction format",
          field: "rawTx",
          value: rawTx.substring(0, 66) + "...", // Truncate for error message
          expected: "0x followed by hexadecimal characters",
        })
      );
    }

    // Send the transaction
    const sendTx = Effect.tryPromise({
      try: () => context.viem().request({ method: "eth_sendRawTransaction", params: [rawTx] }),
      catch: (error) =>
        new NetworkError({
          message: "Failed to send raw transaction",
          endpoint: context.viem().transport.url || "unknown",
          operation: "eth_sendRawTransaction",
          cause: error,
        }),
    });

    // Add retry logic with exponential backoff
    const sendWithRetry = sendTx.pipe(
      Effect.retry({
        times: 3,
        schedule: Schedule.exponential(Duration.millis(200)),
        while: (error) => {
          // Don't retry on certain errors
          if (error.cause && typeof error.cause === "object" && "code" in error.cause) {
            const code = (error.cause as any).code;
            // Don't retry on invalid nonce, insufficient funds, etc.
            if (code === -32000 || code === -32001 || code === -32002 || code === -32003) {
              return false;
            }
          }
          return true;
        },
      })
    );

    // Add timeout
    const sendWithTimeout = sendWithRetry.pipe(
      Effect.timeout(Duration.seconds(30)),
      Effect.catchTag("TimeoutException", () =>
        Effect.fail(
          new TimeoutError({
            message: "Transaction submission timed out",
            operation: "sendRawTransaction",
            timeout: 30000,
          })
        )
      )
    );

    return yield* sendWithTimeout;
  });

/**
 * Effect-based implementation of createViemTransaction
 * Creates and signs a transaction with comprehensive error handling
 */
export const createViemTransactionEffect = <TOptions extends DeepPartial<ViemTransactionOptions>>(
  context: GenericContext,
  options: TOptions
): Effect.Effect<`0x${string}`, NetworkError | ValidationError> =>
  Effect.gen(function* () {
    const type = options?.txnType || "eip1559";
    const privateKey = options?.privateKey || ALITH_PRIVATE_KEY;
    const value = options?.value || 0n;
    const to = options?.to || "0x0000000000000000000000000000000000000000";
    const data = options?.data || "0x";

    // Validate private key format
    if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid private key format",
          field: "privateKey",
          value: "0x...", // Don't expose the actual key
          expected: "0x followed by 64 hexadecimal characters",
        })
      );
    }

    const account = privateKeyToAccount(privateKey);

    // Get chain ID with retry
    const chainId = yield* Effect.tryPromise({
      try: () => context.viem().getChainId(),
      catch: (error) =>
        new NetworkError({
          message: "Failed to get chain ID",
          endpoint: context.viem().transport.url || "unknown",
          operation: "getChainId",
          cause: error,
        }),
    }).pipe(Effect.retry({ times: 2, schedule: Schedule.spaced(Duration.millis(100)) }));

    // Get transaction count with retry
    const txnCount = yield* Effect.tryPromise({
      try: () => context.viem().getTransactionCount({ address: account.address }),
      catch: (error) =>
        new NetworkError({
          message: "Failed to get transaction count",
          endpoint: context.viem().transport.url || "unknown",
          operation: "getTransactionCount",
          cause: error,
        }),
    }).pipe(Effect.retry({ times: 2, schedule: Schedule.spaced(Duration.millis(100)) }));

    // Get gas price with retry
    const gasPrice = yield* Effect.tryPromise({
      try: () => context.viem().getGasPrice(),
      catch: (error) =>
        new NetworkError({
          message: "Failed to get gas price",
          endpoint: context.viem().transport.url || "unknown",
          operation: "getGasPrice",
          cause: error,
        }),
    }).pipe(Effect.retry({ times: 2, schedule: Schedule.spaced(Duration.millis(100)) }));

    // Estimate gas if needed
    const estimatedGas = yield* Effect.if(
      options.skipEstimation || options.gas !== undefined,
      {
        onTrue: () => Effect.succeed(1_500_000n),
        onFalse: () =>
          Effect.tryPromise({
            try: () => context.viem().estimateGas({ account: account.address, to, value, data }),
            catch: (error) =>
              new NetworkError({
                message: "Failed to estimate gas",
                endpoint: context.viem().transport.url || "unknown",
                operation: "estimateGas",
                cause: error,
              }),
          }).pipe(
            Effect.retry({ times: 2, schedule: Schedule.spaced(Duration.millis(100)) }),
            Effect.catchAll(() => Effect.succeed(1_500_000n)) // Fallback on estimation failure
          ),
      }
    );

    const accessList = options?.accessList || [];

    // Build transaction based on type
    const txnBlob =
      type === "eip1559"
        ? ({
            to,
            value,
            maxFeePerGas: options.maxFeePerGas ?? gasPrice,
            maxPriorityFeePerGas: options.maxPriorityFeePerGas ?? gasPrice,
            gas: options.gas ?? estimatedGas,
            nonce: options.nonce ?? txnCount,
            data,
            chainId,
            type,
          } satisfies TransactionSerializable)
        : type === "legacy"
          ? ({
              to,
              value,
              gasPrice: options.gasPrice ?? gasPrice,
              gas: options.gas ?? estimatedGas,
              nonce: options.nonce ?? txnCount,
              data,
            } satisfies TransactionSerializable)
          : type === "eip2930"
            ? ({
                to,
                value,
                gasPrice: options.gasPrice ?? gasPrice,
                gas: options.gas ?? estimatedGas,
                nonce: options.nonce ?? txnCount,
                data,
                chainId,
                type,
              } satisfies TransactionSerializable)
            : {};

    // Add access list if applicable
    if (
      (type === "eip1559" && accessList.length > 0) ||
      (type === "eip2930" && accessList.length > 0)
    ) {
      (txnBlob as any).accessList = accessList;
    }

    // Sign the transaction
    const signedTx = yield* Effect.tryPromise({
      try: () => account.signTransaction(txnBlob),
      catch: (error) =>
        new ValidationError({
          message: "Failed to sign transaction",
          field: "transaction",
          value: txnBlob,
          expected: "valid transaction parameters",
          cause: error,
        }),
    });

    return signedTx;
  });

/**
 * Effect-based implementation of deriveViemChain
 * Derives a Viem chain object from a given HTTP endpoint with proper error handling
 */
export const deriveViemChainEffect = (
  endpoint: string
): Effect.Effect<Chain, NetworkError | ValidationError> =>
  Effect.gen(function* () {
    // Validate endpoint format
    if (!endpoint || typeof endpoint !== "string") {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid endpoint format",
          field: "endpoint",
          value: endpoint,
          expected: "valid HTTP or WebSocket URL",
        })
      );
    }

    const httpEndpoint = endpoint.replace("ws", "http");
    const block = { http: [httpEndpoint] };

    // Get chain ID with retry
    const chainIdHex = yield* Effect.tryPromise({
      try: () => directRpcRequest(httpEndpoint, "eth_chainId"),
      catch: (error) =>
        new NetworkError({
          message: "Failed to get chain ID",
          endpoint: httpEndpoint,
          operation: "eth_chainId",
          cause: error,
        }),
    }).pipe(Effect.retry({ times: 3, schedule: Schedule.exponential(Duration.millis(100)) }));

    const id = hexToNumber(chainIdHex);

    // Get chain name with retry
    const name = yield* Effect.tryPromise({
      try: () => directRpcRequest(httpEndpoint, "system_chain"),
      catch: (error) =>
        new NetworkError({
          message: "Failed to get chain name",
          endpoint: httpEndpoint,
          operation: "system_chain",
          cause: error,
        }),
    }).pipe(Effect.retry({ times: 3, schedule: Schedule.exponential(Duration.millis(100)) }));

    // Get chain properties with retry
    const properties = yield* Effect.tryPromise({
      try: () => directRpcRequest(httpEndpoint, "system_properties"),
      catch: (error) =>
        new NetworkError({
          message: "Failed to get chain properties",
          endpoint: httpEndpoint,
          operation: "system_properties",
          cause: error,
        }),
    }).pipe(Effect.retry({ times: 3, schedule: Schedule.exponential(Duration.millis(100)) }));

    const { tokenSymbol, tokenDecimals } = properties;

    return {
      id,
      name,
      nativeCurrency: {
        decimals: tokenDecimals,
        name: tokenSymbol,
        symbol: tokenSymbol,
      },
      rpcUrls: {
        public: block,
        default: block,
      },
    } as const satisfies Chain;
  });

/**
 * Effect-based implementation of deployViemContract
 * Deploys a contract with comprehensive error handling and resource management
 */
export const deployViemContractEffect = <TOptions extends ContractDeploymentOptions>(
  context: DevModeContext,
  abi: Abi,
  bytecode: `0x${string}`,
  options?: TOptions
): Effect.Effect<
  { contractAddress: `0x${string}` | null | undefined; status: "success" | "reverted"; logs: any[]; hash: `0x${string}` },
  NetworkError | ValidationError | ResourceError
> =>
  Effect.gen(function* () {
    // Validate bytecode format
    if (!bytecode.match(/^0x[a-fA-F0-9]+$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid bytecode format",
          field: "bytecode",
          value: bytecode.substring(0, 66) + "...", // Truncate for error message
          expected: "0x followed by hexadecimal characters",
        })
      );
    }

    const url = context.viem().transport.url;
    if (!url) {
      return yield* Effect.fail(
        new NetworkError({
          message: "No transport URL available",
          endpoint: "unknown",
          operation: "deployContract",
        })
      );
    }

    const { privateKey = ALITH_PRIVATE_KEY, ...rest } = options || ({} as any);

    // Validate private key
    if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid private key format",
          field: "privateKey",
          value: "0x...", // Don't expose the actual key
          expected: "0x followed by 64 hexadecimal characters",
        })
      );
    }

    const account = privateKeyToAccount(privateKey);

    // Derive chain with Effect
    const chain = yield* deriveViemChainEffect(url);

    // Create wallet client
    const client = yield* Effect.try({
      try: () =>
        createWalletClient({
          transport: http(url),
          account,
          chain,
        }),
      catch: (error) =>
        new ResourceError({
          message: "Failed to create wallet client",
          resource: "WalletClient",
          operation: "acquire",
          cause: error,
        }),
    });

    const blob = {
      ...rest,
      abi,
      bytecode,
      account,
    };

    // Deploy contract with retry
    const hash = yield* Effect.tryPromise({
      try: () => client.deployContract(blob as DeployContractParameters),
      catch: (error) =>
        new NetworkError({
          message: "Failed to deploy contract",
          endpoint: url,
          operation: "deployContract",
          cause: error,
        }),
    }).pipe(
      Effect.retry({
        times: 2,
        schedule: Schedule.exponential(Duration.millis(500)),
      })
    );

    // Create block
    yield* Effect.tryPromise({
      try: () => context.createBlock(),
      catch: (error) =>
        new NetworkError({
          message: "Failed to create block",
          endpoint: url,
          operation: "createBlock",
          cause: error,
        }),
    });

    // Wait for transaction receipt with retries
    const getReceipt = Effect.tryPromise({
      try: () => context.viem().getTransactionReceipt({ hash }),
      catch: (error) =>
        new NetworkError({
          message: "Failed to get transaction receipt",
          endpoint: url,
          operation: "getTransactionReceipt",
          cause: error,
        }),
    });

    const receiptWithRetry = yield* Effect.retry(getReceipt, {
      times: 5,
      schedule: Schedule.spaced(Duration.millis(100)),
    }).pipe(
      Effect.catchAll(() =>
        Effect.fail(
          new ResourceError({
            message: "Contract deployment query failed after 5 retries",
            resource: "TransactionReceipt",
            operation: "acquire",
          })
        )
      )
    );

    const { contractAddress, status, logs } = receiptWithRetry;
    return { contractAddress, status, logs, hash };
  });