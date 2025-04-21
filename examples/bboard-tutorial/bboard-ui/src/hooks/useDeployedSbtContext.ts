import { useContext } from 'react';
import { DeployedSbtContext, DeployedSbtContextProps } from '../contexts/DeployedSbtContext';

export const useDeployedSbtContext = (): DeployedSbtContextProps => {
  const context = useContext(DeployedSbtContext);
  if (context === null) {
    throw new Error('useDeployedSbtContext must be used within a DeployedSbtProvider');
  }
  return context;
}; 