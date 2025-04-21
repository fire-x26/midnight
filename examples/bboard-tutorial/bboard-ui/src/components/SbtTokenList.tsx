import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CopyIcon from '@mui/icons-material/ContentCopy';
import StopIcon from '@mui/icons-material/HighlightOff';
import { type SbtDerivedState, type DeployedSbtAPI } from '@midnight-ntwrk/bboard-api-tutorial';
import { useDeployedSbtContext } from '../hooks/useDeployedSbtContext';
import { type SbtDeployment } from '../contexts/DeployedSbtContext';
import { type Observable } from 'rxjs';

/** SBT令牌列表组件所需的Props */
export interface SbtTokenListProps {
  /** 可观察的SBT合约部署 */
  sbtDeployment$?: Observable<SbtDeployment>;
}

/**
 * 提供已部署SBT合约的UI界面，允许用户铸造、更新和撤销SBT代币
 */
export const SbtTokenList: React.FC<Readonly<SbtTokenListProps>> = ({ sbtDeployment$ }) => {
  const sbtApiProvider = useDeployedSbtContext();
  const [sbtDeployment, setSbtDeployment] = useState<SbtDeployment>();
  const [deployedSbtAPI, setDeployedSbtAPI] = useState<DeployedSbtAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [sbtState, setSbtState] = useState<SbtDerivedState>();
  const [isWorking, setIsWorking] = useState(!!sbtDeployment$);
  
  // 对话框状态
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState('');

  // 创建或加入SBT合约的回调
  const onCreateSbt = useCallback(() => sbtApiProvider.resolve(), [sbtApiProvider]);
  const onJoinSbt = useCallback(
    (contractAddress: ContractAddress) => sbtApiProvider.resolve(contractAddress),
    [sbtApiProvider],
  );

  // 铸造新SBT的回调
  const onMintToken = useCallback(async () => {
    if (!tokenMetadata) {
      return;
    }

    try {
      if (deployedSbtAPI) {
        setIsWorking(true);
        await deployedSbtAPI.mint(tokenMetadata);
        setMintDialogOpen(false);
        setTokenMetadata('');
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedSbtAPI, tokenMetadata]);

  // 更新SBT元数据的回调
  const onUpdateToken = useCallback(async () => {
    if (!tokenMetadata || !selectedTokenId) {
      return;
    }

    try {
      if (deployedSbtAPI) {
        setIsWorking(true);
        // await deployedSbtAPI.updateMetadata(selectedTokenId, tokenMetadata);
        // 元数据更新功能已禁用
        setUpdateDialogOpen(false);
        setTokenMetadata('');
        setSelectedTokenId(null);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedSbtAPI, selectedTokenId, tokenMetadata]);

  // 撤销SBT的回调
  const onRevokeToken = useCallback(async (tokenId: bigint) => {
    try {
      if (deployedSbtAPI) {
        setIsWorking(true);
        await deployedSbtAPI.revoke(tokenId);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedSbtAPI]);

  // 复制合约地址的回调
  const onCopyContractAddress = useCallback(async () => {
    if (deployedSbtAPI) {
      await navigator.clipboard.writeText(deployedSbtAPI.deployedContractAddress);
    }
  }, [deployedSbtAPI]);

  // 订阅sbtDeployment$可观察对象
  useEffect(() => {
    if (!sbtDeployment$) {
      return;
    }

    const subscription = sbtDeployment$.subscribe(setSbtDeployment);

    return () => {
      subscription.unsubscribe();
    };
  }, [sbtDeployment$]);

  // 订阅DeployedSbtAPI的state$可观察对象
  useEffect(() => {
    if (!sbtDeployment) {
      return;
    }
    if (sbtDeployment.status === 'in-progress') {
      return;
    }

    setIsWorking(false);

    if (sbtDeployment.status === 'failed') {
      setErrorMessage(
        sbtDeployment.error?.message?.length ? sbtDeployment.error.message : '遇到意外错误。',
      );
      return;
    }

    setDeployedSbtAPI(sbtDeployment.api);
    if (sbtDeployment.api) {
      const subscription = sbtDeployment.api.state$.subscribe(setSbtState);
      return () => {
        subscription.unsubscribe();
      };
    }
    return undefined;
  }, [sbtDeployment]);

  // 打开铸造对话框
  const handleOpenMintDialog = () => {
    setTokenMetadata('');
    setMintDialogOpen(true);
  };

  // 打开更新对话框
  const handleOpenUpdateDialog = (tokenId: bigint, currentMetadata: string) => {
    setSelectedTokenId(tokenId);
    setTokenMetadata(currentMetadata);
    setUpdateDialogOpen(true);
  };

  return (
    <Card sx={{ width: '100%', maxWidth: 600, minHeight: 400 }}>
      {!sbtDeployment$ && (
        <CardContent>
          <Typography variant="h5" component="div" gutterBottom>
            灵魂绑定代币 (SBT)
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            创建新的SBT合约或加入现有合约
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={onCreateSbt}
            sx={{ mr: 1 }}
          >
            创建SBT合约
          </Button>
          
          <TextField
            label="合约地址"
            variant="outlined"
            size="small"
            sx={{ mr: 1, mt: 2 }}
          />
          <Button 
            variant="outlined" 
            onClick={() => onJoinSbt('输入的合约地址')}
            sx={{ mt: 2 }}
          >
            加入合约
          </Button>
        </CardContent>
      )}

      {sbtDeployment$ && (
        <React.Fragment>
          <Backdrop
            sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={isWorking}
          >
            <CircularProgress data-testid="sbt-working-indicator" />
          </Backdrop>
          
          <Backdrop
            sx={{ position: 'absolute', color: '#ff0000', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={!!errorMessage}
          >
            <StopIcon fontSize="large" />
            <Typography component="div" data-testid="sbt-error-message">
              {errorMessage}
            </Typography>
          </Backdrop>
          
          <CardHeader
            title="灵魂绑定代币 (SBT)"
            subheader={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption">
                  {toShortFormatContractAddress(deployedSbtAPI?.deployedContractAddress) ?? '加载中...'}
                </Typography>
                {deployedSbtAPI?.deployedContractAddress && (
                  <IconButton size="small" title="复制合约地址" onClick={onCopyContractAddress}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                )}
              </div>
            }
            action={
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleOpenMintDialog}
                disabled={isWorking}
              >
                铸造SBT
              </Button>
            }
          />
          
          <CardContent>
            {sbtState && (
              <List>
                {sbtState.myTokens.size > 0 ? (
                  Array.from(sbtState.myTokens).map((tokenId) => {
                    const tokenIdBigint = BigInt(tokenId.toString());
                    const token = sbtState.tokens.get(tokenIdBigint);
                    if (!token) return null;
                    
                    return (
                      <ListItem key={tokenIdBigint.toString()} divider>
                        <ListItemText
                          primary={
                            <div>
                              <Typography variant="subtitle1">
                                代币 #{tokenIdBigint.toString()}
                                {token.isOwner && (
                                  <Chip 
                                    label="我的代币" 
                                    color="primary" 
                                    size="small" 
                                    sx={{ ml: 1 }}
                                  />
                                )}
                              </Typography>
                            </div>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {/* {token.metadata} */}
                              代币信息已禁用
                            </Typography>
                          }
                        />
                        <ListItemSecondaryAction>
                          {token.isOwner && (
                            <>
                              <IconButton 
                                edge="end" 
                                aria-label="编辑" 
                                onClick={() => handleOpenUpdateDialog(tokenIdBigint, /* token.metadata */ '')}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton 
                                edge="end" 
                                aria-label="撤销" 
                                onClick={() => onRevokeToken(tokenIdBigint)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })
                ) : (
                  <Typography variant="body1" align="center" sx={{ py: 4 }}>
                    您还没有SBT代币，点击"铸造SBT"创建一个
                  </Typography>
                )}
              </List>
            )}
          </CardContent>
          
          {/* 铸造SBT对话框 */}
          <Dialog open={mintDialogOpen} onClose={() => setMintDialogOpen(false)}>
            <DialogTitle>铸造新的SBT代币</DialogTitle>
            <DialogContent>
              <DialogContentText>
                请输入SBT代币的元数据信息。这些信息将永久存储在区块链上。
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                label="代币元数据"
                type="text"
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                value={tokenMetadata}
                onChange={(e) => setTokenMetadata(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setMintDialogOpen(false)}>取消</Button>
              <Button onClick={onMintToken} color="primary" disabled={!tokenMetadata}>
                铸造
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* 更新SBT对话框 */}
          <Dialog open={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)}>
            <DialogTitle>更新SBT元数据</DialogTitle>
            <DialogContent>
              <DialogContentText>
                更新代币 #{selectedTokenId?.toString()} 的元数据信息
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                label="新元数据"
                type="text"
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                value={tokenMetadata}
                onChange={(e) => setTokenMetadata(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUpdateDialogOpen(false)}>取消</Button>
              <Button onClick={onUpdateToken} color="primary" disabled={!tokenMetadata}>
                更新
              </Button>
            </DialogActions>
          </Dialog>
        </React.Fragment>
      )}
    </Card>
  );
};

const toShortFormatContractAddress = (contractAddress: ContractAddress | undefined): JSX.Element | undefined =>
  contractAddress ? (
    <span title={contractAddress}>
      {`${contractAddress.substring(0, 8)}...${contractAddress.substring(
        contractAddress.length - 8,
        contractAddress.length,
      )}`}
    </span>
  ) : undefined; 