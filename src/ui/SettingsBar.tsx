import { useId, useRef, useState, type KeyboardEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { TONE_OPTIONS, type Tone, type TranslationMode } from './types'
import styles from '../styles/SettingsBar.module.css'

export function SettingsBar({
  translationMode,
  onTranslationModeChange,
  tone,
  onToneChange,
}: {
  translationMode: TranslationMode
  onTranslationModeChange: (mode: TranslationMode) => void
  tone: Tone
  onToneChange: (tone: Tone) => void
}) {
  const [isToneOpen, setIsToneOpen] = useState(false)
  const toneTriggerRef = useRef<HTMLButtonElement>(null)
  const toneOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const toneMenuId = useId()
  const toneLabel =
    TONE_OPTIONS.find((option) => option.value === tone)?.label ?? tone
  const selectedToneIndex = Math.max(
    0,
    TONE_OPTIONS.findIndex((option) => option.value === tone),
  )
  const [focusedToneIndex, setFocusedToneIndex] = useState(selectedToneIndex)

  const focusToneOption = (index: number) => {
    setFocusedToneIndex(index)
    toneOptionRefs.current[index]?.focus()
  }

  const selectTone = (nextTone: Tone) => {
    onToneChange(nextTone)
    setIsToneOpen(false)
  }

  const handleToneOpenChange = (open: boolean) => {
    if (open) {
      setFocusedToneIndex(selectedToneIndex)
    }
    setIsToneOpen(open)
  }

  const handleToneKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        focusToneOption((index + 1) % TONE_OPTIONS.length)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        focusToneOption((index - 1 + TONE_OPTIONS.length) % TONE_OPTIONS.length)
        break
      case 'Home':
        event.preventDefault()
        focusToneOption(0)
        break
      case 'End':
        event.preventDefault()
        focusToneOption(TONE_OPTIONS.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectTone(TONE_OPTIONS[index].value)
        break
      case 'Escape':
        event.preventDefault()
        setIsToneOpen(false)
        toneTriggerRef.current?.focus()
        break
    }
  }

  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <span className={styles.metaLabel} id="settings-standard-label">
          STANDARD
        </span>
        <ToggleGroup.Root
          type="single"
          className={styles.toggleGroup}
          value={translationMode}
          onValueChange={(value) => {
            if (value) onTranslationModeChange(value as TranslationMode)
          }}
          aria-labelledby="settings-standard-label"
        >
          <ToggleGroup.Item className={styles.toggleItem} value="standard">
            標準翻訳
          </ToggleGroup.Item>
          <ToggleGroup.Item className={styles.toggleItem} value="paraphrase">
            意訳
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>

      <div className={styles.group}>
        <span className={styles.metaLabel} id="settings-tone-label">
          TONE
        </span>
        <Popover.Root open={isToneOpen} onOpenChange={handleToneOpenChange}>
          <Popover.Trigger
            ref={toneTriggerRef}
            className={styles.toneTrigger}
            aria-labelledby="settings-tone-label settings-tone-value"
            aria-haspopup="menu"
            aria-expanded={isToneOpen}
            aria-controls={toneMenuId}
            data-selected="true"
          >
            <span id="settings-tone-value">{toneLabel}</span>
            <span aria-hidden="true">▾</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className={styles.tonePopover}
              sideOffset={8}
              align="start"
              id={toneMenuId}
              onOpenAutoFocus={(event) => {
                event.preventDefault()
                toneOptionRefs.current[selectedToneIndex]?.focus()
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                toneTriggerRef.current?.focus()
              }}
            >
              <div role="menu" aria-label="口調" className={styles.toneList}>
                {TONE_OPTIONS.map((option, index) => {
                  const isSelected = option.value === tone
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      tabIndex={index === focusedToneIndex ? 0 : -1}
                      ref={(element) => {
                        toneOptionRefs.current[index] = element
                      }}
                      className={styles.toneOption}
                      data-selected={isSelected || undefined}
                      onFocus={() => setFocusedToneIndex(index)}
                      onKeyDown={(event) => handleToneKeyDown(event, index)}
                      onClick={() => selectTone(option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  )
}
