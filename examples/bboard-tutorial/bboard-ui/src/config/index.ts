import { SbtProviders } from '@midnight-ntwrk/bboard-api-tutorial';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';

const API_BASE_URL = 'http://localhost:3000';

/**
 * 获取 SBT 合约所需的各种提供者
 */
export const getProviders = (): SbtProviders => {
  // 创建基本的提供者
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'sbt-private-state',
    }),
    publicDataProvider: indexerPublicDataProvider(
      `${API_BASE_URL}/api`,
      `${API_BASE_URL}/ws`
    ),
    zkConfigProvider: new NodeZkConfigProvider(
      `/path/to/zk-config`
    ),
    proofProvider: httpClientProofProvider(`${API_BASE_URL}/proof`),
    walletProvider: {
      // 简化的钱包提供者
      coinPublicKey: Array.from(new Uint8Array(32)).map(b => b.toString(16)).join(''),
      balanceTx: async () => { throw new Error('Not implemented'); }
    },
    midnightProvider: {
      // 简化的 Midnight 提供者
      submitTx: async () => { throw new Error('Not implemented'); }
    }
  };
}; 