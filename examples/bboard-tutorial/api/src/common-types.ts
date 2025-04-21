/**
 * Common types for the SBT API.
 *
 * @packageDocumentation
 */

import type { Contract, ImpureCircuitId, MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { SbtPrivateState } from '@midnight-ntwrk/bboard-contract-tutorial';
import type { ContractAddress } from '@midnight-ntwrk/compact-runtime';

/**
 * The derived state for a SBT contract.
 */
export interface SbtDerivedState {
  /**
   * Map of token IDs to their metadata
   */
  readonly tokens: Map<bigint, SbtToken>;
  
  /**
   * Set of token IDs owned by the current user
   */
  readonly myTokens: Set<bigint>;
}

/**
 * Represents a single SBT token
 */
export interface SbtToken {
  /**
   * Unique identifier for the token
   */
  readonly tokenId: bigint;
  
  /**
   * Owner's public key
   */
  readonly owner: string;
  
  /**
   * Token metadata (JSON string)
   */
  readonly metadata: string;
  
  /**
   * Timestamp when the token was issued
   */
  readonly issuedAt: bigint;
  
  /**
   * Whether the current user owns this token
   */
  readonly isOwner: boolean;
}

/**
 * The identifier used to reference the private state for a SBT contract.
 */
export const sbtPrivateStateKey = 'sbtPrivateState';

/**
 * Type representing the impure circuits in the SBT contract.
 */
export type SbtCircuits = ImpureCircuitId<import('@midnight-ntwrk/bboard-contract-tutorial').Contract<SbtPrivateState>>;

/**
 * SBT providers for interacting with the Midnight network.
 */
export type SbtProviders = MidnightProviders<SbtCircuits, typeof sbtPrivateStateKey, SbtPrivateState>;

/**
 * The SBT contract type.
 */
export type SbtContract = import('@midnight-ntwrk/bboard-contract-tutorial').Contract<SbtPrivateState>;

/**
 * A reference to a deployed SBT contract.
 */
export type DeployedSbtContract = DeployedContract<SbtContract> | FoundContract<SbtContract>;

/**
 * A contract identifier for a deployed SBT contract.
 */
export type SbtContractId = ContractAddress;
