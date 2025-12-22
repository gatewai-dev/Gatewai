// src/node-palette/DataTypeMultiSelect.tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodePalette } from './node-palette.ctx';
import { useNodeTemplates } from '../node-templates.ctx';

export function DataTypeMultiSelect() {
  const { fromType, toTypes, setFromType, setToTypes } = useNodePalette();
  const [openInput, setOpenInput] = useState(false);
  const [openOutput, setOpenOutput] = useState(false);
  const [localFromType, setLocalFromType] = useState(fromType);
  const [localToTypes, setLocalToTypes] = useState(toTypes);
  const { nodeTemplates } = useNodeTemplates();

  // Dynamically populate all unique data types from nodeTemplates
  const allDataTypes = Array.from(
    new Set(
      nodeTemplates
        ?.flatMap((template) =>
          [...(template.inputTypes ?? []).map((input) => input.inputType), ...(template.outputTypes ?? []).map((output) => output.outputType)]
        ) || []
    )
  );

  useEffect(() => {
    if (openInput) {
      setLocalFromType(fromType);
    }
  }, [openInput, fromType]);

  useEffect(() => {
    if (openOutput) {
      setLocalToTypes(toTypes);
    }
  }, [openOutput, toTypes]);

  const toggleFromType = (type: string) => {
    setLocalFromType(type);
  };

  const toggleToType = (type: string) => {
    setLocalToTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const applyInputChanges = () => {
    setFromType(localFromType);
    setOpenInput(false);
  };

  const applyOutputChanges = () => {
    setToTypes(localToTypes);
    setOpenOutput(false);
  };

  const displayFrom = localFromType || 'Input';
  const displayTo = localToTypes.length ? localToTypes.join(' ') : 'Output';

  return (
    <>
      <Popover open={openInput} onOpenChange={setOpenInput}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openInput}
            className="w-full justify-between mb-2"
          >
            From {displayFrom}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandGroup>
              {allDataTypes.map((type) => (
                <CommandItem
                  key={type}
                  onSelect={() => toggleFromType(type)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      localFromType === type ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {type}
                </CommandItem>
              ))}
              <CommandItem onSelect={applyInputChanges}>
                Apply Input Filter
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={openOutput} onOpenChange={setOpenOutput}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openOutput}
            className="w-full justify-between"
          >
            To {displayTo}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandGroup>
              {allDataTypes.filter((type) => type !== localFromType).map((type) => (
                <CommandItem
                  key={type}
                  onSelect={() => toggleToType(type)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      localToTypes.includes(type) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {type}
                </CommandItem>
              ))}
              <CommandItem onSelect={applyOutputChanges}>
                Match this search
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}