/**
 * Provides types and utilities for working with SBT contracts.
 *
 * @packageDocumentation
 */

import { type ContractAddress, convert_bigint_to_Uint8Array } from '@midnight-ntwrk/compact-runtime';
import { type Logger } from 'pino';
import {
  type SbtDerivedState,
  type SbtContract,
  type SbtProviders,
  type DeployedSbtContract,
  type SbtToken,
  sbtPrivateStateKey,
} from './common-types.js';
import {
  type SbtPrivateState,
  Contract,
  createSbtPrivateState,
  ledger,
  pureCircuits,
  witnesses,

} from '@midnight-ntwrk/bboard-contract-tutorial';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

// JSON序列化时处理BigInt的辅助函数
const jsonStringifyWithBigInt = (data: any): string => {
  return JSON.stringify(data, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
};

/** @internal */
const sbtContractInstance: SbtContract = new Contract(witnesses);

/**
 * An API for a deployed SBT contract.
 */
export interface DeployedSbtAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<SbtDerivedState>;

  mint: (metadata: string) => Promise<bigint>;
  updateMetadata: (tokenId: bigint, newMetadata: string) => Promise<void>;
  revoke: (tokenId: bigint) => Promise<void>;
  getMyTokens: () => Promise<bigint>;
  verifyOwnership: (tokenId: bigint) => Promise<boolean>;
}

/**
 * Provides an implementation of {@link DeployedSbtAPI} by adapting a deployed SBT
 * contract.
 */
export class SbtAPI implements DeployedSbtAPI {
  /** @internal */
  private constructor(
    public readonly deployedContract: DeployedSbtContract,
    providers: SbtProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = combineLatest(
      [
        // Combine public (ledger) state with...
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                tokens: ledgerState.tokens,
                ownerTokens: ledgerState.ownerTokens,
                tokenCounter: ledgerState.tokenCounter,
                currentTime: ledgerState.currentTime,
              },
            }),
          ),
        ),
        // ...private state...
        from(providers.privateStateProvider.get(sbtPrivateStateKey) as Promise<SbtPrivateState>),
      ],
      // ...and combine them to produce the required derived state.
      (ledgerState, privateState) => {
        const myPublicKey = pureCircuits.public_key(privateState.secretKey);
        
        // 创建符合SbtDerivedState接口的对象
        const tokens = new Map<bigint, SbtToken>();
        const myTokens =  new Set<bigint>();
        
        this.logger?.info('--- Processing Ledger State Update ---');
        this.logger?.info('Raw ledgerState:', JSON.stringify(ledgerState, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));
        
        // 迭代原始tokens，转换为标准Map
        if (ledgerState.tokens) {
          // 使用Symbol.iterator确保可以迭代
          if (typeof ledgerState.tokens[Symbol.iterator] === 'function') {
            for (const [tokenId, tokenData] of ledgerState.tokens) {
              try {
                this.logger?.info(`---> Processing tokenId: ${tokenId}`);
                
                // 处理元数据
                let actualMetadata = '';
                if (typeof tokenData.metadata === 'string') {
                  actualMetadata = tokenData.metadata;
                } else if (tokenData.metadata && typeof tokenData.metadata === 'object') {
                  const metadataAsAny: any = tokenData.metadata;
                  if ('value' in metadataAsAny && typeof metadataAsAny.value === 'string') {
                    actualMetadata = metadataAsAny.value;
                  } else {
                    actualMetadata = JSON.stringify(metadataAsAny);
                  }
                }
                
                const isOwner = toHex(tokenData.owner) === toHex(myPublicKey);
                
                // 创建SbtToken对象并添加到Map中
                tokens.set(tokenId, {
                  tokenId: tokenId,
                  owner: toHex(tokenData.owner),
                  metadata: actualMetadata,
                  issuedAt: tokenData.issuedAt,
                  isOwner: isOwner
                });
                
                if (isOwner) {
                  myTokens.add(tokenId);
                }
              } catch (error) {
                this.logger?.error(`Error processing token ${tokenId}:`, error);
              }
            }
          } else {
            this.logger?.warn('ledgerState.tokens is not iterable');
          }
        }
        
        this.logger?.info('--- Finished Processing Ledger State Update ---');
        
        // 返回符合SbtDerivedState接口的对象
        return {
          tokens,
          myTokens,
          tokenCounter: ledgerState.tokenCounter,
          currentTime: ledgerState.currentTime,
        };
      },
    );
  }

  /**
   * Gets the address of the current deployed contract.
   */
  readonly deployedContractAddress: ContractAddress;

  /**
   * Gets an observable stream of state changes based on the current public (ledger),
   * and private state data.
   */
  readonly state$: Observable<SbtDerivedState>;

  /**
   * Mints a new SBT token with the given metadata.
   * 
   * @param metadata The token metadata
   * @returns The new token ID
   */
  async mint(metadata: string): Promise<bigint> {
    this.logger?.info(`Minting new SBT with metadata: ${metadata}`);
    this.logger?.info(`metadata: ${metadata}`);
    // 直接传递字符串，与bboard保持一致
    const txData = await this.deployedContract.callTx.mint(metadata);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'mint',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
    // 添加详细的日志记录，但不影响程序执行
    // try {
    //   this.logger?.info(`txData: ${txData}`);
    //   // 打印完整的txData结构
    //   this.logger?.info(`txData 完整结构: ${JSON.stringify(txData, (key, value) => 
    //     typeof value === 'bigint' ? value.toString() : value, 2)}`);
      
    //   // 检查并打印txData的公共部分
    //   if (txData.public) {
    //     this.logger?.info(`txData.public: ${JSON.stringify(txData.public, (key, value) => 
    //       typeof value === 'bigint' ? value.toString() : value, 2)}`);
        
    //     // 检查outputs字段
    //     if ((txData.public as any).outputs) {
    //       this.logger?.info(`txData.public.outputs: ${JSON.stringify((txData.public as any).outputs, (key, value) => 
    //         typeof value === 'bigint' ? value.toString() : value, 2)}`);
    //     } else {
    //       this.logger?.info('txData.public没有outputs字段');
    //     }
        
    //     // 检查其他重要字段
    //     this.logger?.info(`txData.public的所有字段: ${Object.keys(txData.public).join(', ')}`);
    //   } else {
    //     this.logger?.info('txData没有public字段');
    //   }
      
    //   // 检查txData中是否有其他顶级字段
    //   this.logger?.info(`txData的所有顶级字段: ${Object.keys(txData).join(', ')}`);
    // } catch (err) {
    //   // 捕获日志错误但不影响主流程
    //   this.logger?.error(`打印txData时出错: ${err}`);
    // }

    // 只打印返回的private部分
    try {
      if (txData.private) {
        // 简单打印private部分关键信息，避免序列化整个对象
        this.logger?.info(`txData.private.result: ${txData.private.result}`);
        
        if (txData.private.output && txData.private.output.value) {
          this.logger?.info(`txData.private.output.value 第一个元素: ${txData.private.output.value[0]?.[0]}`);
        }
      } else {
        this.logger?.info('txData没有private字段');
      }
    } catch (err) {
      // 捕获日志错误但不影响主流程
      this.logger?.error(`打印txData.private时出错: ${err}`);
    }
    
    if (txData.private && txData.private.result && txData.private.result.length > 0) {
      const tokenId = BigInt(txData.private.result[0]);
      this.logger?.info(`成功铸造代币，ID: ${tokenId}`);
      return tokenId;
    }    
    // Return the new token ID
    return BigInt(0);
  }

  /**
   * Updates the metadata of an existing token.
   * 
   * @param tokenId The token ID to update
   * @param newMetadata The new metadata
   */
  async updateMetadata(tokenId: bigint, newMetadata: string): Promise<void> {
    this.logger?.info(`Updating metadata for token ${tokenId}`);

    // 直接传递字符串，与bboard保持一致
    const txData = await this.deployedContract.callTx.updateMetadata(tokenId, newMetadata);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'updateMetadata',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
    
    // 使用辅助函数处理BigInt序列化
    this.logger?.debug('Transaction Data:', jsonStringifyWithBigInt(txData.public));
  }

  /**
   * Revokes (destroys) a token.
   * 
   * @param tokenId The token ID to revoke
   */
  async revoke(tokenId: bigint): Promise<void> {
    this.logger?.info(`Revoking token ${tokenId}`);

    const txData = await this.deployedContract.callTx.revoke(tokenId);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'revoke',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  /**
   * Gets the tokens owned by the current user.
   * 
   * @returns The number of tokens owned by the current user
   */
  async getMyTokens(): Promise<bigint> {
    this.logger?.info('Getting user tokens version 2');

    const txData = await this.deployedContract.callTx.getMyTokens();
    
    // 添加详细的日志记录，但不影响程序执行
    try {
      this.logger?.info(`txData: ${txData}`);
      // 打印完整的txData结构
      this.logger?.info(`txData 完整结构: ${JSON.stringify(txData, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2)}`);
      
      // 检查并打印txData的公共部分
      if (txData.public) {
        this.logger?.info(`txData.public: ${JSON.stringify(txData.public, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value, 2)}`);
        
        // 检查outputs字段
        if ((txData.public as any).outputs) {
          this.logger?.info(`txData.public.outputs: ${JSON.stringify((txData.public as any).outputs, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value, 2)}`);
        } else {
          this.logger?.info('txData.public没有outputs字段');
        }
        
        // 检查其他重要字段
        this.logger?.info(`txData.public的所有字段: ${Object.keys(txData.public).join(', ')}`);
      } else {
        this.logger?.info('txData没有public字段');
      }
      
      // 检查txData中是否有其他顶级字段
      this.logger?.info(`txData的所有顶级字段: ${Object.keys(txData).join(', ')}`);
    } catch (err) {
      // 捕获日志错误但不影响主流程
      this.logger?.error(`打印txData时出错: ${err}`);
    }

    // 添加打印private部分的代码
    try {
      if (txData.private) {
        // 简单打印private部分关键信息，避免序列化整个对象
        this.logger?.info(`txData.private.result: ${txData.private.result}`);
        
        if (txData.private.output && txData.private.output.value) {
          this.logger?.info(`txData.private.output.value 第一个元素: ${txData.private.output.value[0]?.[0]}`);
        }
      } else {
        this.logger?.info('txData没有private字段');
      }
    } catch (err) {
      // 捕获日志错误但不影响主流程
      this.logger?.error(`打印txData.private时出错: ${err}`);
    }

    if (txData.private && txData.private.result && txData.private.result.length > 0) {
      const data = BigInt(txData.private.result[0]);
      this.logger?.info(`成功获取用户持有代币数量: ${data}`);
      return data;
    }   

    this.logger?.trace({
      transactionAdded: {
        circuit: 'getMyTokens',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
    
    // 直接返回token数量
    return (txData.public as any).outputs?.[0].value as bigint;
  }

  /**
   * Verifies if the current user owns a specific token.
   * 
   * @param tokenId The token ID to verify
   * @returns True if the current user owns the token
   */
  async verifyOwnership(tokenId: bigint): Promise<boolean> {
    this.logger?.info(`Verifying ownership of token ${tokenId}`);

    const txData = await this.deployedContract.callTx.verifyOwnership(tokenId);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'verifyOwnership',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
    
    return (txData.public as any).outputs?.[0] as boolean;
  }

  /**
   * Deploys a new SBT contract to the network.
   *
   * @param providers The SBT providers.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link SbtAPI} instance that manages the newly deployed
   * {@link DeployedSbtContract}; or rejects with a deployment error.
   */
  static async deploy(providers: SbtProviders, logger?: Logger): Promise<SbtAPI> {
    logger?.info('Deploying SBT contract');
    logger?.info("sbtPrivateStateKey", sbtPrivateStateKey);
    logger?.info("providers.privateStateProvider", providers.privateStateProvider);

    const state = await SbtAPI.getPrivateState(providers);
    logger?.info("state", state);
    const deployedSbtContract = await deployContract<SbtContract>(providers, {
      privateStateId: sbtPrivateStateKey,
      contract: sbtContractInstance,
      initialPrivateState: state,
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedSbtContract.deployTxData.public,
      },
    });

    return new SbtAPI(deployedSbtContract, providers, logger);
  }

  /**
   * Finds an already deployed SBT contract on the network, and joins it.
   *
   * @param providers The SBT providers.
   * @param contractAddress The address of the deployed contract to join.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link SbtAPI} instance that manages the found
   * {@link DeployedSbtContract}; or rejects with an error.
   */
  static async join(providers: SbtProviders, contractAddress: ContractAddress, logger?: Logger): Promise<SbtAPI> {
    logger?.info(`Joining SBT contract at ${contractAddress}`);

    const foundSbtContract = await findDeployedContract<SbtContract>(providers, {
      contractAddress,
      privateStateId: sbtPrivateStateKey,
      contract: sbtContractInstance,
      initialPrivateState: await SbtAPI.getPrivateState(providers),
    });

    logger?.trace({ contractFound: { contractAddress } });

    return new SbtAPI(foundSbtContract, providers, logger);
  }

  /**
   * Gets the private state for this SBT contract.
   *
   * @param providers The SBT providers
   * @returns A `Promise` that resolves with the {@link SbtPrivateState} for this SBT contract.
   * @internal
   */
  private static async getPrivateState(providers: SbtProviders): Promise<SbtPrivateState> {
    try {
      const existingPrivateState = await providers.privateStateProvider.get(sbtPrivateStateKey);
      return existingPrivateState as SbtPrivateState ?? createSbtPrivateState(utils.randomBytes(32));
    } catch (e) {
      // If the private state doesn't exist, generate a new one
      const randomBytes = utils.randomBytes(32);
      
      const privateState = createSbtPrivateState(randomBytes);
      await providers.privateStateProvider.set(sbtPrivateStateKey, privateState);
      
      return privateState;
    }
  }
}

/**
 * A namespace that represents the exports from the `'utils'` sub-package.
 *
 * @public
 */
export * as utils from './utils/index.js';

export * from './common-types.js';