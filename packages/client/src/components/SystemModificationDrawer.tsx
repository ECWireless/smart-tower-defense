import { Box } from '@chakra-ui/react';
// eslint-disable-next-line import/no-named-as-default
import Editor, { loader } from '@monaco-editor/react';
import { useCallback, useState } from 'react';

import { useMUD } from '../MUDContext';
import { type Tower } from '../utils/types';
import { Button } from './ui/button';
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
} from './ui/drawer';
import { toaster } from './ui/toaster';

const DEFAULT_SOURCE_CODE = `
contract DefaultProjectileLogicLeft {
  function getNextProjectilePosition(int8 x, int8 y) public pure returns (int8, int8) {
    return (x + 1, y);
  }
}
`;

type SystemModificationDrawerProps = {
  isSystemDrawerOpen: boolean;
  setIsSystemDrawerOpen: (isOpen: boolean) => void;
  tower: Tower;
};

export const SystemModificationDrawer: React.FC<
  SystemModificationDrawerProps
> = ({ isSystemDrawerOpen, setIsSystemDrawerOpen, tower }) => {
  const {
    systemCalls: { modifyTowerSystem },
  } = useMUD();

  const [sourceCode, setSourceCode] = useState(DEFAULT_SOURCE_CODE.trim());
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

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
      const { error, success } = await modifyTowerSystem(tower.id, bytecode);

      if (error && !success) {
        throw new Error(error);
      }

      toaster.create({
        title: 'System Deployed!',
        type: 'success',
      });

      setIsSystemDrawerOpen(false);
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
  }, [modifyTowerSystem, onCompileCode, setIsSystemDrawerOpen, tower]);

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
      <DrawerContent bgColor="white">
        <DrawerCloseTrigger bgColor="black" />
        <DrawerHeader>
          <DrawerTitle color="black" textTransform="uppercase">
            System Modification
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <Box border="1px solid black" h="200px" w="100%">
            <Editor
              defaultLanguage="solidity"
              height="100%"
              onChange={value => setSourceCode(value ?? '')}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
              }}
              value={sourceCode}
            />
          </Box>
          <Button
            disabled={isDeploying}
            mt={4}
            onClick={onModifyTowerSystem}
            variant="surface"
          >
            {isDeploying ? 'Deploying...' : 'Deploy'}
          </Button>
        </DrawerBody>
        <DrawerFooter />
      </DrawerContent>
    </DrawerRoot>
  );
};
