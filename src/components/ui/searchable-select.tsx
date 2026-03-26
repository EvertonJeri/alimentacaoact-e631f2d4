import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SearchableSelectProps {
  options: { value: string; label: string; description?: string }[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  value?: string
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const CLT_PREFIX = "⚠️ CLT •";

function parseCLT(label: string): { isCLT: boolean; name: string } {
  if (label.startsWith(CLT_PREFIX)) {
    return { isCLT: true, name: label.replace(CLT_PREFIX, "").trim() };
  }
  return { isCLT: false, name: label };
}

export function SearchableSelect({
  options,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Não encontrado.",
  value,
  onValueChange,
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((o) => o.value === value);
  const selectedParsed = selectedOption ? parseCLT(selectedOption.label) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal h-11", className)}
        >
          <div className="flex flex-col items-start truncate overflow-hidden">
            {selectedParsed ? (
              <div className="flex items-center gap-1.5">
                {selectedParsed.isCLT && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                    CLT
                  </span>
                )}
                <span className="truncate font-medium text-sm">{selectedParsed.name}</span>
              </div>
            ) : (
              <span className="truncate font-medium text-muted-foreground">{placeholder}</span>
            )}
            {selectedOption?.description && (
              <span className={cn("text-[9px] uppercase leading-none mt-0.5", selectedParsed?.isCLT ? "text-orange-500 font-bold" : "text-muted-foreground")}>
                {selectedOption.description}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {(options || []).slice(0, 100).map((option) => {
                const parsed = parseCLT(option.label);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.description || ""}`}
                    onSelect={() => {
                      onValueChange(option.value)
                      setOpen(false)
                    }}
                    className="flex flex-col items-start py-2"
                  >
                    <div className="flex items-center w-full gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {parsed.isCLT && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                              CLT
                            </span>
                          )}
                          <span className="font-semibold text-xs leading-none">{parsed.name}</span>
                        </div>
                        {option.description && (
                          <span className={cn("text-[9px] uppercase mt-1 leading-none", parsed.isCLT ? "text-orange-500 font-bold" : "text-muted-foreground")}>
                            {option.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
