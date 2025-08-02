import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  runQuery,
} from '@latticexyz/recs';
// eslint-disable-next-line import/no-named-as-default
import Editor, { loader } from '@monaco-editor/react';
import {
  FileText,
  Info,
  Loader2,
  Pencil,
  Rocket,
  Scroll,
  Trash2,
} from 'lucide-react';
import { format } from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity/standalone';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Hash, zeroHash } from 'viem';

import { PatentsList } from '@/components/PatentsList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NO_ACTIONS_ERROR, useBattle } from '@/contexts/BattleContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useMUD } from '@/hooks/useMUD';
import {
  TutorialSteps,
  useTutorialIndicator,
} from '@/hooks/useTutorialIndicator';
import { API_ENDPOINT } from '@/utils/constants';
import type { Patent as PatentType, Tower } from '@/utils/types';

import { ClickIndicator } from './ClickIndicator';
import { Button } from './ui/button';

type TowerAssemblyDrawerProps = {
  isAssemblyDrawerOpen: boolean;
  setIsAssemblyDrawerOpen: (isOpen: boolean) => void;
  tower: Tower;
};

export const TowerAssemblyDrawer: React.FC<TowerAssemblyDrawerProps> = ({
  isAssemblyDrawerOpen,
  setIsAssemblyDrawerOpen,
  tower,
}) => {
  const {
    components: { Patent, Projectile, Username },
    systemCalls: {
      amendPatent,
      disclaimPatent,
      getContractSize,
      modifyTowerSystem,
      registerPatent,
    },
  } = useMUD();
  const { battle, isPlayer1, refreshBattle, setIsNoActionsDialogOpen } =
    useBattle();
  const { playSfx } = useSettings();

  const [selectedPatent, setSelectedPatent] = useState<PatentType | null>(null);
  const { tutorialStep } = useTutorialIndicator(tower, selectedPatent);

  const [patents, setPatents] = useState<PatentType[]>([]);
  const [tooltipSelection, setTooltipSelection] = useState<string | null>(null);

  const [isSemiTransparent, setIsSemiTransparent] = useState<boolean>(false);
  const [sizeLimit, setSizeLimit] = useState<bigint>(BigInt(0));
  const [sourceCode, setSourceCode] = useState<string>('');
  const [bytecode, setBytecode] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  const [showRegisterPatentModal, setShowRegisterPatentModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<
    {
      field: string;
      message: string;
    }[]
  >([]);

  const [showDisclaimPatentModal, setShowDisclaimPatentModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPatents = useCallback(() => {
    try {
      const _patents = Array.from(runQuery([Has(Patent)])).map(entity => {
        const _patent = getComponentValueStrict(Patent, entity as Entity);
        const authorUsername =
          getComponentValue(Username, _patent.patentee as Entity)?.value ??
          'Unknown';

        return {
          id: entity as Entity,
          bytecode: _patent.bytecode,
          description: _patent.description,
          name: _patent.name,
          patentee: _patent.patentee === zeroHash ? 'Template' : authorUsername,
          size: `${_patent.size.toString()} bytes`,
          sourceCode: _patent.sourceCode,
          timestamp: _patent.timestamp,
          useCount: Number(_patent.useCount),
        } as PatentType;
      });
      return _patents.sort((a, b) => Number(b.useCount) - Number(a.useCount));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching patents:', error);
      toast.error('Error Fetching patents', {
        description: (error as Error).message,
      });
      return [];
    }
  }, [Patent, Username]);

  const onRefreshPatentList = useCallback(async (): Promise<PatentType[]> => {
    try {
      if (!battle) return [];
      const _patents = fetchPatents();
      const newPatent = {
        id: zeroHash as Entity,
        bytecode: zeroHash as Hash,
        description: 'Create a new patent!',
        name: 'New Patent',
        patentee: battle.player1Username,
        size: '0 bytes',
        sourceCode: '',
        timestamp: BigInt(Date.now()),
        useCount: 0,
      };

      const projectile = getComponentValue(Projectile, tower.id as Entity);

      if (projectile) {
        try {
          const formattedSourceCode = await format(projectile.sourceCode, {
            parser: 'solidity-parse',
            plugins: [solidityPlugin],
          });

          const flattenedSourceCode = formattedSourceCode
            .replace(/[ \t]+/g, ' ') // collapse spaces/tabs
            .replace(/\r?\n\s*/g, '\n') // trim line indentation but keep newlines
            .trim();
          newPatent.sourceCode = flattenedSourceCode;

          const res = await fetch(`${API_ENDPOINT}/compile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sourceCode: newPatent.sourceCode }),
          });

          if (!res.ok) {
            throw new Error('Failed to compile code');
          }

          const _bytecode = await res.text();
          if (!_bytecode) {
            throw new Error('Failed to compile code');
          }

          const patentMatch = _patents.find(
            s => s.bytecode === (`0x${_bytecode}` as Hash),
          );

          if (patentMatch) {
            setSelectedPatent(patentMatch);
            setBytecode(patentMatch.bytecode);
          } else {
            setSelectedPatent(newPatent);
            setBytecode(`0x${_bytecode}` as Hash);
          }

          setSizeLimit(projectile.sizeLimit);
          setSourceCode(formattedSourceCode.trim());
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error formatting source code:', error);
          setSizeLimit(projectile.sizeLimit);
          setSourceCode('There was an error formatting the source code.');
          setSelectedPatent(_patents[0]);
        }
      } else {
        setSourceCode('');
      }

      const savedPatentsWithDummy = [newPatent, ..._patents];
      setPatents(savedPatentsWithDummy);
      return savedPatentsWithDummy;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error refreshing patent list:', error);
      toast.error('Error Refreshing patent List', {
        description: (error as Error).message,
      });
      return [];
    }
  }, [battle, fetchPatents, Projectile, tower.id]);

  const onSelectPatent = useCallback(async (patent: PatentType) => {
    try {
      const formattedSourceCode = await format(patent.sourceCode, {
        parser: 'solidity-parse',
        plugins: [solidityPlugin],
      });

      setSourceCode(formattedSourceCode.trim());
      setSelectedPatent(patent);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error formatting source code:', error);
      setSourceCode('There was an error formatting the source code.');
      setSelectedPatent(patent);
    } finally {
      setBytecode(patent.bytecode);
    }
  }, []);

  const onModifyTower = useCallback(async () => {
    try {
      setIsDeploying(true);
      playSfx('click3');
      if (!bytecode) {
        throw new Error('Failed to compile code');
      }

      const currentContractSize = await getContractSize(bytecode);
      if (!currentContractSize) {
        throw new Error('Failed to get contract size');
      }

      if (currentContractSize > sizeLimit) {
        throw new Error(
          `Contract size of ${currentContractSize} exceeds limit of ${sizeLimit} bytes`,
        );
      }

      const { error, success } = await modifyTowerSystem(
        tower.id,
        bytecode,
        sourceCode
          .replace(/[ \t]+/g, ' ') // collapse spaces/tabs
          .replace(/\r?\n\s*/g, '\n') // trim line indentation but keep newlines
          .trim(),
      );

      if (error && !success) {
        throw new Error(error);
      }

      toast.success('Modification Deployed!');

      refreshBattle();
      setIsAssemblyDrawerOpen(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Smart contract error: ${(error as Error).message}`);

      if (error instanceof Error && error.message === NO_ACTIONS_ERROR) {
        setIsAssemblyDrawerOpen(false);
        setIsNoActionsDialogOpen(true);
      } else {
        toast.error('Error Deploying Modification', {
          description: (error as Error).message,
        });
      }
    } finally {
      setIsDeploying(false);
    }
  }, [
    bytecode,
    getContractSize,
    modifyTowerSystem,
    playSfx,
    refreshBattle,
    setIsNoActionsDialogOpen,
    setIsAssemblyDrawerOpen,
    sizeLimit,
    sourceCode,
    tower,
  ]);

  const getHasError = useCallback(() => {
    if (!name) {
      setFormErrors(prev => [
        ...(prev || []),
        { field: 'patent-name', message: 'Name is required' },
      ]);
      return true;
    }

    if (!description) {
      setFormErrors(prev => [
        ...prev,
        { field: 'patent-description', message: 'Description is required' },
      ]);
      return true;
    }

    if (name.length > 32) {
      setFormErrors(prev => [
        ...(prev || []),
        {
          field: 'patent-name',
          message: 'Name must be 32 characters or less',
        },
      ]);
      return true;
    }

    if (description.length > 256) {
      setFormErrors(prev => [
        ...prev,
        {
          field: 'patent-description',
          message: 'Description must be 256 characters or less',
        },
      ]);
      return true;
    }

    if (patents.some(s => s.name === name) && selectedPatent?.name !== name) {
      setFormErrors(prev => [
        ...(prev || []),
        { field: 'patent-name', message: 'Name already exists' },
      ]);
      return true;
    }

    return false;
  }, [description, name, patents, selectedPatent, setFormErrors]);

  const onRegisterPatent = useCallback(async () => {
    try {
      setIsSaving(true);
      playSfx('click3');

      const hasError = getHasError();
      if (hasError) return;

      if (!bytecode) {
        throw new Error('Failed to compile code');
      }

      const currentContractSize = await getContractSize(bytecode);
      if (!currentContractSize) {
        throw new Error('Failed to get contract size');
      }

      if (currentContractSize > sizeLimit) {
        throw new Error(
          `Contract size of ${currentContractSize} exceeds limit of ${sizeLimit} bytes`,
        );
      }

      const { error, success } = await registerPatent(
        bytecode,
        description,
        name,
        sourceCode
          .replace(/[ \t]+/g, ' ') // collapse spaces/tabs
          .replace(/\r?\n\s*/g, '\n') // trim line indentation but keep newlines
          .trim(),
      );

      if (error && !success) {
        throw new Error(error);
      }

      toast.success('Patent Registered!');

      setShowRegisterPatentModal(false);
      setName('');
      setDescription('');
      const _patents = await onRefreshPatentList();

      const matchingPatent = _patents.find(s => s.bytecode === bytecode);
      if (matchingPatent) {
        onSelectPatent(matchingPatent);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Smart contract error: ${(error as Error).message}`);

      toast.error('Error Registering Patent', {
        description: (error as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    bytecode,
    description,
    getContractSize,
    getHasError,
    name,
    onRefreshPatentList,
    onSelectPatent,
    playSfx,
    registerPatent,
    sizeLimit,
    sourceCode,
  ]);

  const onAmendPatent = useCallback(async () => {
    try {
      setIsSaving(true);
      playSfx('click3');

      const hasError = getHasError();
      if (hasError) return;

      if (
        name === selectedPatent?.name &&
        description === selectedPatent?.description
      ) {
        throw new Error('No changes made to the patent');
      }

      if (!selectedPatent) {
        throw new Error('No patent selected');
      }

      const { error, success } = await amendPatent(
        selectedPatent.id,
        description,
        name,
      );

      if (error && !success) {
        throw new Error(error);
      }

      toast.success('Patent Amended!');

      setShowRegisterPatentModal(false);
      const _patents = await onRefreshPatentList();

      const matchingPatent = _patents.find(
        s => s.bytecode === selectedPatent.bytecode,
      );
      if (matchingPatent) {
        onSelectPatent(matchingPatent);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Smart contract error: ${(error as Error).message}`);

      toast.error('Error Amending Patent', {
        description: (error as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    amendPatent,
    description,
    getHasError,
    name,
    onRefreshPatentList,
    onSelectPatent,
    playSfx,
    selectedPatent,
  ]);

  const onDisclaimPatent = useCallback(async () => {
    try {
      setIsDeleting(true);
      playSfx('click3');

      if (!selectedPatent) {
        throw new Error('No patent selected');
      }

      const { error, success } = await disclaimPatent(selectedPatent.id);

      if (error && !success) {
        throw new Error(error);
      }

      toast.success('Patent Deleted!');

      setShowDisclaimPatentModal(false);
      const _patents = await onRefreshPatentList();

      onSelectPatent(_patents[0]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Smart contract error: ${(error as Error).message}`);

      toast.error('Error Deleting Patent', {
        description: (error as Error).message,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [
    disclaimPatent,
    onRefreshPatentList,
    onSelectPatent,
    playSfx,
    selectedPatent,
  ]);

  useEffect(() => {
    setFormErrors([]);
  }, [description, name]);

  const isMyTower = useMemo(() => {
    if (!isPlayer1) return false;
    if (!battle) return false;
    return battle.player1Id === tower.owner;
  }, [battle, isPlayer1, tower.owner]);

  const isPatentRegistered = useMemo(() => {
    if (!bytecode) return false;
    return patents.slice(1).some(s => s.bytecode === bytecode);
  }, [bytecode, patents]);

  const canAmendPatent = useMemo(() => {
    if (!(battle && selectedPatent)) return false;
    if (selectedPatent.bytecode === zeroHash) return false;
    if (selectedPatent.patentee === 'Template') return false;
    return selectedPatent?.patentee === battle.player1Username;
  }, [battle, selectedPatent]);

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
    <Sheet
      onOpenChange={open => setIsAssemblyDrawerOpen(open)}
      open={isAssemblyDrawerOpen}
    >
      <SheetContent
        aria-describedby={undefined}
        className={`bg-gray-900/95 border-l border-cyan-900/50 max-w-none md:w-[800px] p-4 ${isSemiTransparent ? 'opacity-10' : 'opacity-100'} w-[90%]`}
        side="right"
      >
        <SheetHeader>
          <SheetTitle className="font-bold text-cyan-400 text-2xl">
            TOWER ASSEMBLY
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 overflow-y-auto pb-[100px]">
          <Dialog aria-describedby={undefined}>
            <DialogTrigger asChild>
              <Button
                className="border-purple-500 hover:text-purple-300 hover:bg-purple-950/50 text-purple-400"
                variant="outline"
              >
                <Scroll className="h-4 mr-2 w-4" />
                View Rules
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border border-cyan-900/50 text-white">
              <DialogHeader>
                <DialogTitle className="text-cyan-400 text-2xl">
                  Rules
                </DialogTitle>
              </DialogHeader>
              <ul className="space-y-4 text-gray-300">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>
                    Modify the <span className="text-cyan-400">Solidity</span>{' '}
                    code to change the behavior of the projectile. The
                    projectile will be deployed as a smart contract.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>
                    Projectiles move at a speed of x &quot;pixels&quot; per
                    tick. However,
                    <span className="font-semibold text-pink-400">
                      {' '}
                      x can never exceed 10 per tick{' '}
                    </span>
                    (each tile has a resolution of 10x10 pixels).
                    <span className="font-semibold text-cyan-400">
                      {' '}
                      There are 28 ticks{' '}
                    </span>
                    when the round results run. The recommended speed is 5
                    pixels per tick.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>
                    The size limit of the projectile logic code is{' '}
                    <span className="font-semibold text-cyan-400">
                      1000 bytes
                    </span>
                    .
                  </span>
                </li>
              </ul>
            </DialogContent>
          </Dialog>

          <div className="flex gap-2 items-center">
            <h3 className="font-semibold my-4 text-white text-xl">Patents</h3>
            <TooltipProvider>
              <Tooltip open={tooltipSelection === 'patentsTooltip'}>
                <TooltipTrigger
                  className="h-6 hover:cursor-pointer hover:text-white text-gray-400 w-6"
                  onClick={() => setTooltipSelection('patentsTooltip')}
                  onMouseEnter={() => setTooltipSelection('patentsTooltip')}
                  onMouseLeave={() => setTooltipSelection(null)}
                >
                  <Info className="h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Basic templates are included in your list of patents</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {selectedPatent && (
            <PatentsList
              onSelectPatent={onSelectPatent}
              patents={patents}
              tutorialStep={tutorialStep}
              selectedPatent={selectedPatent}
            />
          )}

          <div className="flex flex-col gap-3 mb-6 mt-6 sm:flex-row">
            <div className="flex gap-3">
              {isMyTower && (
                <div className="relative">
                  {tutorialStep === TutorialSteps.FOUR_SIX && (
                    <ClickIndicator />
                  )}
                  <Button
                    className="bg-cyan-950/30 border-cyan-500 hover:bg-cyan-900/50 hover:text-cyan-300 text-cyan-400"
                    disabled={isDeploying}
                    onClick={onModifyTower}
                    variant="outline"
                  >
                    {isDeploying ? (
                      <Loader2 className="animate-spin h-6 w-6" />
                    ) : (
                      <Rocket className="h-4 mr-2 w-4" />
                    )}
                    Deploy
                  </Button>
                </div>
              )}
              <Button
                className="border-purple-500 hover:bg-purple-950/50 hover:text-purple-300 text-purple-400"
                onMouseEnter={() => setIsSemiTransparent(true)}
                onMouseLeave={() => setIsSemiTransparent(false)}
                variant="outline"
              >
                View Board
              </Button>
            </div>
            {isMyTower &&
              !!bytecode &&
              (!isPatentRegistered || canAmendPatent) && (
                <div className="flex gap-3">
                  <Button
                    className="border-pink-500 hover:bg-pink-950/50 hover:text-pink-300 text-pink-400"
                    onClick={() => {
                      setShowRegisterPatentModal(true);

                      if (canAmendPatent && selectedPatent) {
                        setName(selectedPatent.name);
                        setDescription(selectedPatent.description);
                      }
                    }}
                    variant="outline"
                  >
                    {isPatentRegistered ? (
                      <Pencil className="h-4 mr-2 w-4" />
                    ) : (
                      <FileText className="h-4 mr-2 w-4" />
                    )}
                    {isPatentRegistered ? 'Amend' : 'Register'} Patent
                  </Button>
                  {canAmendPatent && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            aria-label="Delete Patent"
                            className="border-pink-500 hover:bg-pink-950/50 hover:text-pink-300 text-pink-400"
                            onClick={() => setShowDisclaimPatentModal(true)}
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete Patent</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}
          </div>

          {/* SAVE AND EDIT DIALOG */}
          <Dialog
            open={showRegisterPatentModal}
            onOpenChange={setShowRegisterPatentModal}
          >
            <DialogContent className="bg-gray-900/95 border border-pink-900/50 text-white">
              <DialogHeader>
                <DialogTitle className="font-bold text-pink-400 text-2xl">
                  {canAmendPatent ? 'Amend' : 'Register'} Patent
                </DialogTitle>
                <DialogDescription className="mt-2 text-gray-300">
                  {canAmendPatent
                    ? 'Edit your custom projectile patent.'
                    : 'Save your custom projectile patent for future use.'}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-white" htmlFor="patent-name">
                    Patent Name
                  </Label>
                  <Input
                    className="bg-gray-800 border-gray-700 text-white"
                    disabled={isSaving}
                    id="patent-name"
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter a name for your patent"
                    type="text"
                    value={name}
                  />
                  {formErrors?.find(e => e.field === 'patent-name') && (
                    <p className="text-red-500 text-sm">
                      {
                        formErrors?.find(e => e.field === 'patent-name')
                          ?.message
                      }
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-white" htmlFor="patent-description">
                    Description
                  </Label>
                  <Textarea
                    className="bg-gray-800 border border-gray-700 h-24 p-2 rounded-md text-white text-sm w-full"
                    disabled={isSaving}
                    id="patent-description"
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what your patent does"
                    value={description}
                  />
                  {formErrors?.find(e => e.field === 'patent-description') && (
                    <p className="text-red-500 text-sm">
                      {
                        formErrors?.find(e => e.field === 'patent-description')
                          ?.message
                      }
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  className="border-gray-700 text-gray-400"
                  disabled={isSaving}
                  onClick={() => setShowRegisterPatentModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-pink-800 hover:bg-pink-700 text-white"
                  disabled={isSaving}
                  onClick={canAmendPatent ? onAmendPatent : onRegisterPatent}
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin h-6 w-6" />
                  ) : canAmendPatent ? (
                    'Save Changes'
                  ) : (
                    'Register Patent'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* DELETE DIALOG */}
          <Dialog
            open={showDisclaimPatentModal}
            onOpenChange={setShowDisclaimPatentModal}
          >
            <DialogContent
              aria-describedby={undefined}
              className="bg-gray-900/95 border border-pink-900/50 text-white"
            >
              <DialogHeader>
                <DialogTitle className="font-bold text-pink-400 text-2xl">
                  Delete Patent
                </DialogTitle>
              </DialogHeader>
              <DialogDescription className="mt-2 text-gray-300">
                Are you sure you want to delete this patent?{' '}
                <strong>This action cannot be undone.</strong>
              </DialogDescription>
              <DialogFooter className="mt-6">
                <Button
                  className="border-gray-700 text-gray-400"
                  disabled={isDeleting}
                  onClick={() => setShowDisclaimPatentModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-pink-800 hover:bg-pink-700 text-white"
                  disabled={isDeleting}
                  onClick={onDisclaimPatent}
                >
                  {isDeleting ? (
                    <Loader2 className="animate-spin h-6 w-6" />
                  ) : (
                    'Delete Patent'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="bg-black/50 border border-cyan-900/50 relative rounded-lg">
            {!isMyTower && (
              <div className="absolute bg-transparent flex h-full w-full z-1" />
            )}
            <Editor
              defaultLanguage="solidity"
              height="300px"
              onChange={value => {
                if (!value) return;
                fetch(`${API_ENDPOINT}/compile`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ sourceCode: value }),
                }).then(res => {
                  if (!res.ok) {
                    setBytecode('');
                    return;
                  }

                  res.text().then(_bytecode => {
                    if (!_bytecode) {
                      setSourceCode(value);
                      return;
                    }

                    const patentMatch = patents
                      .slice(1)
                      .find(s => s.bytecode === `0x${_bytecode}`);

                    if (patentMatch) {
                      setSelectedPatent(patentMatch);
                      setBytecode(patentMatch.bytecode);
                    } else {
                      setSelectedPatent(patents[0]);
                      setBytecode(`0x${_bytecode}`);
                    }
                    setSourceCode(value ?? '');
                  });
                });
              }}
              onMount={onRefreshPatentList}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
              }}
              value={sourceCode}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
