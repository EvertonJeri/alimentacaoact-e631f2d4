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
            <span className="truncate w-full font-medium">
              {value
                ? options.find((option) => option.value === value)?.label
                : placeholder}
            </span>
            {value && options.find((option) => option.value === value)?.description && (
              <span className="text-[9px] text-muted-foreground uppercase leading-none mt-0.5">
                {options.find((option) => option.value === value)?.description}
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
              {(options || []).map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description || ""}`}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                  className="flex flex-col items-start py-2"
                >
                  <div className="flex items-center w-full">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs leading-none">{option.label}</span>
                      {option.description && (
                        <span className="text-[9px] text-muted-foreground uppercase mt-1 leading-none">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
