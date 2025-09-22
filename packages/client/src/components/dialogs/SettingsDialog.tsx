import { AccountButton } from '@latticexyz/entrykit/internal';
import { useComponentValue } from '@latticexyz/react';
import { Loader2, Music, Settings, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/contexts/SettingsContext';
import { useMUD } from '@/hooks/useMUD';
import { API_ENDPOINT } from '@/utils/constants';
import type { AudioSettings } from '@/utils/types';

import { TransferOwnershipDialog } from './TranserOwnershipDialog';

export const SettingsDialog: React.FC = () => {
  const {
    components: { Username },
    network: { globalPlayerId },
    systemCalls: { updateUsername },
  } = useMUD();
  const { playSfx, setMusicVolume, setSfxMuted, setSfxVolume, toggleMusic } =
    useSettings();

  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AudioSettings>({
    musicEnabled: true,
    musicVolume: 50,
    sfxEnabled: true,
    sfxVolume: 80,
  });
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

  const savedUsername = useComponentValue(Username, globalPlayerId)?.value;
  useEffect(() => {
    if (!globalPlayerId) return;
    if (savedUsername) {
      setUsername(savedUsername);
      setNewUsername(savedUsername);
    }
  }, [globalPlayerId, savedUsername]);

  const usernameError = useMemo(() => {
    if (!newUsername) return null;
    if (newUsername.length > 20) {
      return 'Username must be 20 characters or less';
    }
    return null;
  }, [newUsername]);

  const isDisabled = useMemo(() => {
    if (isUpdating) return true;
    if (!username) return true;
    if (!newUsername) return true;
    if (usernameError) return true;
    if (newUsername.length > 20) return true;
    if (newUsername === username) return true;
    return false;
  }, [isUpdating, newUsername, username, usernameError]);

  const onUpdateUsername = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isDisabled) return;
      try {
        setIsUpdating(true);
        playSfx('click2');

        const res = await fetch(`${API_ENDPOINT}/check-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: newUsername.trim() }),
        });

        if (!res.ok) {
          throw new Error('Failed to validate username');
        }

        const { acceptable } = await res.json();
        if (!acceptable) {
          throw new Error('Username does not pass content moderation');
        }

        const { error, success } = await updateUsername(newUsername.trim());

        if (error && !success) {
          throw new Error(error);
        }

        toast.success('Username Updated!');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Smart contract error: ${(error as Error).message}`);

        toast.error('Error Updating Username', {
          description: (error as Error).message,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [isDisabled, newUsername, playSfx, updateUsername],
  );

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('audioSettings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse saved audio settings', e);
      }
    }
  }, []);

  // Open dialog when 'esc' is clicked
  useEffect(() => {
    if (open) return () => undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !e.repeat) {
        setOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleMusicToggle = (enabled: boolean) => {
    const _newSettings = { ...settings, musicEnabled: enabled };
    setSettings(_newSettings);
    localStorage.setItem('audioSettings', JSON.stringify(_newSettings));
    toggleMusic();
  };

  const handleSfxToggle = (enabled: boolean) => {
    const _newSettings = { ...settings, sfxEnabled: enabled };
    setSettings(_newSettings);
    localStorage.setItem('audioSettings', JSON.stringify(_newSettings));
    setSfxMuted(!enabled);
  };

  const handleMusicVolumeChange = (value: number[]) => {
    const _newSettings = { ...settings, musicVolume: value[0] };
    setSettings(_newSettings);
    localStorage.setItem('audioSettings', JSON.stringify(_newSettings));
    const volumeAsDecimal = value[0] / 100; // Convert percentage to decimal
    setMusicVolume(volumeAsDecimal);
  };

  const handleSfxVolumeChange = (value: number[]) => {
    const _newSettings = { ...settings, sfxVolume: value[0] };
    setSettings(_newSettings);
    localStorage.setItem('audioSettings', JSON.stringify(_newSettings));
    const volumeAsDecimal = value[0] / 100; // Convert percentage to decimal
    setSfxVolume(volumeAsDecimal);
  };

  return (
    <>
      <Button
        aria-label="Settings"
        className="bg-gray-900/80 border-cyan-500 bottom-4 fixed h-10 hover:bg-cyan-950/80 hover:text-cyan-300 left-4 rounded-full text-cyan-400 w-10 z-50"
        onClick={() => setOpen(true)}
        size="icon"
        variant="outline"
      >
        <Settings className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onOpenAutoFocus={e => e.preventDefault()}
          aria-describedby={undefined}
          className="bg-gray-900/95 border border-cyan-900/50 text-white"
        >
          <DialogHeader>
            <DialogTitle className="font-bold text-cyan-400 text-2xl">
              SETTINGS
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            <div className="mb-8 mx-auto w-fit" onClick={() => setOpen(false)}>
              <AccountButton />
            </div>

            {!!username && (
              <form onSubmit={onUpdateUsername}>
                <div className="mb-4 space-y-2">
                  <Label className="text-gray-300 text-sm" htmlFor="username">
                    Username
                  </Label>
                  <Input
                    className="bg-gray-800 border-gray-700 text-white"
                    disabled={false}
                    id="username"
                    onChange={e => setNewUsername(e.target.value)}
                    required
                    type="text"
                    value={newUsername}
                  />
                  {usernameError && (
                    <div className="text-red-500 text-sm ">{usernameError}</div>
                  )}
                </div>
                <div className="flex justify-end mb-8">
                  <Button
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    disabled={isDisabled}
                    type="submit"
                  >
                    {isUpdating && <Loader2 className="animate-spin h-6 w-6" />}
                    Update Username
                  </Button>
                </div>
              </form>
            )}

            {/* Music Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  <Music
                    className={`h-5 ${settings.musicEnabled ? 'text-purple-400' : 'text-gray-500'} w-5`}
                  />
                  <Label className="font-medium text-lg" htmlFor="music-toggle">
                    Music
                  </Label>
                </div>
                <Switch
                  id="music-toggle"
                  checked={settings.musicEnabled}
                  className="data-[state=checked]:bg-purple-600"
                  onCheckedChange={handleMusicToggle}
                />
              </div>

              <div className="pl-7">
                <div className="flex items-center justify-between mb-2">
                  <Label
                    className="text-gray-400 text-sm"
                    htmlFor="music-volume"
                  >
                    Volume
                  </Label>
                  <span className="font-medium text-purple-400 text-sm">
                    {settings.musicVolume}%
                  </span>
                </div>
                <Slider
                  className={`${!settings.musicEnabled ? 'opacity-50' : ''}`}
                  disabled={!settings.musicEnabled}
                  id="music-volume"
                  max={100}
                  onValueChange={handleMusicVolumeChange}
                  step={1}
                  value={[settings.musicVolume]}
                />
              </div>
            </div>

            <div className="bg-gray-800 h-px" />

            {/* SFX Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  {settings.sfxEnabled ? (
                    <Volume2 className="h-5 text-pink-400 w-5" />
                  ) : (
                    <VolumeX className="h-5 text-gray-500 w-5" />
                  )}
                  <Label className="font-medium text-lg" htmlFor="sfx-toggle">
                    Sound Effects
                  </Label>
                </div>
                <Switch
                  checked={settings.sfxEnabled}
                  className="data-[state=checked]:bg-pink-600"
                  id="sfx-toggle"
                  onCheckedChange={handleSfxToggle}
                />
              </div>

              <div className="pl-7">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-gray-400" htmlFor="sfx-volume">
                    Volume
                  </Label>
                  <span className="font-medium text-pink-400 text-sm">
                    {settings.sfxVolume}%
                  </span>
                </div>
                <Slider
                  className={`${!settings.sfxEnabled ? 'opacity-50' : ''}`}
                  disabled={!settings.sfxEnabled}
                  id="sfx-volume"
                  max={100}
                  onValueChange={handleSfxVolumeChange}
                  step={1}
                  value={[settings.sfxVolume]}
                />
              </div>
            </div>

            <div className="pt-2 italic text-gray-500 text-xs">
              Settings are automatically saved to your browser.
            </div>
          </div>

          {!!username && (
            <div className="flex justify-center mt-8">
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={() => setIsTransferDialogOpen(true)}
                type="button"
              >
                Transfer Ownership
              </Button>
            </div>
          )}
          <TransferOwnershipDialog
            isTransferDialogOpen={isTransferDialogOpen}
            setIsTransferDialogOpen={setIsTransferDialogOpen}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
