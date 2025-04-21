import React, { useCallback } from 'react';
import { Box, Grid } from '@mui/material';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { type SbtAPI, SbtAPI as DeployedSbtAPI } from '@midnight-ntwrk/bboard-api-tutorial';
import { DeployedSbtProvider } from './contexts/DeployedSbtContext';
import { SbtTokenList } from './components/SbtTokenList';
import { useLogger } from './hooks';
import { getProviders } from './config';

/**
 * The root bulletin board application component.
 *
 * @remarks
 * The {@link App} component requires a `<DeployedBoardProvider />` parent in order to retrieve
 * information about current bulletin board deployments.
 *
 * @internal
 */
export const App: React.FC = () => {
  const logger = useLogger('SbtApp');

  const deployOrJoinSbt = useCallback(
    async (contractAddress?: ContractAddress): Promise<SbtAPI> => {
      // Deploy or join an SBT contract
      const providers = getProviders();
      return contractAddress ? 
        DeployedSbtAPI.join(providers, contractAddress, logger) : 
        DeployedSbtAPI.deploy(providers, logger);
    },
    [logger],
  );

  return (
    <Box padding={2}>
      <Grid container spacing={2} justifyContent="center">
        <Grid item xs={12} sm={10} md={8} lg={6}>
          <DeployedSbtProvider deploy={deployOrJoinSbt}>
            <SbtTokenList />
          </DeployedSbtProvider>
        </Grid>
      </Grid>
    </Box>
  );
};
