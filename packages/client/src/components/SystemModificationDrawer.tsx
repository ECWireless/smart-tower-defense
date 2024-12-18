import { Box } from '@chakra-ui/react';
// eslint-disable-next-line import/no-named-as-default
import Editor, { loader } from '@monaco-editor/react';
import { useState } from 'react';

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
};

export const SystemModificationDrawer: React.FC<
  SystemModificationDrawerProps
> = ({ isSystemDrawerOpen, setIsSystemDrawerOpen }) => {
  const [sourceCode, setSourceCode] = useState(DEFAULT_SOURCE_CODE.trim());

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
          <Button mt={4} variant="surface">
            Deploy
          </Button>
        </DrawerBody>
        <DrawerFooter />
      </DrawerContent>
    </DrawerRoot>
  );
};
