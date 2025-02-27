import { Box, HStack, Text, useDialog } from '@chakra-ui/react';
import { Entity, getComponentValue } from '@latticexyz/recs';
// eslint-disable-next-line import/no-named-as-default
import Editor, { loader } from '@monaco-editor/react';
import { format } from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity/standalone';
import { useCallback, useState } from 'react';
import { FcRules } from 'react-icons/fc';

import { useGame } from '../contexts/GameContext';
import { useMUD } from '../MUDContext';
import { type Tower } from '../utils/types';
import { Button } from './ui/button';
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
} from './ui/drawer';
import { toaster } from './ui/toaster';

type SystemModificationDrawerProps = {
  isSystemDrawerOpen: boolean;
  setIsSystemDrawerOpen: (isOpen: boolean) => void;
  tower: Tower;
};

export const SystemModificationDrawer: React.FC<
  SystemModificationDrawerProps
> = ({ isSystemDrawerOpen, setIsSystemDrawerOpen, tower }) => {
  const {
    components: { Projectile },
    systemCalls: { getContractSize, modifyTowerSystem },
  } = useMUD();
  const { isPlayer1, refreshGame } = useGame();

  const [isSemiTransparent, setIsSemiTransparent] = useState<boolean>(false);
  const [sizeLimit, setSizeLimit] = useState<bigint>(BigInt(0));
  const [sourceCode, setSourceCode] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  const dialog = useDialog();

  const onCompileCode = useCallback(async (): Promise<string | null> => {
    try {
      const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

      const res = await fetch(`${API_ENDPOINT}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceCode }),
      });

      if (!res.ok) {
        throw new Error('Failed to compile code');
      }

      const bytecode = await res.text();

      return `0x${bytecode}`;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error compiling code:', error);

      toaster.create({
        title: 'Error Compiling Code',
        type: 'error',
      });

      return null;
    }
  }, [sourceCode]);

  const onModifyTowerSystem = useCallback(async () => {
    try {
      setIsDeploying(true);
      const bytecode = await onCompileCode();
      if (!bytecode) {
        setIsDeploying(false);
        return;
      }

      const currentContractSize = await getContractSize(bytecode);
      if (!currentContractSize) {
        throw new Error('Failed to get contract size');
      }

      if (currentContractSize > sizeLimit) {
        throw new Error(
          `Contract size of ${currentContractSize} exceeds limit of ${sizeLimit}`,
        );
      }

      const { error, success } = await modifyTowerSystem(
        tower.id,
        bytecode,
        sourceCode,
      );

      if (error && !success) {
        throw new Error(error);
      }

      toaster.create({
        title: 'System Deployed!',
        type: 'success',
      });

      setIsSystemDrawerOpen(false);
      refreshGame();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Smart contract error: ${(error as Error).message}`);

      toaster.create({
        description: (error as Error).message,
        title: 'Error Deploying System',
        type: 'error',
      });
    } finally {
      setIsDeploying(false);
    }
  }, [
    getContractSize,
    modifyTowerSystem,
    onCompileCode,
    refreshGame,
    setIsSystemDrawerOpen,
    sizeLimit,
    sourceCode,
    tower,
  ]);

  // Configure Solidity language
  loader.init().then(monacoInstance => {
    monacoInstance.languages.register({ id: 'solidity' });

    monacoInstance.languages.setMonarchTokensProvider('solidity', {
      tokenizer: {
        root: [
          [
            /\b(?:pragma|contract|function|string|public|constructor|memory|returns)\b/,
            'keyword',
          ],
          [/\b(?:uint256|string|bool|address)\b/, 'type'],
          [/["'].*["']/, 'string'],
          [/\/\/.*$/, 'comment'],
        ],
      },
    });

    monacoInstance.languages.setLanguageConfiguration('solidity', {
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
      ],
    });
  });

  return (
    <DrawerRoot
      onOpenChange={e => setIsSystemDrawerOpen(e.open)}
      open={isSystemDrawerOpen}
      size="lg"
    >
      <DrawerBackdrop />
      <DrawerContent
        bgColor="white"
        opacity={isSemiTransparent ? 0.2 : 1}
        transition="opacity 0.3s ease"
      >
        <DrawerCloseTrigger bgColor="black" />
        <DrawerHeader>
          <DrawerTitle color="black" textTransform="uppercase">
            System Modification
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody color="black">
          <DialogRoot
            onOpenChange={e =>
              e.open ? dialog.setOpen(true) : dialog.setOpen(false)
            }
            open={dialog.open}
            scrollBehavior="inside"
          >
            <DialogBackdrop />
            <DialogTrigger
              as={Button}
              border="1px black solid"
              mb={4}
              _hover={{
                bgColor: 'gray.200',
              }}
            >
              <Text>View the Rules</Text>
              <FcRules color="black" />
            </DialogTrigger>
            <DialogContent bgColor="white" color="black">
              <DialogCloseTrigger bgColor="black" />
              <DialogHeader>
                <DialogTitle textTransform="uppercase">Rules</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Box as="ul" listStylePosition="inside" listStyleType="circle">
                  <li>
                    Modify the <strong>Solidity</strong> code to change the
                    behavior of the projectile. The projectile will be deployed
                    as a smart contract.
                  </li>
                  <li>
                    Projectiles move at a speed of x &quot;pixels&quot; per
                    tick. However,{' '}
                    <strong>x can never exceed 10 per tick</strong> (each tile
                    has a resolution of 10x10 pixels).{' '}
                    <strong>There are 28 ticks</strong> when the round results
                    run. The recommended speed is 5 pixels per tick.
                  </li>
                  <li>
                    The size limit of the projectile logic code is{' '}
                    <strong>{sizeLimit.toString()} bytes</strong>.
                  </li>
                </Box>
              </DialogBody>
              <DialogFooter />
            </DialogContent>
          </DialogRoot>
          <HStack mb={4}>
            {isPlayer1 && (
              <Button
                disabled={isDeploying}
                onClick={onModifyTowerSystem}
                variant="surface"
              >
                {isDeploying ? 'Deploying...' : 'Deploy'}
              </Button>
            )}
            <Button
              border="1px solid black"
              color="black"
              onMouseEnter={() => setIsSemiTransparent(true)}
              onMouseLeave={() => setIsSemiTransparent(false)}
              variant="plain"
            >
              View Board
            </Button>
          </HStack>
          <Box border="1px solid black" position="relative" w="100%">
            {!isPlayer1 && (
              <Box
                bg="transparent"
                h="300px"
                position="absolute"
                w="100%"
                zIndex={1}
              />
            )}
            <Editor
              defaultLanguage="solidity"
              height="300px"
              onChange={value => setSourceCode(value ?? '')}
              onMount={() => {
                const projectile = getComponentValue(
                  Projectile,
                  tower.id as Entity,
                );

                if (projectile) {
                  format(projectile.sourceCode, {
                    parser: 'solidity-parse',
                    plugins: [solidityPlugin],
                  }).then(formattedSourceCode => {
                    setSizeLimit(projectile.sizeLimit);
                    setSourceCode(formattedSourceCode.trim());
                  });
                } else {
                  setSourceCode('');
                }
              }}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
              }}
              value={sourceCode}
            />
          </Box>
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
};
