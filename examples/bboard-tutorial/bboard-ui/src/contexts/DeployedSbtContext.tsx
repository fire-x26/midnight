import React, { useCallback, useState } from 'react';
import { type SbtAPI } from '@midnight-ntwrk/bboard-api-tutorial';
import { Subject as RxSubject } from 'rxjs';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';

export type SbtDeploymentStatus = 'in-progress' | 'complete' | 'failed';

export interface SbtDeploymentError {
  readonly message: string;
}

export interface SbtDeployment {
  readonly status: SbtDeploymentStatus;
  readonly error?: SbtDeploymentError;
  readonly api?: SbtAPI;
}

export interface DeployedSbtContextProps {
  resolve: (contractAddress?: ContractAddress) => void;
}

export const DeployedSbtContext = React.createContext<DeployedSbtContextProps | null>(null);

export interface DeployedSbtProviderProps {
  deploy: (contractAddress?: ContractAddress) => Promise<SbtAPI>;
  children: React.ReactNode;
}

export const DeployedSbtProvider: React.FC<DeployedSbtProviderProps> = ({ deploy, children }) => {
  const [sbtDeployment$] = useState(new RxSubject<SbtDeployment>());

  const resolve = useCallback(
    (contractAddress?: ContractAddress) => {
      (async () => {
        try {
          sbtDeployment$.next({ status: 'in-progress' });
          const api = await deploy(contractAddress);
          sbtDeployment$.next({ status: 'complete', api });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          sbtDeployment$.next({ status: 'failed', error: { message } });
        }
      })();
    },
    [deploy, sbtDeployment$],
  );

  return (
    <DeployedSbtContext.Provider value={{ resolve }}>
      {children}
      <SbtSubject sbtDeployment$={sbtDeployment$} />
    </DeployedSbtContext.Provider>
  );
};

interface SbtSubjectProps {
  sbtDeployment$: RxSubject<SbtDeployment>;
}

export const SbtSubject: React.FC<SbtSubjectProps> = ({ sbtDeployment$ }) => {
  return <DeployedSbtContext.Consumer>{() => null}</DeployedSbtContext.Consumer>;
}; 